import pandas as pd
from .base import BaseStrategy


def _series(df, col, decimals=2):
    return [
        {"time": int(idx.timestamp()), "value": round(float(v), decimals)}
        for idx, v in df[col].dropna().items()
    ]


class MeanReversionStrategy(BaseStrategy):
    name = "Mean Reversion (Z-Score)"
    description = "Buy when price dips far below its rolling mean (negative Z-score); sell when it rises above. Statistical mean-reversion."
    default_params = {"period": 20, "z_buy": -2.0, "z_sell": 1.0}
    param_info = {
        "period": {"label": "Lookback Period", "min": 5, "max": 200, "step": 1},
        "z_buy": {"label": "Buy Z-Score", "min": -4.0, "max": -0.5, "step": 0.1},
        "z_sell": {"label": "Sell Z-Score", "min": 0.5, "max": 4.0, "step": 0.1},
    }

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        period = int(self.params["period"])
        z_buy = float(self.params["z_buy"])
        z_sell = float(self.params["z_sell"])
        df["roll_mean"] = df["close"].rolling(window=period).mean()
        df["roll_std"] = df["close"].rolling(window=period).std()
        df["zscore"] = (df["close"] - df["roll_mean"]) / df["roll_std"]
        df["signal"] = 0
        df.loc[(df["zscore"] < z_buy) & (df["zscore"].shift(1) >= z_buy), "signal"] = 1
        df.loc[(df["zscore"] > z_sell) & (df["zscore"].shift(1) <= z_sell), "signal"] = -1
        return df

    def get_indicators(self, df: pd.DataFrame) -> dict:
        indicators = {}
        if "roll_mean" in df.columns:
            indicators["Rolling Mean"] = {
                "data": _series(df, "roll_mean"),
                "type": "price",
                "color": "#14b8a6",
                "lineWidth": 1,
                "lineStyle": 2,
            }
        if "zscore" in df.columns:
            indicators["Z-Score"] = {
                "data": _series(df, "zscore", 3),
                "type": "oscillator",
                "color": "#a855f7",
                "lineWidth": 2,
                "levels": [
                    {"value": float(self.params["z_buy"]), "color": "#22c55e66", "label": "Buy Zone"},
                    {"value": 0, "color": "#94a3b833", "label": "Zero"},
                    {"value": float(self.params["z_sell"]), "color": "#ef444466", "label": "Sell Zone"},
                ],
            }
        return indicators
