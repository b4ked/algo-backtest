import logging
from typing import Any, Dict, Optional

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
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
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


@app.get("/api/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
