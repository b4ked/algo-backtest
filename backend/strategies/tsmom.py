"""
Time-Series Momentum (TSMOM) with Inverse Volatility Scaling
=============================================================
Signal: Long if trailing 12-month return is positive, flat otherwise.
Position size: target_vol / realized_vol (inverse-vol scaling).
Risk management: halve position during detected volatility spikes.

Reference: Moskowitz, Ooi, Pedersen (2012) — "Time Series Momentum"
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .base import BaseStrategy


class TSMOMStrategy(BaseStrategy):
    name = "TSMOM + Vol Scaling"
    description = (
        "Time-Series Momentum: go long when the trailing 12-month return is "
        "positive, flat otherwise. Position size scales inversely with "
        "realized volatility to target a constant risk level."
    )
    default_params = {
        "lookback_months": 12,
        "vol_window": 20,
        "target_vol": 0.15,   # 15% annualised target volatility
        "max_leverage": 1.5,
    }
    param_info = {
        "lookback_months": {"label": "Momentum Lookback (months)", "min": 3, "max": 24, "step": 1},
        "vol_window": {"label": "Vol Window (days)", "min": 5, "max": 60, "step": 5},
        "target_vol": {"label": "Target Volatility (ann.)", "min": 0.05, "max": 0.60, "step": 0.01},
        "max_leverage": {"label": "Max Leverage", "min": 0.5, "max": 3.0, "step": 0.1},
    }

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        lb_days = int(self.params["lookback_months"]) * 21   # ~21 trading days/month
        vol_win = int(self.params["vol_window"])
        tgt_vol = float(self.params["target_vol"])
        max_lev = float(self.params["max_leverage"])

        close = df["close"]
        daily_ret = close.pct_change()

        # ── Momentum signal ──────────────────────────────────────────────────
        momentum = close.pct_change(lb_days)

        # ── Volatility ───────────────────────────────────────────────────────
        # Rolling realised vol (annualised)
        real_vol = daily_ret.rolling(vol_win).std() * np.sqrt(252)
        # EWM vol for faster spike detection
        ewm_vol = daily_ret.ewm(span=vol_win, adjust=False).std() * np.sqrt(252)
        # Take the more conservative (higher) of the two estimates
        actual_vol = pd.concat([real_vol, ewm_vol], axis=1).max(axis=1)
        actual_vol = actual_vol.replace(0.0, np.nan)

        # ── Inverse-vol position size ─────────────────────────────────────────
        pos_size = (tgt_vol / actual_vol).clip(0.01, max_lev)

        # Risk management: halve size when vol exceeds 2× its 60-day average
        vol_spike_thresh = actual_vol.rolling(60, min_periods=10).mean() * 2.0
        pos_size = pos_size.where(actual_vol <= vol_spike_thresh, pos_size * 0.5)

        df["momentum"] = momentum
        df["actual_vol"] = actual_vol
        df["position_size"] = pos_size.fillna(1.0).clip(0.01, max_lev)

        # ── Edge-triggered signals ────────────────────────────────────────────
        direction = np.sign(momentum).fillna(0)
        df["signal"] = 0
        # Enter long when momentum turns positive
        df.loc[(direction == 1) & (direction.shift(1) != 1), "signal"] = 1
        # Exit when momentum turns non-positive
        df.loc[(direction != 1) & (direction.shift(1) == 1), "signal"] = -1

        return df

    def get_indicators(self, df: pd.DataFrame) -> dict:
        indicators = {}

        if "actual_vol" in df.columns:
            indicators["Realised Vol (Ann.)"] = {
                "data": [
                    {"time": int(idx.timestamp()), "value": round(float(v), 4)}
                    for idx, v in df["actual_vol"].dropna().items()
                ],
                "type": "oscillator",
                "color": "#f59e0b",
                "lineWidth": 2,
                "levels": [
                    {
                        "value": float(self.params["target_vol"]),
                        "color": "#3b82f666",
                        "label": "Target",
                    }
                ],
            }

        if "position_size" in df.columns:
            indicators["Position Size (×)"] = {
                "data": [
                    {"time": int(idx.timestamp()), "value": round(float(v), 3)}
                    for idx, v in df["position_size"].dropna().items()
                ],
                "type": "oscillator",
                "color": "#22c55e",
                "lineWidth": 1,
                "levels": [
                    {"value": 1.0, "color": "#94a3b844", "label": "Full size"},
                ],
            }

        return indicators
