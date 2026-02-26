import pandas as pd
from .base import BaseStrategy


def _series(df, col, decimals=2):
    return [
        {"time": int(idx.timestamp()), "value": round(float(v), decimals)}
        for idx, v in df[col].dropna().items()
    ]


class EMACrossoverStrategy(BaseStrategy):
    name = "EMA Crossover"
    description = "Buy when the fast EMA crosses above the slow EMA; sell when it crosses below. Reacts faster to price changes than SMA."
    default_params = {"fast_period": 12, "slow_period": 26}
    param_info = {
        "fast_period": {"label": "Fast Period", "min": 2, "max": 100, "step": 1},
        "slow_period": {"label": "Slow Period", "min": 5, "max": 300, "step": 1},
    }

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        fast = int(self.params["fast_period"])
        slow = int(self.params["slow_period"])
        df["ema_fast"] = df["close"].ewm(span=fast, adjust=False).mean()
        df["ema_slow"] = df["close"].ewm(span=slow, adjust=False).mean()
        df["signal"] = 0
        cross_up = (df["ema_fast"] > df["ema_slow"]) & (df["ema_fast"].shift(1) <= df["ema_slow"].shift(1))
        cross_dn = (df["ema_fast"] < df["ema_slow"]) & (df["ema_fast"].shift(1) >= df["ema_slow"].shift(1))
        df.loc[cross_up, "signal"] = 1
        df.loc[cross_dn, "signal"] = -1
        return df

    def get_indicators(self, df: pd.DataFrame) -> dict:
        indicators = {}
        for col, name, color in [
            ("ema_fast", "EMA Fast", "#a855f7"),
            ("ema_slow", "EMA Slow", "#ec4899"),
        ]:
            if col in df.columns:
                indicators[name] = {
                    "data": _series(df, col),
                    "type": "price",
                    "color": color,
                    "lineWidth": 1,
                }
        return indicators
