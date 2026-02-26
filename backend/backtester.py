from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Optional
import numpy as np
import pandas as pd


@dataclass
class Trade:
    entry_time: int
    entry_price: float
    size: float  # BTC amount
    exit_time: Optional[int] = None
    exit_price: Optional[float] = None
    pnl: Optional[float] = None
    pnl_pct: Optional[float] = None

    def close(self, exit_time: int, exit_price: float):
        self.exit_time = exit_time
        self.exit_price = exit_price
        self.pnl = (exit_price - self.entry_price) * self.size
        self.pnl_pct = (exit_price - self.entry_price) / self.entry_price


class Backtester:
    def __init__(self, initial_capital: float = 10_000.0, commission: float = 0.001):
        self.initial_capital = initial_capital
        self.commission = commission  # 0.1% per trade (realistic exchange fee)

    def run(self, df: pd.DataFrame, strategy) -> dict:
        df = strategy.generate_signals(df.copy())
        indicators = strategy.get_indicators(df)

        capital = self.initial_capital
        position = 0.0
        trades: List[Trade] = []
        current_trade: Optional[Trade] = None
        equity_curve = []
        bh_shares = self.initial_capital / float(df.iloc[0]["close"]) if len(df) > 0 else 0.0
        bh_curve = []

        for idx, row in df.iterrows():
            price = float(row["close"])
            sig = int(row.get("signal", 0))
            ts = int(idx.timestamp())

            portfolio_value = capital + position * price
            equity_curve.append({"time": ts, "value": round(portfolio_value, 2)})
            bh_curve.append({"time": ts, "value": round(bh_shares * price, 2)})

            if sig == 1 and position == 0:
                invest = capital * 0.99
                fee = invest * self.commission
                invest_net = invest - fee
                position = invest_net / price
                capital -= invest
                current_trade = Trade(entry_time=ts, entry_price=price, size=position)

            elif sig == -1 and position > 0:
                sale = position * price
                fee = sale * self.commission
                capital += sale - fee
                if current_trade:
                    current_trade.close(ts, price)
                    trades.append(current_trade)
                    current_trade = None
                position = 0.0

        # Close open position at last bar
        if position > 0 and len(df) > 0:
            last_price = float(df.iloc[-1]["close"])
            last_ts = int(df.index[-1].timestamp())
            sale = position * last_price
            fee = sale * self.commission
            capital += sale - fee
            if current_trade:
                current_trade.close(last_ts, last_price)
                trades.append(current_trade)
            position = 0.0

        final_capital = capital
        total_return = (final_capital - self.initial_capital) / self.initial_capital

        if len(df) >= 2:
            bh_return = (float(df.iloc[-1]["close"]) - float(df.iloc[0]["close"])) / float(df.iloc[0]["close"])
        else:
            bh_return = 0.0

        wins = [t for t in trades if t.pnl is not None and t.pnl > 0]
        losses = [t for t in trades if t.pnl is not None and t.pnl <= 0]
        win_rate = len(wins) / len(trades) if trades else 0.0
        avg_win = float(np.mean([t.pnl_pct for t in wins])) if wins else 0.0
        avg_loss = float(np.mean([t.pnl_pct for t in losses])) if losses else 0.0

        eq_vals = [e["value"] for e in equity_curve]
        max_dd = self._max_drawdown(eq_vals)

        rets = pd.Series(eq_vals).pct_change().dropna()
        if rets.std() > 0:
            # Annualise based on timeframe
            periods_per_year = self._periods_per_year(df)
            sharpe = float(rets.mean() / rets.std() * np.sqrt(periods_per_year))
        else:
            sharpe = 0.0

        # Candles
        candles = [
            {
                "time": int(idx.timestamp()),
                "open": round(float(r["open"]), 2),
                "high": round(float(r["high"]), 2),
                "low": round(float(r["low"]), 2),
                "close": round(float(r["close"]), 2),
                "volume": round(float(r.get("volume", 0)), 2),
            }
            for idx, r in df.iterrows()
        ]

        # Trade markers
        trade_markers = []
        for t in trades:
            trade_markers.append({
                "time": t.entry_time,
                "type": "BUY",
                "price": round(t.entry_price, 2),
                "pnl": round(t.pnl, 2) if t.pnl is not None else None,
                "pnl_pct": round(t.pnl_pct * 100, 2) if t.pnl_pct is not None else None,
            })
            if t.exit_time:
                trade_markers.append({
                    "time": t.exit_time,
                    "type": "SELL",
                    "price": round(t.exit_price, 2),
                    "pnl": round(t.pnl, 2) if t.pnl is not None else None,
                    "pnl_pct": round(t.pnl_pct * 100, 2) if t.pnl_pct is not None else None,
                })

        trade_markers.sort(key=lambda x: x["time"])

        return {
            "strategy_name": strategy.name,
            "params": strategy.params,
            "candles": candles,
            "indicators": indicators,
            "trades": trade_markers,
            "equity_curve": equity_curve,
            "bh_curve": bh_curve,
            "metrics": {
                "total_return": round(total_return * 100, 2),
                "buy_hold_return": round(bh_return * 100, 2),
                "final_capital": round(final_capital, 2),
                "num_trades": len(trades),
                "win_rate": round(win_rate * 100, 2),
                "avg_win_pct": round(avg_win * 100, 2),
                "avg_loss_pct": round(avg_loss * 100, 2),
                "max_drawdown": round(max_dd * 100, 2),
                "sharpe_ratio": round(sharpe, 2),
                "profit_factor": self._profit_factor(wins, losses),
            },
        }

    @staticmethod
    def _max_drawdown(values: list) -> float:
        if not values:
            return 0.0
        peak = values[0]
        max_dd = 0.0
        for v in values:
            if v > peak:
                peak = v
            dd = (peak - v) / peak if peak > 0 else 0.0
            if dd > max_dd:
                max_dd = dd
        return max_dd

    @staticmethod
    def _profit_factor(wins, losses) -> float:
        gross_win = sum(t.pnl for t in wins if t.pnl is not None)
        gross_loss = abs(sum(t.pnl for t in losses if t.pnl is not None))
        if gross_loss == 0:
            return 0.0 if gross_win == 0 else 999.0
        return round(gross_win / gross_loss, 2)

    @staticmethod
    def _periods_per_year(df: pd.DataFrame) -> float:
        if len(df) < 2:
            return 252
        delta = (df.index[-1] - df.index[0]).total_seconds() / len(df)
        seconds_per_year = 365.25 * 24 * 3600
        return seconds_per_year / delta
