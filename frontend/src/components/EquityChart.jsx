import { useEffect, useRef, useCallback } from 'react'
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts'

export default function EquityChart({ result, compareResult, height = 140 }) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)

  const destroy = useCallback(() => {
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!containerRef.current || !result) return
    destroy()

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { color: '#070b14' },
        textColor: '#94a3b8',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: '#0d1f38' },
        horzLines: { color: '#0d1f38' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#3b82f688', width: 1, style: LineStyle.Dashed },
        horzLine: { color: '#3b82f688', width: 1, style: LineStyle.Dashed },
      },
      rightPriceScale: { borderColor: '#1e3a5f' },
      timeScale: { borderColor: '#1e3a5f', timeVisible: true, secondsVisible: false },
    })
    chartRef.current = chart

    // Strategy equity curve
    const eqSeries = chart.addAreaSeries({
      lineColor: '#3b82f6',
      topColor: '#3b82f622',
      bottomColor: '#3b82f600',
      lineWidth: 2,
      title: result.strategy_name,
      priceLineVisible: false,
    })
    eqSeries.setData(result.equity_curve)

    // Buy & Hold curve
    if (result.bh_curve) {
      const bhSeries = chart.addLineSeries({
        color: '#f59e0b88',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        title: 'Buy & Hold',
        priceLineVisible: false,
      })
      bhSeries.setData(result.bh_curve)
    }

    // Compare strategy equity
    if (compareResult) {
      const cmpSeries = chart.addAreaSeries({
        lineColor: '#a855f7',
        topColor: '#a855f722',
        bottomColor: '#a855f700',
        lineWidth: 2,
        title: compareResult.strategy_name,
        priceLineVisible: false,
      })
      cmpSeries.setData(compareResult.equity_curve)
    }

    chart.timeScale().fitContent()

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth })
      }
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      destroy()
    }
  }, [result, compareResult, height])

  if (!result) return null

  return (
    <div className="w-full border-t border-[#1e3a5f]">
      <div className="px-3 py-1 flex gap-4 items-center bg-[#070b14]">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="inline-block w-3 h-0.5 rounded bg-blue-500" />
          {result.strategy_name}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="inline-block w-3 h-px rounded bg-amber-400 opacity-50" style={{ borderTop: '1px dashed #f59e0b' }} />
          Buy &amp; Hold
        </div>
        {compareResult && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="inline-block w-3 h-0.5 rounded bg-purple-500" />
            {compareResult.strategy_name}
          </div>
        )}
        <span className="ml-auto text-xs font-mono text-slate-500">Portfolio Value ($)</span>
      </div>
      <div ref={containerRef} className="w-full" style={{ height }} />
    </div>
  )
}
