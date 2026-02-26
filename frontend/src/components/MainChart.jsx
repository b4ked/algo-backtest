import { useEffect, useRef, useCallback } from 'react'
import { createChart, CrosshairMode, LineStyle, PriceScaleMode } from 'lightweight-charts'

const PRICE_INDICATOR_COLORS = {
  'SMA Fast': '#3b82f6',
  'SMA Slow': '#f59e0b',
  'EMA Fast': '#a855f7',
  'EMA Slow': '#ec4899',
  'BB Upper': '#14b8a6',
  'BB Middle': '#6b7280',
  'BB Lower': '#14b8a6',
  'SuperTrend': '#eab308',
  'Rolling Mean': '#14b8a6',
  'Donchian High': '#22c55e',
  'Donchian Low': '#ef4444',
}

const LINE_STYLES = {
  0: LineStyle.Solid,
  1: LineStyle.Dotted,
  2: LineStyle.Dashed,
  3: LineStyle.LargeDashed,
}

export default function MainChart({ result, height = 460 }) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const seriesRef = useRef([])

  const destroy = useCallback(() => {
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
    }
    seriesRef.current = []
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
        fontSize: 11,
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
      rightPriceScale: {
        borderColor: '#1e3a5f',
        mode: PriceScaleMode.Normal,
      },
      timeScale: {
        borderColor: '#1e3a5f',
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 6,
      },
    })
    chartRef.current = chart

    // Candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })
    candleSeries.setData(result.candles)
    seriesRef.current.push(candleSeries)

    // Price-level indicators
    const priceIndicators = Object.entries(result.indicators || {}).filter(
      ([, v]) => v.type === 'price'
    )
    for (const [name, info] of priceIndicators) {
      const color = info.color || PRICE_INDICATOR_COLORS[name] || '#64748b'
      const lineSeries = chart.addLineSeries({
        color,
        lineWidth: info.lineWidth || 1,
        lineStyle: LINE_STYLES[info.lineStyle ?? 0] ?? LineStyle.Solid,
        title: name,
        priceLineVisible: false,
        lastValueVisible: true,
      })
      lineSeries.setData(info.data)
      seriesRef.current.push(lineSeries)
    }

    // Trade markers
    const markers = (result.trades || []).map((t) => ({
      time: t.time,
      position: t.type === 'BUY' ? 'belowBar' : 'aboveBar',
      color: t.type === 'BUY' ? '#22c55e' : '#ef4444',
      shape: t.type === 'BUY' ? 'arrowUp' : 'arrowDown',
      text:
        t.type === 'BUY'
          ? `B $${t.price.toLocaleString()}`
          : `S $${t.price.toLocaleString()} (${t.pnl_pct > 0 ? '+' : ''}${t.pnl_pct ?? 0}%)`,
      size: 1,
    }))
    if (markers.length > 0) {
      candleSeries.setMarkers(markers)
    }

    // Fit content
    chart.timeScale().fitContent()

    // Resize observer
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
  }, [result, height])

  return (
    <div className="relative w-full" style={{ height }}>
      <div ref={containerRef} className="w-full h-full" />
      {!result && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
          Run a backtest to see the chart
        </div>
      )}
    </div>
  )
}
