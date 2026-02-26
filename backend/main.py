import logging
import itertools
import math
import time
from typing import Any, Dict, List, Literal, Optional

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backtester import Backtester
from data_fetcher import DataFetcher
from strategies import STRATEGIES

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="BTC Backtest Lab API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class BacktestRequest(BaseModel):
    strategy: str
    timeframe: str = "1d"
    period: str = "1y"
    params: Optional[Dict[str, Any]] = None
    initial_capital: float = 10_000.0


class CompareRequest(BaseModel):
    strategy1: str
    strategy2: str
    timeframe: str = "1d"
    period: str = "1y"
    params1: Optional[Dict[str, Any]] = None
    params2: Optional[Dict[str, Any]] = None
    initial_capital: float = 10_000.0


class ParamRangeOverride(BaseModel):
    min: Optional[float] = None
    max: Optional[float] = None
    step: Optional[float] = None


class SmartSearchRequest(BaseModel):
    strategies: Optional[List[str]] = None
    timeframe: str = "1d"
    lookback_value: int = 1
    lookback_unit: Literal["days", "months", "years"] = "years"
    initial_capital: float = 10_000.0
    step_scale: int = 1
    auto_scale_steps: bool = True
    max_combinations_per_strategy: int = 2_000
    top_n: Optional[int] = 200
    param_overrides: Optional[Dict[str, Dict[str, ParamRangeOverride]]] = None


def _lookback_to_period(value: int, unit: str) -> str:
    safe_value = max(1, int(value))
    if unit == "days":
        return f"{safe_value}d"
    if unit == "months":
        return f"{safe_value}mo"
    if unit == "years":
        return f"{safe_value}y"
    return "1y"


def _is_int_param(default_value: Any, min_v: float, max_v: float, step_v: float) -> bool:
    if isinstance(default_value, bool):
        return False
    if isinstance(default_value, int):
        return True
    return float(min_v).is_integer() and float(max_v).is_integer() and float(step_v).is_integer()


def _decimal_places(*values: float) -> int:
    places = 0
    for value in values:
        text = f"{value:.12f}".rstrip("0").rstrip(".")
        if "." in text:
            places = max(places, len(text.split(".")[1]))
    return min(max(places, 0), 8)


def _build_param_values(min_v: float, max_v: float, step_v: float, is_int: bool) -> List[Any]:
    if min_v > max_v:
        min_v, max_v = max_v, min_v

    if is_int:
        lo = int(round(min_v))
        hi = int(round(max_v))
        step = max(1, int(round(step_v)))
        values = list(range(lo, hi + 1, step))
        if not values or values[-1] != hi:
            values.append(hi)
        return sorted(set(values))

    decimals = _decimal_places(min_v, max_v, step_v)
    epsilon = step_v / 1_000_000.0
    values = []
    current = min_v
    guard = 0
    while current <= max_v + epsilon and guard < 1_000_000:
        values.append(round(current, decimals))
        current += step_v
        guard += 1
    if not values or abs(values[-1] - max_v) > epsilon:
        values.append(round(max_v, decimals))
    return sorted(set(values))


def _num_values(min_v: float, max_v: float, step_v: float, is_int: bool) -> int:
    values = _build_param_values(min_v=min_v, max_v=max_v, step_v=step_v, is_int=is_int)
    return max(1, len(values))


def _compute_combo_count(param_defs: List[Dict[str, Any]], extra_scale: int = 1) -> int:
    total = 1
    for definition in param_defs:
        step = definition["step"] * extra_scale
        count = _num_values(
            min_v=definition["min"],
            max_v=definition["max"],
            step_v=step,
            is_int=definition["is_int"],
        )
        total *= count
    return total


def _is_valid_param_combo(params: Dict[str, Any]) -> bool:
    pair_rules = [
        ("fast_period", "slow_period"),
        ("fast", "slow"),
        ("macd_fast", "macd_slow"),
        ("oversold", "overbought"),
        ("rsi_oversold", "rsi_overbought"),
        ("z_buy", "z_sell"),
    ]
    for left, right in pair_rules:
        if left in params and right in params and params[left] >= params[right]:
            return False
    return True


