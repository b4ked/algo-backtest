function MetricCard({ label, value, sub, positive, negative, mono = true }) {
  const valueColor =
    positive !== undefined
      ? positive
        ? 'text-green-400'
        : 'text-red-400'
      : negative
      ? 'text-red-400'
      : 'text-slate-200'

  return (
    <div className="bg-[#0d1526] border border-[#1e3a5f] rounded-lg p-3 flex flex-col gap-0.5">
      <span className="text-xs text-slate-500 uppercase tracking-wider">{label}</span>
      <span className={`text-lg font-semibold ${valueColor} ${mono ? 'font-mono' : ''}`}>{value}</span>
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
    </div>
  )
}

export default function MetricsPanel({ result, compareResult }) {
  if (!result) return null

  const m = result.metrics
  const cm = compareResult?.metrics

  const fmt = (v, suffix = '') => (v !== undefined && v !== null ? `${v}${suffix}` : '—')
  const fmtDollar = (v) => `$${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`

  return (
    <div className="p-3 space-y-3">
      {/* Strategy name */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">{result.strategy_name}</h3>
          {compareResult && (
            <span className="text-xs text-purple-400 ml-2">vs {compareResult.strategy_name}</span>
          )}
        </div>
        <div className="flex gap-2 text-xs text-slate-500 font-mono">
          {Object.entries(result.params || {}).map(([k, v]) => (
            <span key={k} className="bg-[#111d35] px-2 py-0.5 rounded border border-[#1e3a5f]">
              {k}: {v}
            </span>
          ))}
        </div>
      </div>

      {/* Primary metrics grid */}
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
        <MetricCard
          label="Total Return"
          value={fmt(m.total_return, '%')}
          sub={cm ? fmt(cm.total_return, '%') : `B&H: ${fmt(m.buy_hold_return, '%')}`}
          positive={m.total_return > 0}
        />
        <MetricCard
          label="Final Capital"
          value={fmtDollar(m.final_capital)}
          sub={cm ? fmtDollar(cm.final_capital) : undefined}
          mono
        />
        <MetricCard
          label="Sharpe Ratio"
          value={fmt(m.sharpe_ratio)}
          sub={cm ? fmt(cm.sharpe_ratio) : undefined}
          positive={m.sharpe_ratio > 1}
          negative={m.sharpe_ratio < 0}
        />
        <MetricCard
          label="Max Drawdown"
          value={fmt(m.max_drawdown, '%')}
          sub={cm ? fmt(cm.max_drawdown, '%') : undefined}
          negative
        />
        <MetricCard
          label="Win Rate"
          value={fmt(m.win_rate, '%')}
          sub={cm ? fmt(cm.win_rate, '%') : `${m.num_trades} trades`}
          positive={m.win_rate >= 50}
        />
        <MetricCard
          label="Avg Win"
          value={fmt(m.avg_win_pct, '%')}
          sub={cm ? fmt(cm.avg_win_pct, '%') : undefined}
          positive
        />
        <MetricCard
          label="Avg Loss"
          value={fmt(m.avg_loss_pct, '%')}
          sub={cm ? fmt(cm.avg_loss_pct, '%') : undefined}
          negative
        />
        <MetricCard
          label="Profit Factor"
          value={fmt(m.profit_factor)}
          sub={cm ? fmt(cm.profit_factor) : undefined}
          positive={m.profit_factor > 1}
        />
        <MetricCard
          label="# Trades"
          value={fmt(m.num_trades)}
          sub={cm ? fmt(cm.num_trades) : undefined}
        />
      </div>

      {/* Compare bar if in compare mode */}
      {compareResult && (
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#1e3a5f]">
          <div className="text-xs text-center text-blue-400 font-medium">{result.strategy_name}</div>
          <div className="text-xs text-center text-purple-400 font-medium">{compareResult.strategy_name}</div>
        </div>
      )}
    </div>
  )
}
