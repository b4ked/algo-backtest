import pandas as pd
from .base import BaseStrategy


def _series(df, col, decimals=2):
    return [
        {"time": int(idx.timestamp()), "value": round(float(v), decimals)}
        for idx, v in df[col].dropna().items()
    ]


def _calc_rsi(series: pd.Series, period: int) -> pd.Series:
    delta = series.diff()
    gain = delta.where(delta > 0, 0.0).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0.0)).rolling(window=period).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))


class RSIStrategy(BaseStrategy):
    name = "RSI Mean Reversion"
    description = "Buy when RSI crosses up from oversold; sell when RSI crosses down from overbought. Classic momentum oscillator strategy."
    default_params = {"period": 14, "oversold": 30, "overbought": 70}
    param_info = {
        "period": {"label": "RSI Period", "min": 2, "max": 50, "step": 1},
        "oversold": {"label": "Oversold Level", "min": 10, "max": 45, "step": 1},
        "overbought": {"label": "Overbought Level", "min": 55, "max": 90, "step": 1},
    }

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        period = int(self.params["period"])
        oversold = float(self.params["oversold"])
        overbought = float(self.params["overbought"])
        df["rsi"] = _calc_rsi(df["close"], period)
        df["signal"] = 0
        df.loc[(df["rsi"] > oversold) & (df["rsi"].shift(1) <= oversold), "signal"] = 1
        df.loc[(df["rsi"] < overbought) & (df["rsi"].shift(1) >= overbought), "signal"] = -1
        return df

    def get_indicators(self, df: pd.DataFrame) -> dict:
        indicators = {}
        if "rsi" in df.columns:
            indicators["RSI"] = {
                "data": _series(df, "rsi"),
                "type": "oscillator",
                "color": "#f59e0b",
                "lineWidth": 2,
                "levels": [
                    {"value": float(self.params["oversold"]), "color": "#22c55e66", "label": "Oversold"},
                    {"value": 50, "color": "#94a3b833", "label": "Mid"},
                    {"value": float(self.params["overbought"]), "color": "#ef444466", "label": "Overbought"},
                ],
            }
        return indicators
