"""
XGBoost Predictive Architecture
================================
Feature engineering → XGBClassifier → walk-forward TimeSeriesSplit →
probability-based signal generation.

Features (computed without external TA library):
  momentum  : returns at 1/2/3/5/10/20/60-day lags
  RSI       : 7-day and 14-day
  MACD      : normalised MACD and histogram
  Bollinger : band position and width
  ATR       : 14-day normalised ATR
  Volume    : volume ratio vs 20-day MA
  Trend     : EMA(10)/EMA(30) spread, price vs 50-day MA
  Vol regime: 20-day realised volatility and its 5-day change

Target: 1 if close[t+1] > close[t] else 0  (binary, no lookahead)

Walk-forward: TimeSeriesSplit(n_splits) — each fold's test predictions
are OOS, guaranteeing zero data leakage.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .base import BaseStrategy

try:
    import xgboost as xgb
    from sklearn.model_selection import TimeSeriesSplit
    HAS_XGB = True
except ImportError:
    HAS_XGB = False


# ── feature helpers ───────────────────────────────────────────────────────────

def _rsi(s: pd.Series, n: int) -> pd.Series:
    d = s.diff()
    g = d.where(d > 0, 0.0).rolling(n).mean()
    l = (-d.where(d < 0, 0.0)).rolling(n).mean()
    return 100 - 100 / (1 + g / (l + 1e-9))


def _atr(df: pd.DataFrame, n: int) -> pd.Series:
    tr = pd.concat(
        [
            df["high"] - df["low"],
            (df["high"] - df["close"].shift(1)).abs(),
            (df["low"] - df["close"].shift(1)).abs(),
        ],
        axis=1,
    ).max(axis=1)
    return tr.rolling(n).mean()


def _engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    f = pd.DataFrame(index=df.index)
    c = df["close"]

    # Lagged returns
    for lag in [1, 2, 3, 5, 10, 20, 60]:
        f[f"ret_{lag}d"] = c.pct_change(lag)

    # RSI
    f["rsi_7"] = _rsi(c, 7)
    f["rsi_14"] = _rsi(c, 14)

    # MACD (normalised by price)
    ema12, ema26 = c.ewm(span=12).mean(), c.ewm(span=26).mean()
    macd = ema12 - ema26
    f["macd"] = macd / (c + 1e-9)
    f["macd_hist"] = (macd - macd.ewm(span=9).mean()) / (c + 1e-9)

    # Bollinger Bands
    bb_mid = c.rolling(20).mean()
    bb_std = c.rolling(20).std()
    f["bb_pos"] = (c - bb_mid) / (2 * bb_std + 1e-9)
    f["bb_width"] = 4 * bb_std / (bb_mid + 1e-9)

    # ATR (normalised)
    f["atr_14"] = _atr(df, 14) / (c + 1e-9)

    # Volume ratio
    if "volume" in df.columns and df["volume"].sum() > 0:
        vol_ma = df["volume"].rolling(20).mean()
        f["vol_ratio"] = df["volume"] / (vol_ma + 1e-9)
    else:
        f["vol_ratio"] = 1.0

    # Trend
    f["ema_trend"] = (c.ewm(span=10).mean() - c.ewm(span=30).mean()) / (c + 1e-9)
    f["price_vs_50ma"] = (c - c.rolling(50).mean()) / (c + 1e-9)

    # Volatility regime
    f["vol_regime"] = c.pct_change().rolling(20).std() * np.sqrt(252)
    f["vol_change"] = f["vol_regime"].pct_change(5)

    return f


# ── strategy ─────────────────────────────────────────────────────────────────

class XGBoostStrategy(BaseStrategy):
    name = "XGBoost Predictor"
    description = (
        "ML classifier: 19 technical features → XGBClassifier with L1/L2 "
        "regularisation → walk-forward TimeSeriesSplit (OOS predictions only) "
        "→ buy when predicted up-probability exceeds configurable threshold."
    )
    default_params = {
        "n_estimators": 200,
        "learning_rate": 0.05,
        "max_depth": 4,
        "alpha": 1.0,       # L1
        "reg_lambda": 1.0,  # L2
        "confidence_threshold": 0.55,
        "n_splits": 3,
    }
    param_info = {
        "n_estimators": {"label": "N Estimators", "min": 50, "max": 500, "step": 50},
        "learning_rate": {"label": "Learning Rate", "min": 0.01, "max": 0.30, "step": 0.01},
        "max_depth": {"label": "Max Depth", "min": 2, "max": 8, "step": 1},
        "alpha": {"label": "L1 Regularisation (alpha)", "min": 0.0, "max": 5.0, "step": 0.5},
        "reg_lambda": {"label": "L2 Regularisation (lambda)", "min": 0.0, "max": 5.0, "step": 0.5},
        "confidence_threshold": {"label": "Buy Confidence ≥", "min": 0.50, "max": 0.80, "step": 0.01},
        "n_splits": {"label": "CV Folds", "min": 2, "max": 5, "step": 1},
    }

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        if not HAS_XGB:
            raise ImportError(
                "xgboost and scikit-learn are required.\n"
                "Run: pip install xgboost scikit-learn"
            )

        # Feature matrix and binary target (no lookahead: shift -1)
        features = _engineer_features(df)
        target = (df["close"].shift(-1) > df["close"]).astype(int).rename("target")

        data = pd.concat([features, target], axis=1).dropna()
        if len(data) < 100:
            df["signal"] = 0
            df["xgb_prob"] = 0.5
            return df

        X = data.drop(columns=["target"]).values
        y = data["target"].values

        n_splits = int(self.params["n_splits"])
        tscv = TimeSeriesSplit(n_splits=n_splits)
        probs = np.full(len(data), np.nan)

        model = xgb.XGBClassifier(
            n_estimators=int(self.params["n_estimators"]),
            learning_rate=float(self.params["learning_rate"]),
            max_depth=int(self.params["max_depth"]),
            reg_alpha=float(self.params["alpha"]),
            reg_lambda=float(self.params["reg_lambda"]),
            eval_metric="logloss",
            verbosity=0,
            n_jobs=-1,
        )

        # Walk-forward: each test set is strictly OOS
        for train_idx, test_idx in tscv.split(X):
            model.fit(X[train_idx], y[train_idx])
            probs[test_idx] = model.predict_proba(X[test_idx])[:, 1]

        prob_series = pd.Series(probs, index=data.index)
        df["xgb_prob"] = prob_series.reindex(df.index)

        # ── edge-triggered signals based on probability crossing thresholds ──
        thresh = float(self.params["confidence_threshold"])
        p = df["xgb_prob"]
        df["signal"] = 0
        df.loc[(p >= thresh) & (p.shift(1) < thresh), "signal"] = 1
        df.loc[(p < 1.0 - thresh) & (p.shift(1) >= 1.0 - thresh), "signal"] = -1

        return df

    def get_indicators(self, df: pd.DataFrame) -> dict:
        if "xgb_prob" not in df.columns:
            return {}

        thresh = float(self.params["confidence_threshold"])
        return {
            "XGB Up-Probability": {
                "data": [
                    {"time": int(idx.timestamp()), "value": round(float(v), 4)}
                    for idx, v in df["xgb_prob"].dropna().items()
                ],
                "type": "oscillator",
                "color": "#22c55e",
                "lineWidth": 2,
                "levels": [
                    {"value": thresh, "color": "#22c55e66", "label": "Buy"},
                    {"value": 0.5, "color": "#94a3b844", "label": "50%"},
                    {"value": 1.0 - thresh, "color": "#ef444466", "label": "Sell"},
                ],
            }
        }
