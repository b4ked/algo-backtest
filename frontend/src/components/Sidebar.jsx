import { useEffect } from 'react'
import { TrendingUp, Clock, Calendar, DollarSign, Play, RefreshCw, ChevronDown } from 'lucide-react'

const TIMEFRAMES = [
  { value: '5m',  label: '5m',  maxLookbackDays: 59 },
  { value: '15m', label: '15m', maxLookbackDays: 59 },
  { value: '1h',  label: '1H',  maxLookbackDays: 729 },
  { value: '4h',  label: '4H',  maxLookbackDays: 729 },
  { value: '1d',  label: '1D',  maxLookbackDays: 10000 },
  { value: '1w',  label: '1W',  maxLookbackDays: 10000 },
]

function getDateStr(daysAgo) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().split('T')[0]
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function numInput(value, onChange, info) {
  return (
    <input
      type="number"
      value={value}
      min={info?.min}
      max={info?.max}
      step={info?.step ?? 1}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-[#0d1526] border border-[#1e3a5f] rounded px-2 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500 transition-colors"
    />
  )
}

function renderParamInput(value, defaultVal, info, onChange) {
  const current = value ?? defaultVal
  const type = info?.type ?? 'number'

  if (type === 'select') {
    return (
      <div className="relative">
        <select
          value={current}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-[#0d1526] border border-[#1e3a5f] rounded px-2 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500 transition-colors pr-6 cursor-pointer"
        >
          {(info.options || []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
      </div>
    )
  }

  if (type === 'text') {
    return (
      <input
        type="text"
        value={current}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#0d1526] border border-[#1e3a5f] rounded px-2 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500 transition-colors"
      />
    )
  }

  return numInput(current, onChange, info)
}

export default function Sidebar({
  strategies,
  selectedStrategy,
  onStrategyChange,
  timeframe,
  onTimeframeChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  params,
  onParamChange,
  initialCapital,
  onCapitalChange,
  onRun,
  loading,
  label = 'Strategy',
  accentColor = 'blue',
}) {
  const strategy = strategies?.find((s) => s.id === selectedStrategy)
  const tfConfig = TIMEFRAMES.find((t) => t.value === timeframe)
  const maxLookbackDays = tfConfig?.maxLookbackDays ?? 10000
  const minStartDate = getDateStr(maxLookbackDays)

  // Clamp start date when timeframe changes to a more restricted one
  useEffect(() => {
    if (startDate && startDate < minStartDate) {
      onStartDateChange(minStartDate)
    }
  }, [timeframe]) // eslint-disable-line react-hooks/exhaustive-deps

  const accent = accentColor === 'purple' ? 'border-purple-500 text-purple-400' : 'border-blue-500 text-blue-400'
  const btnColor = accentColor === 'purple' ? 'bg-purple-600 hover:bg-purple-500' : 'bg-blue-600 hover:bg-blue-500'

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      {/* Label */}
      <div className={`text-xs font-bold uppercase tracking-widest ${accentColor === 'purple' ? 'text-purple-400' : 'text-blue-400'}`}>
        {label}
      </div>

      {/* Strategy selector */}
      <div className="space-y-1">
        <label className="text-xs text-slate-500 flex items-center gap-1">
          <TrendingUp size={11} /> Strategy
        </label>
        <div className="relative">
          <select
            value={selectedStrategy || ''}
            onChange={(e) => onStrategyChange(e.target.value)}
            className="w-full appearance-none bg-[#0d1526] border border-[#1e3a5f] rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 pr-8 transition-colors cursor-pointer"
          >
            <option value="">Select strategy…</option>
            {(strategies || []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        </div>
        {strategy && (
          <p className="text-xs text-slate-500 leading-relaxed mt-1">{strategy.description}</p>
        )}
      </div>

      {/* Timeframe */}
      <div className="space-y-1">
        <label className="text-xs text-slate-500 flex items-center gap-1">
          <Clock size={11} /> Timeframe
        </label>
        <div className="flex flex-wrap gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => onTimeframeChange(tf.value)}
              className={`px-2.5 py-1 text-xs rounded border transition-all font-mono ${
                timeframe === tf.value
                  ? `${accent} bg-blue-950/30`
                  : 'border-[#1e3a5f] text-slate-500 hover:border-slate-500 hover:text-slate-300'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Date Range */}
      <div className="space-y-2">
        <label className="text-xs text-slate-500 flex items-center gap-1">
          <Calendar size={11} /> Date Range
        </label>
        <div className="space-y-1.5">
          <div className="space-y-0.5">
            <span className="text-xs text-slate-600">Start</span>
            <input
              type="date"
              value={startDate}
              min={minStartDate}
              max={endDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              style={{ colorScheme: 'dark' }}
              className="w-full bg-[#0d1526] border border-[#1e3a5f] rounded px-2 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
            />
          </div>
          <div className="space-y-0.5">
            <span className="text-xs text-slate-600">End</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={todayStr()}
              onChange={(e) => onEndDateChange(e.target.value)}
              style={{ colorScheme: 'dark' }}
              className="w-full bg-[#0d1526] border border-[#1e3a5f] rounded px-2 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Capital */}
      <div className="space-y-1">
        <label className="text-xs text-slate-500 flex items-center gap-1">
          <DollarSign size={11} /> Initial Capital
        </label>
        <input
          type="number"
          value={initialCapital}
          min={100}
          step={1000}
          onChange={(e) => onCapitalChange(Number(e.target.value))}
          className="w-full bg-[#0d1526] border border-[#1e3a5f] rounded px-2 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      {/* Strategy params */}
      {strategy && Object.keys(strategy.default_params || {}).length > 0 && (
        <div className="space-y-2">
          <label className="text-xs text-slate-500 uppercase tracking-wider">Parameters</label>
          <div className="space-y-2">
            {Object.entries(strategy.default_params).map(([key, defaultVal]) => {
              const info = strategy.param_info?.[key] || {}
              return (
                <div key={key} className="space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-400">{info.label || key}</span>
                    <span className="text-xs font-mono text-slate-300">{params?.[key] ?? defaultVal}</span>
                  </div>
                  {renderParamInput(
                    params?.[key],
                    defaultVal,
                    info,
                    (v) => {
                      const isStr = info?.type === 'select' || info?.type === 'text'
                      onParamChange(key, isStr ? v : Number(v))
                    }
                  )}
                </div>
              )
            })}
          </div>
          <button
            onClick={() => {
              if (strategy) {
                Object.entries(strategy.default_params).forEach(([k, v]) => onParamChange(k, v))
              }
            }}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Reset to defaults
          </button>
        </div>
      )}

      {/* Run button */}
      <button
        onClick={onRun}
        disabled={!selectedStrategy || loading}
        className={`mt-auto w-full flex items-center justify-center gap-2 py-2.5 rounded text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed ${btnColor}`}
      >
        {loading ? (
          <>
            <RefreshCw size={14} className="animate-spin" />
            Running…
          </>
        ) : (
          <>
            <Play size={14} />
            Run Backtest
          </>
        )}
      </button>
    </div>
  )
}
