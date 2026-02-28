"""
Statistical Arbitrage: Ornstein-Uhlenbeck Pairs Trading
========================================================
Discretises the continuous-time OU SDE into an AR(1) model, solves for
mean-reversion speed (κ), equilibrium mean (μ) and half-life, then trades
the asset / pair spread based on a rolling Z-score.

Signal logic
  Z < -z_entry  → Long spread  (buy asset, asset cheap vs pair)
  Z > +z_entry  → Short spread / exit long (asset expensive vs pair)
  |Z| < z_exit  → Liquidate (spread reverted to mean)
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import yfinance as yf

from .base import BaseStrategy

try:
    from statsmodels.tools import add_constant as sm_add_const
    from statsmodels.regression.linear_model import OLS as SMOLS
    HAS_STATSMODELS = True
except ImportError:
    HAS_STATSMODELS = False


# ── helpers ──────────────────────────────────────────────────────────────────

def _ols(y: np.ndarray, x: np.ndarray) -> tuple[float, float]:
    """Return (intercept, slope) from simple OLS: y = a + b*x."""
    if HAS_STATSMODELS:
        X = sm_add_const(x)
        res = SMOLS(y, X).fit()
        return float(res.params[0]), float(res.params[1])
    # Fallback: closed-form OLS
    x_m, y_m = x.mean(), y.mean()
    b = ((x - x_m) * (y - y_m)).sum() / ((x - x_m) ** 2).sum()
    a = y_m - b * x_m
    return float(a), float(b)


def _ou_params_from_ar1(spread: np.ndarray) -> dict:
    """
    Fit AR(1):  S_t = a + b·S_{t-1} + ε
    OU parameters:
      κ  = -ln(b)           (mean-reversion speed, per bar)
      μ  = a / (1 - b)      (equilibrium mean)
      t½ = ln(2) / κ        (half-life in bars)
    """
    a, b = _ols(spread[1:], spread[:-1])
    if b <= 0.0 or b >= 1.0:
        return {"half_life": np.nan, "kappa": np.nan, "mu": np.nan}
    kappa = -np.log(b)
    return {
        "half_life": round(np.log(2) / kappa, 1),
        "kappa": round(kappa, 5),
        "mu": round(a / (1.0 - b), 4),
    }


# ── strategy ─────────────────────────────────────────────────────────────────

class OUPairsTradingStrategy(BaseStrategy):
    name = "OU Pairs Trading"
    description = (
        "Statistical arbitrage via Ornstein-Uhlenbeck mean reversion. "
        "Computes log-price spread, fits AR(1) to extract OU half-life, "
        "then trades when the rolling Z-score breaches configurable thresholds."
    )
    default_params = {
        "pair_symbol": "ETH-USD",
        "lookback": 60,
        "z_entry": 2.0,
        "z_exit": 0.5,
    }
    param_info = {
        "pair_symbol": {
            "label": "Pair Asset",
            "type": "select",
            "options": ["ETH-USD", "BNB-USD", "SOL-USD", "XRP-USD", "ADA-USD"],
        },
        "lookback": {"label": "Z-Score Lookback (bars)", "min": 20, "max": 120, "step": 5},
        "z_entry": {"label": "Entry |Z| Threshold", "min": 1.0, "max": 4.0, "step": 0.1},
        "z_exit": {"label": "Exit |Z| Threshold", "min": 0.0, "max": 1.5, "step": 0.1},
    }

    # ── data ─────────────────────────────────────────────────────────────────

    def _fetch_pair(self, df: pd.DataFrame) -> pd.Series:
        symbol = str(self.params.get("pair_symbol", "ETH-USD"))
        start = (df.index[0] - pd.Timedelta(days=5)).strftime("%Y-%m-%d")
        end = (df.index[-1] + pd.Timedelta(days=2)).strftime("%Y-%m-%d")

        raw = yf.download(
            symbol, start=start, end=end, interval="1d",
            progress=False, auto_adjust=True,
        )
        if raw.empty:
            raise ValueError(f"No data returned for pair symbol '{symbol}'.")

        if isinstance(raw.columns, pd.MultiIndex):
            raw.columns = [c[0].lower() for c in raw.columns]
        else:
            raw.columns = [c.lower() for c in raw.columns]

        if raw.index.tz is not None:
            raw.index = raw.index.tz_convert("UTC").tz_localize(None)

        return raw["close"]

    # ── core math ─────────────────────────────────────────────────────────────

    def _build_spread(
        self, df: pd.DataFrame, pair_close: pd.Series
    ) -> tuple[pd.DataFrame, pd.Series, float]:
        """Align, OLS hedge ratio on log prices, return (df_aligned, spread, hr)."""
        common = df.index.intersection(pair_close.index)
        df = df.loc[common].copy()
        p2 = pair_close.loc[common]

        lp1 = np.log(df["close"].values.astype(float))
        lp2 = np.log(p2.values.astype(float))

        # OLS: log(BTC) = a + hr·log(pair) — hedge ratio ensures cointegration
        _, hr = _ols(lp1, lp2)
        spread = pd.Series(lp1 - hr * lp2, index=df.index)
        return df, spread, hr

    # ── signals ──────────────────────────────────────────────────────────────

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        lookback = int(self.params["lookback"])
        z_entry = float(self.params["z_entry"])
        z_exit = float(self.params["z_exit"])

        pair_close = self._fetch_pair(df)
        df, spread, hr = self._build_spread(df, pair_close)

        # OU parameter estimation on full spread
        self._ou_info = _ou_params_from_ar1(spread.dropna().values)
        self._hedge_ratio = round(hr, 4)

        # Rolling Z-score
        roll_mean = spread.rolling(lookback).mean()
        roll_std = spread.rolling(lookback).std().replace(0, np.nan)
        zscore = (spread - roll_mean) / roll_std

        df["spread"] = spread.values
        df["ou_zscore"] = zscore.values

        # ── signal logic ────────────────────────────────────────────────────
        df["signal"] = 0
        z = df["ou_zscore"]

        # Long: BTC cheap vs pair → expect spread to revert upward
        df.loc[(z < -z_entry) & (z.shift(1) >= -z_entry), "signal"] = 1
        # Exit long when spread reverts to near zero
        df.loc[(z >= -z_exit) & (z.shift(1) < -z_exit), "signal"] = -1
        # Forced exit when spread overshoots to the other side
        df.loc[(z > z_entry) & (z.shift(1) <= z_entry), "signal"] = -1

        return df

    # ── indicators ───────────────────────────────────────────────────────────

    def get_indicators(self, df: pd.DataFrame) -> dict:
        if "ou_zscore" not in df.columns:
            return {}

        ou = getattr(self, "_ou_info", {})
        hl = ou.get("half_life", "?")
        hr = getattr(self, "_hedge_ratio", "?")
        z_e = float(self.params["z_entry"])
        z_x = float(self.params["z_exit"])

        return {
            f"OU Z-Score  (HL≈{hl}d  HR≈{hr})": {
                "data": [
                    {"time": int(idx.timestamp()), "value": round(float(v), 3)}
                    for idx, v in df["ou_zscore"].dropna().items()
                ],
                "type": "oscillator",
                "color": "#3b82f6",
                "lineWidth": 2,
                "levels": [
                    {"value":  z_e, "color": "#ef444466", "label": "Short entry"},
                    {"value":  z_x, "color": "#94a3b844", "label": "Exit zone"},
                    {"value": -z_x, "color": "#94a3b844", "label": "Exit zone"},
                    {"value": -z_e, "color": "#22c55e66", "label": "Long entry"},
                ],
            }
        }