def _build_strategy_grid(
    strategy_id: str,
    strategy_cls,
    req: SmartSearchRequest,
) -> Dict[str, Any]:
    param_info = strategy_cls.param_info or {}
    defaults = strategy_cls.default_params or {}
    overrides = (req.param_overrides or {}).get(strategy_id, {})

    param_defs = []
    for param_name, info in param_info.items():
        try:
            min_v = float(info["min"])
            max_v = float(info["max"])
            step_v = float(info["step"])
        except Exception as exc:
            raise HTTPException(400, f"Invalid param_info for {strategy_id}.{param_name}: {exc}") from exc

        override = overrides.get(param_name)
        if override:
            if override.min is not None:
                min_v = float(override.min)
            if override.max is not None:
                max_v = float(override.max)
            if override.step is not None:
                step_v = float(override.step)

        if step_v <= 0:
            raise HTTPException(400, f"Step must be > 0 for {strategy_id}.{param_name}")

        param_defs.append(
            {
                "name": param_name,
                "min": min_v,
                "max": max_v,
                "step": step_v * max(1, req.step_scale),
                "is_int": _is_int_param(defaults.get(param_name), min_v, max_v, step_v),
            }
        )

    if not param_defs:
        return {
            "strategy_id": strategy_id,
            "strategy_name": strategy_cls.name,
            "param_names": [],
            "value_lists": [],
            "estimated_combinations": 1,
            "applied_step_multiplier": 1,
            "default_params": defaults,
        }

    combo_count = _compute_combo_count(param_defs)
    multiplier = 1

    if combo_count > req.max_combinations_per_strategy:
        if not req.auto_scale_steps:
            raise HTTPException(
                400,
                (
                    f"{strategy_id} has ~{combo_count} combinations with current steps. "
                    f"Lower ranges or increase max_combinations_per_strategy."
                ),
            )

        dims = max(1, len(param_defs))
        multiplier = max(1, int(math.ceil((combo_count / req.max_combinations_per_strategy) ** (1 / dims))))
        combo_count = _compute_combo_count(param_defs, extra_scale=multiplier)
        while combo_count > req.max_combinations_per_strategy:
            multiplier += 1
            combo_count = _compute_combo_count(param_defs, extra_scale=multiplier)

    names = []
    values = []
    for definition in param_defs:
        names.append(definition["name"])
        values.append(
            _build_param_values(
                min_v=definition["min"],
                max_v=definition["max"],
                step_v=definition["step"] * multiplier,
                is_int=definition["is_int"],
            )
        )

    return {
        "strategy_id": strategy_id,
        "strategy_name": strategy_cls.name,
        "param_names": names,
        "value_lists": values,
        "estimated_combinations": combo_count,
        "applied_step_multiplier": multiplier,
        "default_params": defaults,
    }


@app.get("/api/strategies")
def list_strategies():
    return {
        "strategies": [
            {"id": k, **v.get_meta()}
            for k, v in STRATEGIES.items()
        ]
    }


@app.post("/api/backtest")
def run_backtest(req: BacktestRequest):
    strategy_cls = STRATEGIES.get(req.strategy)
    if not strategy_cls:
        raise HTTPException(400, f"Unknown strategy: {req.strategy}")
    try:
        fetcher = DataFetcher()
        df = fetcher.fetch(timeframe=req.timeframe, period=req.period)
        strategy = strategy_cls(params=req.params)
        backtester = Backtester(initial_capital=req.initial_capital)
        result = backtester.run(df, strategy)
        return result
    except Exception as exc:
        logger.exception("Backtest failed")
        raise HTTPException(500, str(exc))


@app.post("/api/compare")
def compare_strategies(req: CompareRequest):
    for sid in (req.strategy1, req.strategy2):
        if sid not in STRATEGIES:
            raise HTTPException(400, f"Unknown strategy: {sid}")
    try:
        fetcher = DataFetcher()
        df = fetcher.fetch(timeframe=req.timeframe, period=req.period)
        results = []
        for sid, params in [(req.strategy1, req.params1), (req.strategy2, req.params2)]:
            strategy = STRATEGIES[sid](params=params)
            backtester = Backtester(initial_capital=req.initial_capital)
            results.append(backtester.run(df, strategy))
        return {"strategy1": results[0], "strategy2": results[1]}
    except Exception as exc:
        logger.exception("Compare failed")
        raise HTTPException(500, str(exc))


