import pandas as pd
from .base import BaseStrategy


class SMACrossoverStrategy(BaseStrategy):
    name = "SMA Crossover"
    description = "Buy when the fast SMA crosses above the slow SMA; sell when it crosses below. Classic trend-following strategy."
    default_params = {"fast_period": 20, "slow_period": 50}
    param_info = {
        "fast_period": {"label": "Fast Period", "min": 2, "max": 200, "step": 1},
        "slow_period": {"label": "Slow Period", "min": 5, "max": 500, "step": 1},
    }

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        fast = int(self.params["fast_period"])
        slow = int(self.params["slow_period"])
        df["sma_fast"] = df["close"].rolling(window=fast).mean()
        df["sma_slow"] = df["close"].rolling(window=slow).mean()
        df["signal"] = 0
        cross_up = (df["sma_fast"] > df["sma_slow"]) & (df["sma_fast"].shift(1) <= df["sma_slow"].shift(1))
        cross_dn = (df["sma_fast"] < df["sma_slow"]) & (df["sma_fast"].shift(1) >= df["sma_slow"].shift(1))
        df.loc[cross_up, "signal"] = 1
        df.loc[cross_dn, "signal"] = -1
        return df

    def get_indicators(self, df: pd.DataFrame) -> dict:
        indicators = {}
        for col, name, color in [
            ("sma_fast", "SMA Fast", "#3b82f6"),
            ("sma_slow", "SMA Slow", "#f59e0b"),
        ]:
            if col in df.columns:
                indicators[name] = {
                    "data": _price_series(df, col),
                    "type": "price",
                    "color": color,
                    "lineWidth": 1,
                }
        return indicators


def _price_series(df, col):
    return [
        {"time": int(idx.timestamp()), "value": round(float(v), 2)}
        for idx, v in df[col].dropna().items()
    ]
