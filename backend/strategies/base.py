from abc import ABC, abstractmethod
from typing import Dict, Any, List
import pandas as pd


class BaseStrategy(ABC):
    name: str = "Base Strategy"
    description: str = ""
    default_params: Dict[str, Any] = {}
    param_info: Dict[str, Dict] = {}  # label, min, max, step for UI

    def __init__(self, params: Dict[str, Any] = None):
        self.params = {**self.default_params, **(params or {})}

    @abstractmethod
    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add a 'signal' column: 1=buy, -1=sell, 0=hold"""
        pass

    @abstractmethod
    def get_indicators(self, df: pd.DataFrame) -> Dict[str, List]:
        """
        Return dict of indicator series for charting.
        Each entry: {"data": [...], "type": "price"|"oscillator", "color": "#hex"}
        data items: {"time": unix_ts, "value": float}
        """
        pass

    @classmethod
    def get_meta(cls):
        return {
            "name": cls.name,
            "description": cls.description,
            "default_params": cls.default_params,
            "param_info": cls.param_info,
        }