@app.post("/api/smart-search")
def run_smart_search(req: SmartSearchRequest):
    strategy_ids = req.strategies or list(STRATEGIES.keys())
    if not strategy_ids:
        raise HTTPException(400, "Provide at least one strategy.")
    if req.lookback_value <= 0:
        raise HTTPException(400, "lookback_value must be > 0.")
    if req.initial_capital <= 0:
        raise HTTPException(400, "initial_capital must be > 0.")
    if req.max_combinations_per_strategy <= 0:
        raise HTTPException(400, "max_combinations_per_strategy must be > 0.")
    if req.step_scale <= 0:
        raise HTTPException(400, "step_scale must be > 0.")

    missing = [sid for sid in strategy_ids if sid not in STRATEGIES]
    if missing:
        raise HTTPException(400, f"Unknown strategies: {', '.join(missing)}")

    period = _lookback_to_period(req.lookback_value, req.lookback_unit)
    started = time.perf_counter()

    try:
        fetcher = DataFetcher()
        df = fetcher.fetch(timeframe=req.timeframe, period=period)
    except Exception as exc:
        logger.exception("Smart search data fetch failed")
        raise HTTPException(500, str(exc))

    results = []
    strategy_summaries = []
    total_runs = 0

    try:
        for strategy_id in strategy_ids:
            strategy_cls = STRATEGIES[strategy_id]
            grid = _build_strategy_grid(strategy_id=strategy_id, strategy_cls=strategy_cls, req=req)
            param_names = grid["param_names"]
            value_lists = grid["value_lists"]

            combos = itertools.product(*value_lists) if value_lists else [()]
            runs_for_strategy = 0
            skipped_invalid = 0
            backtester = Backtester(initial_capital=req.initial_capital)

            for combo in combos:
                combo_params = dict(zip(param_names, combo)) if param_names else {}
                if combo_params and not _is_valid_param_combo(combo_params):
                    skipped_invalid += 1
                    continue

                strategy_params = {**grid["default_params"], **combo_params}
                strategy = strategy_cls(params=strategy_params)
                summary = backtester.run(df, strategy, summary_only=True)
                metrics = summary["metrics"]

                results.append(
                    {
                        "strategy_id": strategy_id,
                        "strategy_name": strategy_cls.name,
                        "params": strategy_params,
                        "metrics": metrics,
                    }
                )
                runs_for_strategy += 1

            total_runs += runs_for_strategy
            strategy_summaries.append(
                {
                    "strategy_id": strategy_id,
                    "strategy_name": strategy_cls.name,
                    "estimated_combinations": grid["estimated_combinations"],
                    "executed_runs": runs_for_strategy,
                    "skipped_invalid_combinations": skipped_invalid,
                    "applied_step_multiplier": grid["applied_step_multiplier"],
                }
            )

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Smart search failed")
        raise HTTPException(500, str(exc))

    if not results:
        raise HTTPException(
            400,
            "No valid strategy configurations were executed. Adjust ranges or strategy selections.",
        )

    results.sort(
        key=lambda item: (
            item["metrics"]["total_return"],
            item["metrics"]["final_capital"],
            item["metrics"]["sharpe_ratio"],
        ),
        reverse=True,
    )

    if req.top_n is not None and req.top_n > 0:
        ranked_results = results[: req.top_n]
    else:
        ranked_results = results

    for index, item in enumerate(ranked_results, start=1):
        item["rank"] = index

    elapsed = round(time.perf_counter() - started, 3)
    return {
        "meta": {
            "timeframe": req.timeframe,
            "lookback": {"value": req.lookback_value, "unit": req.lookback_unit, "period": period},
            "initial_capital": req.initial_capital,
            "total_runs": total_runs,
            "returned_runs": len(ranked_results),
            "duration_seconds": elapsed,
            "strategy_summaries": strategy_summaries,
        },
        "results": ranked_results,
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
