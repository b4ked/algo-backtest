import { X } from 'lucide-react'

// ─── Detailed strategy reference data ────────────────────────────────────────
const STRATEGY_INFO = {
  sma_crossover: {
    title: 'SMA Crossover',
    overview: `The Simple Moving Average (SMA) Crossover is one of the oldest and most widely-used trend-following strategies. It holds two SMAs of different lengths on the same chart: a faster (shorter) one and a slower (longer) one. When the fast SMA crosses above the slow SMA the market is deemed to be entering an uptrend and a long position is opened. When the fast SMA crosses back below the slow SMA the trend is considered reversed and the position is closed.`,
    howItWorks: `At every bar the strategy calculates two rolling arithmetic means of the closing price over two different look-back windows. A crossover event is detected by comparing the current relationship between the two lines with the prior bar's relationship. Only the bar on which the cross occurs generates a signal — all other bars are neutral.`,
    bestFor: `Trending markets with smooth, sustained moves. Works well on equities, commodities, and crypto in bull or bear cycles. Performs poorly in choppy, sideways, or mean-reverting markets where frequent false crossovers erode returns.`,
    risks: `Inherently lagging — signals appear after the move has already started. In low-volatility or range-bound regimes it can whipsaw badly, generating many small losing trades. A very tight fast/slow combination amplifies this.`,
    params: [
      { name: 'Fast Period', desc: 'Number of bars used to compute the short-term SMA. Smaller values (e.g. 10–20) react quickly to price changes and generate more signals but also more noise. Larger values smooth out noise at the cost of slower reaction.' },
      { name: 'Slow Period', desc: 'Number of bars for the long-term SMA. Must be meaningfully larger than the fast period. Common settings: 50 / 200 for daily charts (the classic "Golden Cross"). Increasing this reduces trade frequency and filters out minor trends.' },
    ],
  },

  ema_crossover: {
    title: 'EMA Crossover',
    overview: `The Exponential Moving Average (EMA) Crossover works identically to the SMA version in concept, but replaces arithmetic averages with exponentially-weighted ones. Because recent prices carry higher weight, EMAs hug price more tightly and react faster to new information. This makes the crossover signal appear earlier in a trend, at the cost of slightly more false signals in choppy markets.`,
    howItWorks: `Each bar, both EMAs are updated by applying a smoothing factor α = 2 / (period + 1) to the previous EMA value. The fast EMA responds almost immediately to sharp moves; the slow EMA lags considerably. When the fast EMA crosses the slow EMA from below, a buy signal fires; the reverse cross triggers the sell/exit.`,
    bestFor: `Fast-moving assets such as crypto or high-beta equities where early trend entry is important. The standard MACD settings (12 / 26) are actually EMA crossovers and are the basis of the MACD strategy — using similar numbers here will produce comparable behaviour.`,
    risks: `Same whipsawing risk as SMA crossover, but slightly more pronounced because the faster response also amplifies noise. Particularly sensitive to gap opens.`,
    params: [
      { name: 'Fast Period', desc: 'Short EMA look-back. The classic MACD "fast" uses 12. Shorter periods (5–15) are suitable for intraday or 4H charts; 20–50 for daily.' },
      { name: 'Slow Period', desc: 'Long EMA look-back. The classic MACD "slow" uses 26. Should be at least 2× the fast period. Wider gaps between fast and slow mean fewer, more reliable crossovers.' },
    ],
  },

  rsi: {
    title: 'RSI Mean Reversion',
    overview: `The Relative Strength Index (RSI) is a momentum oscillator developed by J. Welles Wilder Jr. It measures the magnitude of recent price gains vs. losses over a rolling window and rescales the result to a 0–100 band. High RSI values indicate the asset may be overbought (due for a pullback); low values indicate oversold conditions (due for a bounce). This strategy trades mean reversion: buy the dip, sell the rip.`,
    howItWorks: `RSI = 100 − (100 / (1 + RS)), where RS = average gain / average loss over the period. The strategy buys when RSI crosses upward through the oversold threshold (e.g. 30) — confirming the down-move is exhausted — and sells when RSI crosses downward through the overbought threshold (e.g. 70).`,
    bestFor: `Range-bound or oscillating markets. Works well on assets that regularly revert to a mean, such as relative-value pairs, sector ETFs, or currencies in tight ranges. Often combined with a trend filter to avoid fading strong trends.`,
    risks: `In a strong trending market RSI can stay overbought/oversold for extended periods, leading to premature entries and large drawdowns. The classic settings of 30/70 may be too conservative on low-volatility assets or too aggressive on crypto.`,
    params: [
      { name: 'RSI Period', desc: 'Look-back window for the RSI calculation. Wilder\'s default is 14 bars. Shorter periods (7–9) produce a more volatile RSI with more signals; longer periods (21–28) smooth the oscillator and generate fewer but higher-conviction trades.' },
      { name: 'Oversold Level', desc: 'RSI value below which the asset is considered oversold. A crossover upward through this level triggers a buy. Default 30. Raising it (e.g. to 40) increases the number of buy signals but lowers conviction; lowering it (e.g. to 20) requires a deeper dip before entry.' },
      { name: 'Overbought Level', desc: 'RSI value above which the asset is considered overbought. A crossover downward through this level triggers a sell/exit. Default 70. Lowering it increases sell frequency; raising it (e.g. to 80) holds the position through moderate pullbacks.' },
    ],
  },

  macd: {
    title: 'MACD Crossover',
    overview: `The Moving Average Convergence Divergence (MACD) indicator, introduced by Gerald Appel in the late 1970s, is one of the most popular technical indicators in the world. It is the difference between a fast and a slow EMA (the MACD line) smoothed by a third EMA (the signal line). Crossovers of the MACD line above/below the signal line produce buy/sell signals with better noise filtering than raw price crossovers.`,
    howItWorks: `MACD Line = EMA(fast) − EMA(slow). Signal Line = EMA(MACD Line, signal_period). Histogram = MACD Line − Signal Line. A buy signal fires when MACD crosses above the signal line (momentum turning positive); a sell fires when MACD crosses below (momentum turning negative). The histogram visualises the gap between the two lines.`,
    bestFor: `Medium-term trend following on daily or weekly charts. Excellent for identifying the beginning of new trends after a consolidation period. Often used in conjunction with price action analysis to confirm breakouts.`,
    risks: `Like all moving-average-based indicators, MACD lags price. In choppy markets the MACD and signal lines crisscross frequently, generating many losing trades. Very sensitive to the choice of periods — small changes can dramatically alter trade frequency.`,
    params: [
      { name: 'Fast EMA', desc: 'Period for the fast EMA component. Default 12. This EMA closely tracks short-term price movements.' },
      { name: 'Slow EMA', desc: 'Period for the slow EMA component. Default 26. The wider the gap to the fast EMA, the more pronounced the MACD oscillations.' },
      { name: 'Signal Period', desc: 'EMA period applied to the MACD line to create the signal line. Default 9. Shorter values make the signal line react faster and generate more crossovers; longer values smooth it out.' },
    ],
  },

  bollinger_bands: {
    title: 'Bollinger Bands',
    overview: `Bollinger Bands, developed by John Bollinger in the 1980s, place an upper and lower band around a simple moving average using standard deviations. The bands expand during high-volatility periods and contract during low-volatility periods. This strategy uses the bands for mean reversion: buy when price touches or falls below the lower band (statistically cheap) and sell when price reaches the upper band (statistically expensive).`,
    howItWorks: `Middle Band = SMA(period). Upper Band = SMA + (std_dev × σ). Lower Band = SMA − (std_dev × σ). σ is the rolling standard deviation of closing prices over the same window. Statistically, ~95% of price action falls within 2-standard-deviation bands, so a touch of the outer band represents an outlier event likely to revert.`,
    bestFor: `Mean-reverting, range-bound assets. Also useful as a squeeze indicator — when the bands compress dramatically, a large move (breakout) is often imminent. The strategy here trades the mean-reversion variant; the breakout variant would buy when price closes outside the upper band.`,
    risks: `In a strong trend price can "walk" along the upper or lower band for many candles, making the mean-reversion assumption fail. The bands are also backward-looking and widen after volatility has already increased.`,
    params: [
      { name: 'Period', desc: 'Look-back for both the central SMA and the standard deviation calculation. Default 20 (Bollinger\'s own recommendation). Shorter periods make the bands more responsive to recent volatility; longer periods produce wider, more stable bands.' },
      { name: 'Std Dev Multiplier', desc: 'Number of standard deviations from the middle band to each outer band. Default 2.0. At 2.0, ~95% of prices fall inside the bands. Increasing to 2.5–3.0 makes the signals rarer and the trades more extreme; decreasing to 1.5 generates more frequent, less extreme signals.' },
    ],
  },

  supertrend: {
    title: 'SuperTrend',
    overview: `SuperTrend is a trend-following overlay indicator built on the Average True Range (ATR). It draws a single line that switches between sitting below price (bullish, green) and above price (bearish, red) as the trend changes. The strategy is long whenever the SuperTrend line is below price and exits when price crosses below the line — acting as a dynamic trailing stop.`,
    howItWorks: `The indicator computes a basic upper and lower band using ATR: Upper = (High + Low) / 2 + (multiplier × ATR). Lower = (High + Low) / 2 − (multiplier × ATR). The SuperTrend line itself is set to the lower band when price is above it (uptrend) and to the upper band when price is below it (downtrend), with hysteresis to prevent rapid flipping. The ATR component means the trailing stop automatically widens during high-volatility periods and tightens during calm ones.`,
    bestFor: `Strong trending assets in any market. Particularly effective on daily or 4H charts for trending crypto, commodity, or equity indices. The automatic volatility adjustment makes it more robust than fixed-ATR trailing stops.`,
    risks: `Like all trend-following methods it will give back a portion of profits at every trend reversal before the signal fires. In ranging markets it produces frequent whipsaws.`,
    params: [
      { name: 'ATR Period', desc: 'Number of bars used to compute the Average True Range. Default 10. Shorter periods (5–7) create a more sensitive, tighter trailing stop; longer periods (14–20) create a wider, less reactive stop that stays in trades longer.' },
      { name: 'ATR Multiplier', desc: 'Scalar applied to the ATR to set band width. Default 3.0. Higher values (4–5) give the price more room to breathe before signalling a trend change, resulting in fewer but larger trades. Lower values (1.5–2.5) react more quickly at the cost of more false signals.' },
    ],
  },

  combined_rsi_macd: {
    title: 'RSI + MACD Combined',
    overview: `This strategy requires both the RSI and MACD indicators to agree before entering a trade, dramatically reducing the number of false signals compared to using either indicator alone. A buy signal is only generated when RSI indicates oversold conditions AND MACD confirms bullish momentum. This dual-confirmation filter produces fewer trades, but each one carries higher confidence.`,
    howItWorks: `Buy condition: RSI crosses upward through the oversold level AND MACD line is above the signal line (or crosses above on the same bar). Sell condition: RSI crosses downward through the overbought level AND MACD confirms. Because both conditions must be satisfied simultaneously, the strategy naturally avoids buying into falling knives or selling into strong momentum moves.`,
    bestFor: `All market conditions — the dual filter makes it more robust than single-indicator strategies. Particularly effective on daily charts for equities and crypto where both momentum and trend context matter. Good starting point for traders new to systematic strategies.`,
    risks: `Stricter entry conditions mean fewer trades and longer periods out of the market. In fast-moving markets the setup conditions may never align cleanly, missing large moves. The extra parameters also increase the risk of over-fitting if all six are optimised together.`,
    params: [
      { name: 'RSI Period', desc: 'Look-back for the RSI calculation. Default 14. Same interpretation as the standalone RSI strategy.' },
      { name: 'RSI Oversold', desc: 'RSI threshold for oversold condition. Default 40 (slightly looser than the pure RSI strategy\'s 30, to compensate for the MACD filter making entries stricter).' },
      { name: 'RSI Overbought', desc: 'RSI threshold for overbought condition. Default 60.' },
      { name: 'MACD Fast', desc: 'Fast EMA period for the MACD component. Default 12.' },
      { name: 'MACD Slow', desc: 'Slow EMA period for the MACD component. Default 26.' },
      { name: 'MACD Signal', desc: 'Signal line period for the MACD component. Default 9.' },
    ],
  },

  mean_reversion: {
    title: 'Mean Reversion (Z-Score)',
    overview: `This strategy applies statistical mean reversion directly to price. It calculates a rolling Z-score — the number of standard deviations the current price is away from its rolling mean. When price moves far enough below the mean (Z-score is sufficiently negative) it is statistically cheap and a long is entered. When price reverts back above the mean (Z-score turns positive) the position is closed for profit.`,
    howItWorks: `Z = (Close − Rolling Mean) / Rolling Std Dev. The rolling mean and standard deviation are calculated over a configurable look-back window. When Z < z_buy threshold the strategy buys; when Z > z_sell threshold it sells. Unlike Bollinger Bands (which use the same maths), this strategy allows asymmetric entry and exit thresholds and provides the raw Z-score as a chart overlay.`,
    bestFor: `Assets that historically mean-revert: currencies (FX pairs), sector ETFs with similar constituents, commodities with supply/demand equilibrium, and statistical arbitrage pairs. Less suitable for assets undergoing structural trends (e.g. growth stocks in a bull market).`,
    risks: `Mean reversion strategies assume the series is stationary — that price will return to its historical average. This assumption breaks during regime changes (new all-time highs, permanent structural shifts). The strategy has theoretically unlimited downside if price mean-reverts to a new, lower equilibrium.`,
    params: [
      { name: 'Lookback Period', desc: 'Window for calculating the rolling mean and standard deviation. Default 20 bars. Shorter windows (10–15) produce a more volatile Z-score and catch short-term deviations; longer windows (50–100) target slower, deeper mean-reversion cycles.' },
      { name: 'Buy Z-Score', desc: 'Negative threshold. The strategy buys when Z-score falls below this value. Default −2.0 (price is 2 standard deviations below mean — roughly 2.5% probability under a normal distribution). More negative values (e.g. −2.5, −3.0) require a deeper dip before entry.' },
      { name: 'Sell Z-Score', desc: 'Positive threshold. The strategy exits when Z-score rises above this value. Default +1.0. Setting this to 0 exits at the mean; higher values let profits run further but risk the position before full reversion.' },
    ],
  },

  donchian_breakout: {
    title: 'Donchian Channel Breakout',
    overview: `The Donchian Channel, created by Richard Donchian (the "father of trend following"), tracks the highest high and lowest low over a rolling look-back period. A breakout to a new N-period high signals strong upward momentum and triggers a buy; a breakdown to a new N-period low signals the trend has reversed and triggers an exit. This is the core mechanism behind the famous Turtle Trading rules.`,
    howItWorks: `Upper Channel = max(High, N bars). Lower Channel = min(Low, N bars). A buy signal fires on the bar that closes above the prior N-period high (new high breakout). An exit fires on the bar that closes below the prior N-period low (new low breakdown). The strategy is always either long or flat — it does not short.`,
    bestFor: `Highly trending markets with strong momentum: crypto bull/bear cycles, commodity supercycles, equity indices. The longer the channel period, the larger and more sustained the trends it captures. Works best when strong directional moves are expected.`,
    risks: `Breakouts frequently fail — price makes a new N-period high, the strategy buys, then price immediately reverses (a "false breakout"). The give-back at trend reversal can be large because the exit only fires at a new N-period low, long after the peak.`,
    params: [
      { name: 'Channel Period', desc: 'Number of bars for the rolling high/low lookback. Default 20 (one month on daily charts). Short periods (10–15) catch minor breakouts and trade more frequently; long periods (40–60) only trigger on major, sustained breakouts like quarterly highs/lows.' },
    ],
  },

  ou_pairs_trading: {
    title: 'Ornstein-Uhlenbeck Pairs Trading',
    overview: `Pairs trading is a market-neutral statistical arbitrage strategy. Rather than betting on the direction of a single asset, it bets on the relative performance of two historically correlated assets reverting to their typical spread. This implementation uses the Ornstein-Uhlenbeck (OU) stochastic process to formally model the mean-reverting spread, estimating the speed of reversion and half-life from historical data.`,
    howItWorks: `The log-price ratio between the primary asset and the chosen pair is modelled as an AR(1) process, allowing estimation of the OU mean-reversion speed κ and equilibrium μ. A rolling Z-score of this spread is then computed. When Z drops below −z_entry (the primary asset is cheap relative to the pair), the strategy goes long the primary. When Z rises above +z_entry (the primary is expensive), the position is exited. The half-life estimates how many bars the spread typically takes to revert, informing the optimal lookback.`,
    bestFor: `Pairs of assets with demonstrated long-term cointegration: crypto pairs (BTC vs ETH, BTC vs SOL), currency crosses, same-sector stocks, or commodity/ETF arbitrage. Works best when the fundamental relationship between the assets is stable.`,
    risks: `Cointegration can break down permanently (regime change, fork, delistings, fundamentals shift). The strategy is exposed to idiosyncratic risk on the pair leg and can suffer large losses if the pair diverges beyond the historical spread. Requires frequent re-estimation of the hedge ratio.`,
    params: [
      { name: 'Pair Asset', desc: 'The second asset used to construct the spread. Must be tradable and historically correlated with your primary chart symbol. Choose an asset in the same ecosystem or sector for the cointegration assumption to hold.' },
      { name: 'Z-Score Lookback', desc: 'Number of bars for the rolling Z-score window. Default 60. Shorter windows (20–30) react faster to spread divergence; longer windows (80–120) require more extreme divergence before signalling.' },
      { name: 'Entry |Z| Threshold', desc: 'Minimum absolute Z-score required to enter a trade. Default 2.0 standard deviations. Increasing this (2.5–3.0) requires rarer, more extreme divergence before entry — fewer trades, higher per-trade expectancy.' },
      { name: 'Exit |Z| Threshold', desc: 'Z-score level at which the position is closed (spread has reverted sufficiently). Default 0.5. Setting this closer to 0 requires near-complete reversion before exiting; higher values (0.8–1.0) take profits earlier before full reversion.' },
    ],
  },

  tsmom: {
    title: 'TSMOM + Volatility Scaling',
    overview: `Time-Series Momentum (TSMOM), popularised by AQR Capital Management in their 2012 paper "Time Series Momentum", is a systematic trend-following strategy used by many institutional funds. Unlike cross-sectional momentum (ranking assets against each other), TSMOM looks only at the asset's own past return to determine direction. It then scales position size by realised volatility to maintain a roughly constant level of risk regardless of market conditions.`,
    howItWorks: `Signal: if the trailing N-month return is positive, hold a long position (the asset is in an uptrend relative to itself); otherwise stay flat. Position size = (target_vol / realised_vol) × capital, capped at max_leverage. Realised volatility is estimated as the annualised rolling standard deviation of daily returns over vol_window bars. The result is a portfolio that de-risks automatically in volatile markets and levers up in calm ones.`,
    bestFor: `Broad asset classes with known momentum persistence: equity indices, bonds, commodities, currencies, and crypto. The strategy is robust across asset classes because it only asks "was this asset going up or down over the past year?" — a question that has historically been predictive.`,
    risks: `Momentum strategies suffer sharp drawdowns during trend reversals and "momentum crashes" (e.g. March 2020, mid-2022). The vol-scaling feature mitigates but does not eliminate this. Performance is sensitive to the momentum lookback period — too short captures noise; too long misses new trends.`,
    params: [
      { name: 'Momentum Lookback (months)', desc: 'Historical return look-back for the trend signal. Default 12 months — matching the academic standard. 3–6 months captures shorter cycles at the cost of more reversals; 18–24 months is slower but smoother.' },
      { name: 'Vol Window (days)', desc: 'Rolling window for estimating realised daily volatility. Default 20 (one month). Shorter windows (10) react quickly to volatility spikes and de-risk faster; longer windows (40–60) smooth out noise in the vol estimate.' },
      { name: 'Target Volatility (annualised)', desc: 'The annualised portfolio volatility the strategy aims to maintain. Default 0.15 (15% p.a.). Higher values increase average leverage and expected return but also drawdowns; lower values (8–12%) are more conservative.' },
      { name: 'Max Leverage', desc: 'Hard cap on the position size multiplier. Default 1.5×. Prevents the vol-scaling from applying excessive leverage during unusually calm periods. Increase for more aggressive sizing; reduce to 1.0 to disallow any leverage.' },
    ],
  },

  xgboost: {
    title: 'XGBoost ML Predictor',
    overview: `This strategy uses XGBoost — an industry-standard gradient boosted tree ensemble — to predict whether the next bar's close will be higher or lower than the current close. It engineers 19 technical features (returns, momentum, volatility, RSI, MACD, Bollinger, volume trends) and trains the model using a time-series cross-validation walk-forward scheme to prevent data leakage. A long position is entered only when the model's predicted probability of an up-move exceeds a configurable confidence threshold.`,
    howItWorks: `Features are computed on each bar (e.g. 5/10/20-day returns, RSI(14), MACD, BB z-score, volume ratios). The data is split into N folds using TimeSeriesSplit — each fold trains on all prior data and predicts only on out-of-sample future bars. XGBoost's soft-probability output (0–1) is used as a confidence score; when it exceeds the threshold a buy signal is issued. This walk-forward approach ensures all signals in the backtest are out-of-sample predictions, not in-sample fits.`,
    bestFor: `Assets with sufficient history for the ML model to train meaningfully (at least 2–3 years of daily data recommended). Particularly powerful when price exhibits non-linear relationships that rule-based indicators miss. Complements traditional strategies well in an ensemble.`,
    risks: `Despite walk-forward validation, the feature set is still tuned to historical data and may not generalise to future regimes. ML models are opaque ("black box") — it is harder to understand why a signal fired. Training time is significant for large datasets with many CV folds.`,
    params: [
      { name: 'N Estimators', desc: 'Number of trees (boosting rounds) in the XGBoost ensemble. Default 200. More trees improve fit but increase training time and risk of overfitting if not regularised. 100–300 is a practical range.' },
      { name: 'Learning Rate', desc: 'Shrinkage applied to each tree\'s contribution. Default 0.05. Lower values (0.01–0.03) require more trees but generalise better; higher values (0.1–0.2) train faster but can overfit.' },
      { name: 'Max Depth', desc: 'Maximum depth of each individual decision tree. Default 4. Deeper trees (6–8) can capture complex interactions but overfit more easily. For financial data, shallow trees (3–5) are usually best.' },
      { name: 'L1 Regularisation (alpha)', desc: 'Lasso-style regularisation that encourages sparse feature usage. Default 1.0. Increase to zero out noisy features; set to 0 to disable.' },
      { name: 'L2 Regularisation (lambda)', desc: 'Ridge-style regularisation that penalises large weights. Default 1.0. Works alongside L1 to prevent overfitting. Both regularisation terms are important for financial ML.' },
      { name: 'Buy Confidence ≥', desc: 'Minimum predicted up-probability (0.5–1.0) required to enter a long position. Default 0.55. At 0.55 the model only needs slight confidence; at 0.65+ it requires high conviction, generating fewer but higher-quality signals.' },
      { name: 'CV Folds', desc: 'Number of time-series cross-validation folds. Default 3. More folds produce more robust out-of-sample estimates but multiply training time. 2–5 is practical for daily data.' },
    ],
  },

  ppo: {
    title: 'PPO Reinforcement Learning',
    overview: `Proximal Policy Optimization (PPO) is a state-of-the-art deep reinforcement learning algorithm developed by OpenAI. Instead of predicting price direction, a PPO agent learns a complete trading policy — when to hold, when to go long, and when to exit — purely from experience in a simulated trading environment. The agent receives rewards for profitable trades and is penalised for volatility and drawdown, shaping it to seek risk-adjusted returns.`,
    howItWorks: `A custom Gymnasium environment wraps the price data. The agent's observation is a sliding window of 8 normalised technical features (returns, volatility, RSI, MACD, volume ratio) over the past lookback bars plus its current position status. Actions are discrete: 0=Hold, 1=Go Long, 2=Exit. At each step the agent receives a reward equal to the portfolio P&L change minus a transaction cost, volatility penalty, and drawdown penalty. PPO trains by alternating between collecting experience in the environment and updating the neural network policy, with a clipping mechanism that prevents destabilising updates.`,
    bestFor: `Experimental use — this is the most sophisticated strategy in the suite and serves as a research baseline. It is best run on daily data with at least 2 years of history. The agent can theoretically learn complex non-linear patterns that rule-based or supervised ML strategies miss. Interesting for comparing RL vs supervised approaches.`,
    risks: `Training is stochastic — results vary between runs. Training on the same data the agent acts on causes significant in-sample overfitting; treat the backtest as a demonstration rather than a true out-of-sample result. Requires stable-baselines3 and gymnasium; training can take minutes. Not suitable for live trading without a separate out-of-sample evaluation period.`,
    params: [
      { name: 'Observation Window (bars)', desc: 'Number of past bars included in the agent\'s observation state. Default 20. Longer windows (30–60) give the agent more context but increase the neural network input size and training time.' },
      { name: 'Training Steps', desc: 'Total number of environment steps used to train the PPO agent. Default 10,000. More steps generally improve policy quality but extend training time significantly. 20,000–50,000 steps produce noticeably better policies.' },
      { name: 'PPO Clip Range', desc: 'PPO\'s trust-region clip parameter ε. Default 0.2. Controls how much the policy can change in a single update. Smaller values (0.1) make training more conservative and stable; larger values (0.3–0.4) allow faster but riskier updates.' },
      { name: 'Learning Rate', desc: 'Neural network optimizer step size. Default 3×10⁻⁴. Decrease for more stable but slower learning; increase cautiously for faster convergence.' },
      { name: 'Entropy Coefficient', desc: 'Weighting on the entropy bonus that encourages exploration. Default 0.01. Higher values (0.02–0.05) keep the policy exploring longer, which can prevent premature convergence to a suboptimal policy.' },
      { name: 'Target Volatility (reward)', desc: 'Target annualised portfolio volatility used in the reward function\'s penalty term. Default 0.02. Setting this lower punishes volatile strategies more aggressively, pushing the agent toward smoother equity curves.' },
    ],
  },
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StrategyInfo({ strategyId, strategyName, onClose }) {
  const info = STRATEGY_INFO[strategyId]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-[#0d1526] border border-[#1e3a5f] rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e3a5f] flex-shrink-0">
          <div>
            <h2 className="text-sm font-bold text-slate-100">{info?.title || strategyName}</h2>
            <p className="text-xs text-slate-500 mt-0.5">Strategy reference</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 transition-colors p-1 rounded hover:bg-[#1e3a5f]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5 text-xs leading-relaxed">
          {!info ? (
            <p className="text-slate-400">No detailed documentation available for this strategy yet.</p>
          ) : (
            <>
              <Section title="Overview" color="blue">
                <p className="text-slate-300">{info.overview}</p>
              </Section>

              <Section title="How It Works" color="teal">
                <p className="text-slate-300">{info.howItWorks}</p>
              </Section>

              <Section title="Best Used When" color="green">
                <p className="text-slate-300">{info.bestFor}</p>
              </Section>

              <Section title="Risks &amp; Limitations" color="amber">
                <p className="text-slate-300">{info.risks}</p>
              </Section>

              {info.params.length > 0 && (
                <Section title="Parameters" color="purple">
                  <div className="space-y-3">
                    {info.params.map((p) => (
                      <div key={p.name}>
                        <span className="font-mono font-semibold text-slate-200">{p.name}</span>
                        <p className="text-slate-400 mt-0.5">{p.desc}</p>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, color, children }) {
  const colors = {
    blue:   'text-blue-400 border-blue-800',
    teal:   'text-teal-400 border-teal-800',
    green:  'text-green-400 border-green-800',
    amber:  'text-amber-400 border-amber-800',
    purple: 'text-purple-400 border-purple-800',
  }
  return (
    <div>
      <h3 className={`text-xs font-bold uppercase tracking-widest mb-2 pb-1 border-b ${colors[color] || colors.blue}`}>
        {title}
      </h3>
      {children}
    </div>
  )
}
