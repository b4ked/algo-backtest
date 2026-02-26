import pandas as pd
from .base import BaseStrategy


def _series(df, col, decimals=4):
    return [
        {"time": int(idx.timestamp()), "value": round(float(v), decimals)}
        for idx, v in df[col].dropna().items()
    ]


class CombinedRSIMACDStrategy(BaseStrategy):
    name = "RSI + MACD Combined"
    description = "High-confidence signals requiring both RSI and MACD agreement. Fewer but higher-quality trades."
    default_params = {
        "rsi_period": 14,
        "rsi_oversold": 40,
        "rsi_overbought": 60,
        "macd_fast": 12,
        "macd_slow": 26,
        "macd_signal": 9,
    }
    param_info = {
        "rsi_period": {"label": "RSI Period", "min": 5, "max": 50, "step": 1},
        "rsi_oversold": {"label": "RSI Oversold", "min": 20, "max": 50, "step": 1},
        "rsi_overbought": {"label": "RSI Overbought", "min": 50, "max": 80, "step": 1},
        "macd_fast": {"label": "MACD Fast", "min": 5, "max": 30, "step": 1},
        "macd_slow": {"label": "MACD Slow", "min": 10, "max": 60, "step": 1},
        "macd_signal": {"label": "MACD Signal", "min": 3, "max": 20, "step": 1},
    }

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        p = self.params
        # RSI
        delta = df["close"].diff()
        gain = delta.where(delta > 0, 0.0).rolling(window=int(p["rsi_period"])).mean()
        loss = (-delta.where(delta < 0, 0.0)).rolling(window=int(p["rsi_period"])).mean()
        df["rsi"] = 100 - (100 / (1 + gain / loss))
        # MACD
        df["macd"] = (
            df["close"].ewm(span=int(p["macd_fast"]), adjust=False).mean()
            - df["close"].ewm(span=int(p["macd_slow"]), adjust=False).mean()
        )
        df["macd_sig"] = df["macd"].ewm(span=int(p["macd_signal"]), adjust=False).mean()

        df["signal"] = 0
        buy_rsi = (df["rsi"] > float(p["rsi_oversold"])) & (df["rsi"].shift(1) <= float(p["rsi_oversold"]))
        buy_macd = df["macd"] > df["macd_sig"]
        df.loc[buy_rsi & buy_macd, "signal"] = 1

        sell_rsi = (df["rsi"] < float(p["rsi_overbought"])) & (df["rsi"].shift(1) >= float(p["rsi_overbought"]))
        sell_macd = (df["macd"] < df["macd_sig"]) & (df["macd"].shift(1) >= df["macd_sig"].shift(1))
        df.loc[sell_rsi | sell_macd, "signal"] = -1
        return df

    def get_indicators(self, df: pd.DataFrame) -> dict:
        indicators = {}
        if "rsi" in df.columns:
            indicators["RSI"] = {
                "data": _series(df, "rsi", 2),
                "type": "oscillator",
                "color": "#f59e0b",
                "lineWidth": 2,
                "levels": [
                    {"value": float(self.params["rsi_oversold"]), "color": "#22c55e66", "label": "Oversold"},
                    {"value": float(self.params["rsi_overbought"]), "color": "#ef444466", "label": "Overbought"},
                ],
            }
        if "macd" in df.columns:
            indicators["MACD"] = {"data": _series(df, "macd"), "type": "oscillator", "color": "#3b82f6", "lineWidth": 2}
        if "macd_sig" in df.columns:
            indicators["MACD Signal"] = {"data": _series(df, "macd_sig"), "type": "oscillator", "color": "#ec4899", "lineWidth": 1}
        return indicators
