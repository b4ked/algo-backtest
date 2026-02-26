import os
import pickle
import logging
import re
from datetime import datetime, timedelta

import pandas as pd
import yfinance as yf

logger = logging.getLogger(__name__)

CACHE_DIR = "/tmp/btc_backtester_cache"

TIMEFRAME_MAP = {
    "5m": "5m",
    "15m": "15m",
    "1h": "1h",
    "4h": "1h",   # fetched as 1h, resampled to 4h
    "1d": "1d",
    "1w": "1wk",
}

MAX_DAYS = {
    "5m": 59,
    "15m": 59,
    "1h": 729,
    "4h": 729,
    "1d": 10000,
    "1w": 10000,
}

PERIOD_DAYS = {
    "7d": 7,
    "1mo": 30,
    "3mo": 90,
    "6mo": 180,
    "1y": 365,
    "2y": 730,
    "5y": 1825,
    "max": 99999,
}


def _period_to_days(period: str) -> int:
    if not period:
        return 365

    period = str(period).strip().lower()
    if period in PERIOD_DAYS:
        return PERIOD_DAYS[period]

    match = re.match(r"^(\d+)\s*(d|day|days|w|week|weeks|mo|month|months|y|yr|year|years)$", period)
    if not match:
        return 365

    value = int(match.group(1))
    unit = match.group(2)
    if unit in {"d", "day", "days"}:
        return value
    if unit in {"w", "week", "weeks"}:
        return value * 7
    if unit in {"mo", "month", "months"}:
        return value * 30
    if unit in {"y", "yr", "year", "years"}:
        return value * 365

    return 365


def _cache_path(key: str) -> str:
    os.makedirs(CACHE_DIR, exist_ok=True)
    return os.path.join(CACHE_DIR, f"{key}.pkl")


def _load_cache(key: str, ttl_seconds: int):
    path = _cache_path(key)
    if not os.path.exists(path):
        return None
    age = (datetime.now() - datetime.fromtimestamp(os.path.getmtime(path))).total_seconds()
    if age > ttl_seconds:
        return None
    try:
        with open(path, "rb") as f:
            return pickle.load(f)
    except Exception:
        return None


def _save_cache(key: str, df: pd.DataFrame):
    path = _cache_path(key)
    try:
        with open(path, "wb") as f:
            pickle.dump(df, f)
    except Exception:
        pass


def _normalise(df: pd.DataFrame) -> pd.DataFrame:
    """Flatten MultiIndex columns (yfinance >= 0.2.x) and standardise names."""
    if isinstance(df.columns, pd.MultiIndex):
        # yfinance 1.x returns (Price, Ticker) tuples — keep only the price level
        df.columns = [col[0].lower() if isinstance(col, tuple) else col.lower() for col in df.columns]
    else:
        df.columns = [c.lower() for c in df.columns]

    rename = {
        "adj close": "close",
        "stock splits": "splits",
        "dividends": "dividends",
    }
    df = df.rename(columns=rename)

    for col in ("open", "high", "low", "close", "volume"):
        if col not in df.columns:
            raise ValueError(f"Missing expected column '{col}' after normalisation. Got: {list(df.columns)}")

    return df[["open", "high", "low", "close", "volume"]].dropna()


class DataFetcher:
    def __init__(self, symbol: str = "BTC-USD"):
        self.symbol = symbol

    def fetch(self, timeframe: str = "1d", period: str = "1y") -> pd.DataFrame:
        cache_key = f"{self.symbol}_{timeframe}_{period}"
        ttl = 300 if timeframe in ("5m", "15m", "1h", "4h") else 3600
        cached = _load_cache(cache_key, ttl)
        if cached is not None:
            logger.info("Cache hit: %s", cache_key)
            return cached

        df = self._download(timeframe, period)
        _save_cache(cache_key, df)
        return df

    def _download(self, timeframe: str, period: str) -> pd.DataFrame:
        yf_interval = TIMEFRAME_MAP.get(timeframe, "1d")
        need_resample = timeframe == "4h"

        req_days = _period_to_days(period)
        max_days = MAX_DAYS.get(timeframe, 10000)
        actual_days = min(req_days, max_days)

        end = datetime.utcnow()
        start = end - timedelta(days=actual_days)

        logger.info("Downloading %s %s %s→%s", self.symbol, yf_interval, start.date(), end.date())

        if actual_days >= 9000:
            df = yf.download(
                self.symbol,
                period="max",
                interval=yf_interval,
                progress=False,
                auto_adjust=True,
            )
        else:
            df = yf.download(
                self.symbol,
                start=start.strftime("%Y-%m-%d"),
                end=end.strftime("%Y-%m-%d"),
                interval=yf_interval,
                progress=False,
                auto_adjust=True,
            )

        if df.empty:
            raise ValueError(f"No data returned for {self.symbol} ({timeframe}, {period}). Check your internet connection.")

        df = _normalise(df)

        # Ensure UTC-naive datetime index
        if df.index.tz is not None:
            df.index = df.index.tz_convert("UTC").tz_localize(None)

        if need_resample:
            df = df.resample("4h").agg(
                {"open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"}
            ).dropna()

        df = df.sort_index()
        logger.info("Downloaded %d candles", len(df))
        return df
