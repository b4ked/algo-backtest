import pandas as pd
from .base import BaseStrategy


def _series(df, col, decimals=2):
    return [
        {"time": int(idx.timestamp()), "value": round(float(v), decimals)}
        for idx, v in df[col].dropna().items()
    ]


class DonchianBreakoutStrategy(BaseStrategy):
    name = "Donchian Channel Breakout"
    description = "Buy on a new N-period high breakout; sell on a new N-period low. Captures strong directional momentum."
    default_params = {"period": 20}
    param_info = {
        "period": {"label": "Channel Period", "min": 5, "max": 100, "step": 1},
    }

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        period = int(self.params["period"])
        df["dc_high"] = df["high"].rolling(window=period).max()
        df["dc_low"] = df["low"].rolling(window=period).min()
        df["signal"] = 0
        # Break above previous N-period high → buy
        df.loc[df["high"] > df["dc_high"].shift(1), "signal"] = 1
        # Break below previous N-period low → sell
        df.loc[df["low"] < df["dc_low"].shift(1), "signal"] = -1
        return df

    def get_indicators(self, df: pd.DataFrame) -> dict:
        indicators = {}
        for col, name, color in [
            ("dc_high", "Donchian High", "#22c55e"),
            ("dc_low", "Donchian Low", "#ef4444"),
        ]:
            if col in df.columns:
                indicators[name] = {
                    "data": _series(df, col),
                    "type": "price",
                    "color": color,
                    "lineWidth": 1,
                    "lineStyle": 1,
                }
        return indicators
