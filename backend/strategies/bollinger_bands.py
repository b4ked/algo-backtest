import pandas as pd
from .base import BaseStrategy


def _series(df, col, decimals=2):
    return [
        {"time": int(idx.timestamp()), "value": round(float(v), decimals)}
        for idx, v in df[col].dropna().items()
    ]


class BollingerBandsStrategy(BaseStrategy):
    name = "Bollinger Bands"
    description = "Buy when price touches the lower band (oversold); sell when it touches the upper band (overbought). Mean-reversion strategy."
    default_params = {"period": 20, "std_dev": 2.0}
    param_info = {
        "period": {"label": "Period", "min": 5, "max": 100, "step": 1},
        "std_dev": {"label": "Std Dev Multiplier", "min": 0.5, "max": 4.0, "step": 0.1},
    }

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        period = int(self.params["period"])
        std_dev = float(self.params["std_dev"])
        df["bb_mid"] = df["close"].rolling(window=period).mean()
        df["bb_std"] = df["close"].rolling(window=period).std()
        df["bb_upper"] = df["bb_mid"] + std_dev * df["bb_std"]
        df["bb_lower"] = df["bb_mid"] - std_dev * df["bb_std"]
        df["signal"] = 0
        df.loc[(df["close"] <= df["bb_lower"]) & (df["close"].shift(1) > df["bb_lower"].shift(1)), "signal"] = 1
        df.loc[(df["close"] >= df["bb_upper"]) & (df["close"].shift(1) < df["bb_upper"].shift(1)), "signal"] = -1
        return df

    def get_indicators(self, df: pd.DataFrame) -> dict:
        indicators = {}
        for col, name, color, lw in [
            ("bb_upper", "BB Upper", "#14b8a6", 1),
            ("bb_mid", "BB Middle", "#6b7280", 1),
            ("bb_lower", "BB Lower", "#14b8a6", 1),
        ]:
            if col in df.columns:
                indicators[name] = {
                    "data": _series(df, col),
                    "type": "price",
                    "color": color,
                    "lineWidth": lw,
                    "lineStyle": 2 if col in ("bb_upper", "bb_lower") else 0,
                }
        return indicators
