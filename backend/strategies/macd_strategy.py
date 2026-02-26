import pandas as pd
from .base import BaseStrategy


def _series(df, col, decimals=4):
    return [
        {"time": int(idx.timestamp()), "value": round(float(v), decimals)}
        for idx, v in df[col].dropna().items()
    ]


class MACDStrategy(BaseStrategy):
    name = "MACD Crossover"
    description = "Buy when the MACD line crosses above the signal line; sell when it crosses below. Trend momentum strategy."
    default_params = {"fast": 12, "slow": 26, "signal": 9}
    param_info = {
        "fast": {"label": "Fast EMA", "min": 2, "max": 50, "step": 1},
        "slow": {"label": "Slow EMA", "min": 5, "max": 200, "step": 1},
        "signal": {"label": "Signal Period", "min": 2, "max": 50, "step": 1},
    }

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        fast = int(self.params["fast"])
        slow = int(self.params["slow"])
        sig = int(self.params["signal"])
        df["macd"] = df["close"].ewm(span=fast, adjust=False).mean() - df["close"].ewm(span=slow, adjust=False).mean()
        df["macd_signal"] = df["macd"].ewm(span=sig, adjust=False).mean()
        df["macd_hist"] = df["macd"] - df["macd_signal"]
        df["signal"] = 0
        cross_up = (df["macd"] > df["macd_signal"]) & (df["macd"].shift(1) <= df["macd_signal"].shift(1))
        cross_dn = (df["macd"] < df["macd_signal"]) & (df["macd"].shift(1) >= df["macd_signal"].shift(1))
        df.loc[cross_up, "signal"] = 1
        df.loc[cross_dn, "signal"] = -1
        return df

    def get_indicators(self, df: pd.DataFrame) -> dict:
        indicators = {}
        if "macd" in df.columns:
            indicators["MACD"] = {
                "data": _series(df, "macd"),
                "type": "oscillator",
                "color": "#3b82f6",
                "lineWidth": 2,
            }
        if "macd_signal" in df.columns:
            indicators["MACD Signal"] = {
                "data": _series(df, "macd_signal"),
                "type": "oscillator",
                "color": "#f59e0b",
                "lineWidth": 1,
            }
        if "macd_hist" in df.columns:
            indicators["MACD Hist"] = {
                "data": _series(df, "macd_hist"),
                "type": "histogram",
                "color": "#a855f7",
            }
        return indicators
