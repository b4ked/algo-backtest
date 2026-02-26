"""
Deep Reinforcement Learning: Proximal Policy Optimization (PPO)
===============================================================
Custom OpenAI Gymnasium trading environment + Stable-Baselines3 PPO agent.

Observation space : flattened (lookback × n_features) window + [position, progress]
Action space      : Discrete(3)  → 0=Hold, 1=Long, 2=Exit
Reward            : realised P&L − transaction cost − volatility penalty − drawdown penalty

The agent is trained on the full price history then evaluated deterministically
to produce the signal vector (training on the same data it acts on gives a
clean demo; for live use, train on a separate in-sample period).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .base import BaseStrategy

try:
    import gymnasium as gym
    from gymnasium import spaces
    from stable_baselines3 import PPO as SB3PPO
    HAS_SB3 = True
except ImportError:
    HAS_SB3 = False
    gym = None
    spaces = None

# ── environment ───────────────────────────────────────────────────────────────

if HAS_SB3:
    class BTCTradingEnv(gym.Env):
        """
        Custom Gymnasium environment for BTC intraday trading.

        State  : sliding window of normalised technical features + position flag
        Action : 0=Hold  1=Long  2=Exit
        Reward : Δportfolio − transaction_cost − vol_penalty − drawdown_penalty
        """

        N_FEATURES = 8   # features per time-step in the observation window

        def __init__(
            self,
            df: pd.DataFrame,
            lookback: int = 20,
            transaction_cost: float = 0.001,
            target_vol: float = 0.02,
        ):
            super().__init__()
            self.df = df.reset_index(drop=True)
            self.lookback = lookback
            self.transaction_cost = transaction_cost
            self.target_vol = target_vol

            obs_dim = lookback * self.N_FEATURES + 2   # +2: position, progress
            self.observation_space = spaces.Box(
                low=-10.0, high=10.0, shape=(obs_dim,), dtype=np.float32
            )
            self.action_space = spaces.Discrete(3)   # 0=Hold, 1=Long, 2=Exit

            self._precompute_features()
            self.reset()

        # ── feature pre-computation ───────────────────────────────────────────

        def _precompute_features(self) -> None:
            df = self.df
            c = df["close"].astype(float)
            h = df["high"].astype(float)
            l = df["low"].astype(float)

            ret1 = c.pct_change().fillna(0).clip(-0.3, 0.3)
            ret5 = c.pct_change(5).fillna(0).clip(-0.6, 0.6)

            # RSI (normalised to [0,1])
            d = c.diff()
            g = d.where(d > 0, 0).rolling(14).mean().fillna(0)
            lss = (-d.where(d < 0, 0)).rolling(14).mean().fillna(0)
            rsi = ((100 - 100 / (1 + g / (lss + 1e-9))) / 100).clip(0, 1)

            # MACD normalised
            macd = (c.ewm(span=12).mean() - c.ewm(span=26).mean()) / (c + 1e-9)
            macd = macd.fillna(0).clip(-0.1, 0.1)

            # Bollinger position (−1 → +1)
            bm = c.rolling(20).mean()
            bs = c.rolling(20).std().fillna(1)
            bb = ((c - bm) / (2 * bs + 1e-9)).fillna(0).clip(-3, 3) / 3.0

            # ATR normalised
            tr = pd.concat(
                [h - l, (h - c.shift(1)).abs(), (l - c.shift(1)).abs()], axis=1
            ).max(axis=1)
            atr = (tr.rolling(14).mean() / (c + 1e-9)).fillna(0).clip(0, 0.15) / 0.15

            # Volume ratio
            if "volume" in df.columns and df["volume"].sum() > 0:
                vm = df["volume"].rolling(20).mean()
                vol_r = (df["volume"].astype(float) / (vm + 1e-9)).fillna(1).clip(0, 5) / 5.0
            else:
                vol_r = pd.Series(0.2, index=df.index)

            # Realised vol (annualised, normalised)
            rv = ret1.rolling(10).std().fillna(0) * np.sqrt(252) / 2.0

            self.features = np.column_stack(
                [ret1, ret5, rsi, macd, bb, atr, vol_r, rv]
            ).astype(np.float32)

        # ── gym interface ─────────────────────────────────────────────────────

        def _get_obs(self) -> np.ndarray:
            start = max(0, self.step_idx - self.lookback)
            window = self.features[start : self.step_idx]
            if len(window) < self.lookback:
                pad = np.zeros(
                    (self.lookback - len(window), self.N_FEATURES), dtype=np.float32
                )
                window = np.vstack([pad, window])
            obs = window.flatten()
            progress = np.float32(self.step_idx / max(len(self.df), 1))
            return np.append(obs, [np.float32(self.position), progress])

        def _compute_reward(
            self, prev_price: float, curr_price: float, action_changed: bool
        ) -> float:
            pnl = ((curr_price - prev_price) / prev_price) * self.position
            tx = self.transaction_cost if action_changed else 0.0

            self.portfolio_value *= 1.0 + pnl - tx
            self.peak_value = max(self.peak_value, self.portfolio_value)
            self.portfolio_returns.append(pnl)

            # Volatility penalty — excess vol above target
            if len(self.portfolio_returns) >= 10:
                rv = np.std(self.portfolio_returns[-10:]) * np.sqrt(252)
                vol_pen = max(0.0, rv - self.target_vol) * 0.5
            else:
                vol_pen = 0.0

            # Drawdown penalty
            dd = max(0.0, (self.peak_value - self.portfolio_value) / self.peak_value)
            dd_pen = dd * 0.3

            return float(pnl - tx - vol_pen - dd_pen)

        def step(self, action: int):
            action_changed = action != self.prev_action
            self.prev_action = action

            # Apply action
            if action == 1:    # Long
                self.position = 1
            elif action == 2:  # Exit
                self.position = 0
            # action == 0: Hold — keep current position

            prev_price = float(self.df.iloc[self.step_idx]["close"])
            self.step_idx += 1
            done = self.step_idx >= len(self.df)
            curr_price = float(self.df.iloc[min(self.step_idx, len(self.df) - 1)]["close"])

            reward = self._compute_reward(prev_price, curr_price, action_changed)
            obs = self._get_obs()
            return obs, reward, done, False, {}

        def reset(self, *, seed=None, options=None):
            super().reset(seed=seed)
            self.step_idx = self.lookback
            self.position = 0
            self.prev_action = 0
            self.portfolio_value = 1.0
            self.peak_value = 1.0
            self.portfolio_returns: list[float] = []
            return self._get_obs(), {}

else:
    # Stub so import doesn't fail when sb3 is absent
    class BTCTradingEnv:  # type: ignore[no-redef]
        pass


# ── strategy ─────────────────────────────────────────────────────────────────

class PPOStrategy(BaseStrategy):
    name = "PPO Reinforcement Learning"
    description = (
        "PPO agent (Stable-Baselines3) trained on a custom Gym environment. "
        "Observation: sliding window of 8 normalised features × lookback bars. "
        "Actions: Hold / Long / Exit. Reward: P&L penalised for volatility and "
        "drawdown. Requires stable-baselines3 and gymnasium (see README)."
    )
    default_params = {
        "lookback": 20,
        "training_steps": 10000,
        "clip_range": 0.2,
        "learning_rate": 0.0003,
        "ent_coef": 0.01,
        "target_vol": 0.02,
    }
    param_info = {
        "lookback": {"label": "Observation Window (bars)", "min": 10, "max": 60, "step": 5},
        "training_steps": {"label": "Training Steps", "min": 2000, "max": 50000, "step": 2000},
        "clip_range": {"label": "PPO Clip Range", "min": 0.05, "max": 0.50, "step": 0.05},
        "learning_rate": {"label": "Learning Rate", "min": 0.00005, "max": 0.001, "step": 0.00005},
        "ent_coef": {"label": "Entropy Coefficient", "min": 0.0, "max": 0.05, "step": 0.005},
        "target_vol": {"label": "Target Volatility (reward)", "min": 0.005, "max": 0.10, "step": 0.005},
    }

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        if not HAS_SB3:
            raise ImportError(
                "stable-baselines3 and gymnasium are required for the PPO strategy.\n"
                "Install with:  pip install 'stable-baselines3[extra]' gymnasium"
            )

        lookback = int(self.params["lookback"])
        n_steps_total = int(self.params["training_steps"])

        # ── Environment setup ─────────────────────────────────────────────────
        env = BTCTradingEnv(
            df,
            lookback=lookback,
            transaction_cost=0.001,
            target_vol=float(self.params["target_vol"]),
        )

        # ── PPO agent config ──────────────────────────────────────────────────
        # n_steps must be divisible by batch_size to avoid truncated mini-batches
        raw_steps = min(256, max(64, len(df) // 4))
        batch_size = 32
        rollout_len = max(batch_size, (raw_steps // batch_size) * batch_size)
        model = SB3PPO(
            policy="MlpPolicy",
            env=env,
            learning_rate=float(self.params["learning_rate"]),
            n_steps=rollout_len,
            batch_size=batch_size,
            n_epochs=10,
            gamma=0.99,
            gae_lambda=0.95,
            clip_range=float(self.params["clip_range"]),
            ent_coef=float(self.params["ent_coef"]),
            policy_kwargs={"net_arch": [64, 64]},
            verbose=0,
        )

        # ── Training loop ─────────────────────────────────────────────────────
        model.learn(total_timesteps=n_steps_total)

        # ── Evaluation: run trained agent deterministically ───────────────────
        obs, _ = env.reset()
        raw_actions: list[int] = []
        done = False
        while not done:
            action, _ = model.predict(obs, deterministic=True)
            raw_actions.append(int(action))
            obs, _, done, _, _ = env.step(int(action))

        # Map actions back to dataframe index (starts at bar `lookback`)
        df["ppo_action"] = 0
        start = lookback
        end = start + len(raw_actions)
        df.iloc[start:end, df.columns.get_loc("ppo_action")] = raw_actions[: len(df) - start]

        # ── Convert raw actions → entry / exit signals ────────────────────────
        df["signal"] = 0
        sig_col = df.columns.get_loc("signal")
        acts = df["ppo_action"].values
        position = 0
        for i in range(1, len(df)):
            act = int(acts[i])
            new_pos = 1 if act == 1 else (position if act == 0 else 0)
            if new_pos == 1 and position == 0:
                df.iloc[i, sig_col] = 1
            elif new_pos == 0 and position == 1:
                df.iloc[i, sig_col] = -1
            position = new_pos

        return df

    def get_indicators(self, df: pd.DataFrame) -> dict:
        if "ppo_action" not in df.columns:
            return {}

        return {
            "PPO Action (0=Hold 1=Long 2=Exit)": {
                "data": [
                    {"time": int(idx.timestamp()), "value": float(v)}
                    for idx, v in df["ppo_action"].items()
                ],
                "type": "oscillator",
                "color": "#a855f7",
                "lineWidth": 2,
                "levels": [
                    {"value": 1.0, "color": "#22c55e55", "label": "Long"},
                    {"value": 2.0, "color": "#ef444455", "label": "Exit"},
                ],
            }
        }
