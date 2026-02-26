import { useState } from 'react'

function formatTs(ts) {
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fmtPrice(p) {
  return `$${Number(p).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

export default function TradeList({ result, maxHeight = 200 }) {
  const [showAll, setShowAll] = useState(false)
  if (!result) return null

  // Pair trades
  const buys = result.trades.filter((t) => t.type === 'BUY')
  const sells = result.trades.filter((t) => t.type === 'SELL')
  const pairs = buys.map((b, i) => ({ buy: b, sell: sells[i] }))

  const display = showAll ? pairs : pairs.slice(0, 15)

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Trade Log</h4>
        <span className="text-xs text-slate-500">{pairs.length} trades</span>
      </div>
      <div className="overflow-y-auto" style={{ maxHeight }}>
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-slate-500 border-b border-[#1e3a5f]">
              <th className="text-left pb-1 pr-3">#</th>
              <th className="text-left pb-1 pr-3">Entry</th>
              <th className="text-left pb-1 pr-3">Exit</th>
              <th className="text-right pb-1 pr-3">Buy $</th>
              <th className="text-right pb-1 pr-3">Sell $</th>
              <th className="text-right pb-1">P&L %</th>
            </tr>
          </thead>
          <tbody>
            {display.map(({ buy, sell }, i) => {
              const pnlPct = sell?.pnl_pct ?? null
              const isWin = pnlPct !== null && pnlPct > 0
              return (
                <tr
                  key={i}
                  className={`border-b border-[#0d1526] ${isWin ? 'hover:bg-green-950/20' : 'hover:bg-red-950/20'}`}
                >
                  <td className="py-1 pr-3 text-slate-600">{i + 1}</td>
                  <td className="py-1 pr-3 text-slate-400">{formatTs(buy.time)}</td>
                  <td className="py-1 pr-3 text-slate-400">{sell ? formatTs(sell.time) : 'Open'}</td>
                  <td className="py-1 pr-3 text-right text-slate-300">{fmtPrice(buy.price)}</td>
                  <td className="py-1 pr-3 text-right text-slate-300">{sell ? fmtPrice(sell.price) : '—'}</td>
                  <td
                    className={`py-1 text-right font-semibold ${
                      pnlPct === null ? 'text-slate-500' : isWin ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {pnlPct !== null ? `${pnlPct > 0 ? '+' : ''}${pnlPct}%` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {pairs.length > 15 && !showAll && (
          <button
            onClick={() => setShowAll(true)}
            className="mt-2 w-full text-xs text-slate-500 hover:text-blue-400 transition-colors"
          >
            Show all {pairs.length} trades ↓
          </button>
        )}
      </div>
    </div>
  )
}
