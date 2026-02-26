import pandas as pd
import numpy as np
from .base import BaseStrategy


class SupertrendStrategy(BaseStrategy):
    name = "SuperTrend"
    description = "Trend-following strategy using the SuperTrend indicator based on ATR. Follows Bitcoin's directional trend."
    default_params = {"atr_period": 10, "multiplier": 3.0}
    param_info = {
        "atr_period": {"label": "ATR Period", "min": 5, "max": 50, "step": 1},
        "multiplier": {"label": "ATR Multiplier", "min": 1.0, "max": 6.0, "step": 0.5},
    }

    def _compute_supertrend(self, df: pd.DataFrame, atr_period: int, multiplier: float):
        high = df["high"].values
        low = df["low"].values
        close = df["close"].values
        n = len(close)

        # True Range
        tr = np.zeros(n)
        tr[0] = high[0] - low[0]
        for i in range(1, n):
            tr[i] = max(high[i] - low[i], abs(high[i] - close[i - 1]), abs(low[i] - close[i - 1]))

        # ATR (Wilder's smoothing)
        atr = np.zeros(n)
        atr[atr_period - 1] = np.mean(tr[:atr_period])
        for i in range(atr_period, n):
            atr[i] = (atr[i - 1] * (atr_period - 1) + tr[i]) / atr_period

        hl2 = (high + low) / 2.0
        basic_upper = hl2 + multiplier * atr
        basic_lower = hl2 - multiplier * atr

        final_upper = basic_upper.copy()
        final_lower = basic_lower.copy()
        supertrend = np.zeros(n)
        trend = np.ones(n, dtype=int)  # 1=up, -1=down

        for i in range(1, n):
            # Final upper band
            if basic_upper[i] < final_upper[i - 1] or close[i - 1] > final_upper[i - 1]:
                final_upper[i] = basic_upper[i]
            else:
                final_upper[i] = final_upper[i - 1]
            # Final lower band
            if basic_lower[i] > final_lower[i - 1] or close[i - 1] < final_lower[i - 1]:
                final_lower[i] = basic_lower[i]
            else:
                final_lower[i] = final_lower[i - 1]

        # Determine trend and supertrend value
        for i in range(1, n):
            prev = supertrend[i - 1]
            if prev == final_upper[i - 1] or (i > 1 and abs(prev - final_upper[i - 1]) < 1e-9):
                # was in downtrend
                if close[i] > final_upper[i]:
                    trend[i] = 1
                    supertrend[i] = final_lower[i]
                else:
                    trend[i] = -1
                    supertrend[i] = final_upper[i]
            else:
                # was in uptrend
                if close[i] < final_lower[i]:
                    trend[i] = -1
                    supertrend[i] = final_upper[i]
                else:
                    trend[i] = 1
                    supertrend[i] = final_lower[i]

        # Initialise first row
        if close[0] <= final_upper[0]:
            trend[0] = -1
            supertrend[0] = final_upper[0]
        else:
            trend[0] = 1
            supertrend[0] = final_lower[0]

        df = df.copy()
        df["supertrend"] = supertrend
        df["st_trend"] = trend
        return df

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        atr_period = int(self.params["atr_period"])
        multiplier = float(self.params["multiplier"])
        df = self._compute_supertrend(df, atr_period, multiplier)
        df["signal"] = 0
        df.loc[(df["st_trend"] == 1) & (df["st_trend"].shift(1) == -1), "signal"] = 1
        df.loc[(df["st_trend"] == -1) & (df["st_trend"].shift(1) == 1), "signal"] = -1
        return df

    def get_indicators(self, df: pd.DataFrame) -> dict:
        indicators = {}
        if "supertrend" in df.columns:
            indicators["SuperTrend"] = {
                "data": [
                    {"time": int(idx.timestamp()), "value": round(float(v), 2)}
                    for idx, v in df["supertrend"].dropna().items()
                ],
                "type": "price",
                "color": "#eab308",
                "lineWidth": 2,
            }
        return indicators
