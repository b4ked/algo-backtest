import logging
import os
from typing import Any, Dict, Optional

import requests as _req
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

cors_allow_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ALLOW_ORIGINS",
        "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]
cors_allow_origin_regex = os.getenv("CORS_ALLOW_ORIGIN_REGEX")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_allow_origins,
    allow_origin_regex=cors_allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class BacktestRequest(BaseModel):
    strategy: str
    timeframe: str = "1d"
    start_date: Optional[str] = None   # YYYY-MM-DD; preferred over period
    end_date: Optional[str] = None     # YYYY-MM-DD; preferred over period
    period: str = "1y"                 # fallback when dates are not provided
    params: Optional[Dict[str, Any]] = None
    initial_capital: float = 10_000.0
    symbol: str = "BTC-USD"


class CompareRequest(BaseModel):
    strategy1: str
    strategy2: str
    timeframe: str = "1d"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    period: str = "1y"
    params1: Optional[Dict[str, Any]] = None
    params2: Optional[Dict[str, Any]] = None
    initial_capital: float = 10_000.0
    symbol: str = "BTC-USD"


@app.get("/api/strategies")
def list_strategies():
    return {
        "strategies": [
            {"id": k, **v.get_meta()}
            for k, v in STRATEGIES.items()
        ]
    }


@app.get("/api/search")
def search_symbols(q: str):
    """Search Yahoo Finance for matching symbols."""
    try:
        resp = _req.get(
            "https://query1.finance.yahoo.com/v1/finance/search",
            params={"q": q, "quotesCount": 10, "newsCount": 0, "enableFuzzyQuery": True},
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=5,
        )
        resp.raise_for_status()
        quotes = resp.json().get("quotes", [])
        return {
            "results": [
                {
                    "symbol": item.get("symbol", ""),
                    "name": item.get("shortname") or item.get("longname", ""),
                    "exchange": item.get("exchange", ""),
                    "type": item.get("quoteType", ""),
                }
                for item in quotes
                if item.get("symbol")
            ]
        }
    except Exception:
        return {"results": []}


@app.post("/api/backtest")
def run_backtest(req: BacktestRequest):
    strategy_cls = STRATEGIES.get(req.strategy)
    if not strategy_cls:
        raise HTTPException(400, f"Unknown strategy: {req.strategy}")
    try:
        fetcher = DataFetcher(symbol=req.symbol)
        df = fetcher.fetch(
            timeframe=req.timeframe,
            period=req.period,
            start_date=req.start_date,
            end_date=req.end_date,
        )
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
        fetcher = DataFetcher(symbol=req.symbol)
        df = fetcher.fetch(
            timeframe=req.timeframe,
            period=req.period,
            start_date=req.start_date,
            end_date=req.end_date,
        )
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
