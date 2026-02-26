# ₿ BTC Backtest Lab

A professional web-based Bitcoin backtesting tool with a Python data-science backend and a React/TradingView-charts frontend.

## Features

- **9 built-in strategies** — SMA Crossover, EMA Crossover, RSI, MACD, Bollinger Bands, SuperTrend, RSI+MACD Combined, Mean Reversion (Z-Score), Donchian Breakout
- **Configurable timeframes** — 5m, 15m, 1H, 4H, 1D, 1W
- **Configurable periods** — 7 days → All Time
- **Real-time candlestick chart** with trade markers, indicator overlays, and oscillator sub-charts
- **Equity curve** with Buy & Hold benchmark
- **Full metrics** — return, Sharpe, max drawdown, win rate, profit factor, trade log
- **Side-by-side strategy comparison** with combined equity curves
- **Modular architecture** — add new strategies in one file

## Quick Start

```bash
cd /Users/parryh/algo/algobot
chmod +x start.sh
./start.sh
```

Then open **http://localhost:5173**

## Smart Algo Search UI (New, Isolated Frontend)

This repo now also includes an isolated frontend for exhaustive strategy/config search and profitability ranking:

```bash
cd /Users/parryh/algo/smartalgo
chmod +x start-smart-search.sh
./start-smart-search.sh
```

Then open **http://localhost:5174**

The new UI calls `POST /api/smart-search`, which:
- Sweeps selected strategy parameters across configured ranges/steps
- Executes backtests for all generated combinations
- Returns ranked results ordered by profitability (`total_return`)

Smart Search backend runs on **http://localhost:8001** to avoid collisions with other local algo projects using port 8000.

## Adding a New Strategy

1. Create `backend/strategies/my_strategy.py`:

```python
from .base import BaseStrategy
import pandas as pd

class MyStrategy(BaseStrategy):
    name = "My Strategy"
    description = "What it does."
    default_params = {"period": 14}
    param_info = {
        "period": {"label": "Period", "min": 5, "max": 100, "step": 1},
    }

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        # ... compute indicator ...
        df["signal"] = 0
        # df.loc[buy_condition, "signal"] = 1
        # df.loc[sell_condition, "signal"] = -1
        return df

    def get_indicators(self, df: pd.DataFrame) -> dict:
        return {
            "My Indicator": {
                "data": [{"time": int(idx.timestamp()), "value": float(v)}
                         for idx, v in df["my_col"].dropna().items()],
                "type": "price",   # or "oscillator" / "histogram"
                "color": "#3b82f6",
                "lineWidth": 1,
            }
        }
```

2. Register it in `backend/strategies/__init__.py`:

```python
from .my_strategy import MyStrategy
STRATEGIES["my_strategy"] = MyStrategy
```

That's it — it appears in the UI automatically.

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | Python 3.11+, FastAPI, pandas, numpy, yfinance |
| Frontend | React 18, Vite, Tailwind CSS, TradingView Lightweight Charts |
| Data | Yahoo Finance (BTC-USD) |

## Project Structure

```
algobot/
├── backend/
│   ├── main.py            FastAPI app + endpoints
│   ├── data_fetcher.py    yfinance data + caching
│   ├── backtester.py      trade simulation + metrics
│   ├── strategies/
│   │   ├── base.py        BaseStrategy abstract class
│   │   ├── sma_crossover.py
│   │   ├── ema_crossover.py
│   │   ├── rsi_strategy.py
│   │   ├── macd_strategy.py
│   │   ├── bollinger_bands.py
│   │   ├── supertrend.py
│   │   ├── combined_rsi_macd.py
│   │   ├── mean_reversion.py
│   │   └── donchian_breakout.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx        Main layout + state
│   │   ├── api/client.js  API calls
│   │   └── components/
│   │       ├── MainChart.jsx       Candlestick + indicators + markers
│   │       ├── OscillatorChart.jsx RSI / MACD sub-chart
│   │       ├── EquityChart.jsx     Portfolio curve
│   │       ├── MetricsPanel.jsx    Key performance metrics
│   │       ├── TradeList.jsx       Trade-by-trade log
│   │       └── Sidebar.jsx         Strategy config panel
│   └── package.json
└── start.sh               One-command launcher
```
