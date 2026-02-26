import { useEffect, useRef, useCallback } from 'react'
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts'

export default function OscillatorChart({ result, height = 160 }) {
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

    const oscillators = Object.entries(result.indicators || {}).filter(
      ([, v]) => v.type === 'oscillator' || v.type === 'histogram'
    )
    if (oscillators.length === 0) return

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

    for (const [name, info] of oscillators) {
      if (info.type === 'histogram') {
        const hist = chart.addHistogramSeries({
          color: info.color || '#a855f7',
          title: name,
          priceLineVisible: false,
        })
        // Color histogram bars based on positive/negative
        const coloredData = info.data.map((d) => ({
          ...d,
          color: d.value >= 0 ? '#22c55e99' : '#ef444499',
        }))
        hist.setData(coloredData)
      } else {
        const line = chart.addLineSeries({
          color: info.color || '#94a3b8',
          lineWidth: info.lineWidth || 1,
          title: name,
          priceLineVisible: false,
          lastValueVisible: true,
        })
        line.setData(info.data)

        // Reference level lines
        if (info.levels) {
          for (const lvl of info.levels) {
            line.createPriceLine({
              price: lvl.value,
              color: lvl.color || '#ffffff33',
              lineWidth: 1,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: true,
              title: lvl.label || '',
            })
          }
        }
      }
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
  }, [result, height])

  const oscillators = result
    ? Object.entries(result.indicators || {}).filter(([, v]) => v.type === 'oscillator' || v.type === 'histogram')
    : []

  if (!result || oscillators.length === 0) return null

  return (
    <div className="w-full border-t border-[#1e3a5f]">
      <div className="px-3 py-1 flex gap-4 items-center bg-[#070b14]">
        {oscillators.map(([name, info]) => (
          <div key={name} className="flex items-center gap-1.5 text-xs text-slate-400">
            <span
              className="inline-block w-3 h-0.5 rounded"
              style={{ backgroundColor: info.color || '#94a3b8' }}
            />
            {name}
          </div>
        ))}
      </div>
      <div ref={containerRef} className="w-full" style={{ height }} />
    </div>
  )
}
