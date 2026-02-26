from .sma_crossover import SMACrossoverStrategy
from .ema_crossover import EMACrossoverStrategy
from .rsi_strategy import RSIStrategy
from .macd_strategy import MACDStrategy
from .bollinger_bands import BollingerBandsStrategy
from .supertrend import SupertrendStrategy
from .combined_rsi_macd import CombinedRSIMACDStrategy
from .mean_reversion import MeanReversionStrategy
from .donchian_breakout import DonchianBreakoutStrategy

# Advanced strategies
from .ou_pairs_trading import OUPairsTradingStrategy
from .tsmom import TSMOMStrategy
from .xgboost_strategy import XGBoostStrategy
from .ppo_strategy import PPOStrategy

STRATEGIES = {
    # ── Classic ──────────────────────────────────────────────────────────────
    "sma_crossover": SMACrossoverStrategy,
    "ema_crossover": EMACrossoverStrategy,
    "rsi": RSIStrategy,
    "macd": MACDStrategy,
    "bollinger_bands": BollingerBandsStrategy,
    "supertrend": SupertrendStrategy,
    "combined_rsi_macd": CombinedRSIMACDStrategy,
    "mean_reversion": MeanReversionStrategy,
    "donchian_breakout": DonchianBreakoutStrategy,
    # ── Advanced ──────────────────────────────────────────────────────────────
    "ou_pairs_trading": OUPairsTradingStrategy,
    "tsmom": TSMOMStrategy,
    "xgboost": XGBoostStrategy,
    "ppo": PPOStrategy,
}

__all__ = ["STRATEGIES"]
