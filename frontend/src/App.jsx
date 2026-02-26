import { useState, useEffect, useCallback } from 'react'
import { fetchStrategies, runBacktest, compareStrategies } from './api/client'
import MainChart from './components/MainChart'
import OscillatorChart from './components/OscillatorChart'
import EquityChart from './components/EquityChart'
import MetricsPanel from './components/MetricsPanel'
import TradeList from './components/TradeList'
import Sidebar from './components/Sidebar'
import { Activity, GitCompare, AlertCircle, Bitcoin, Wifi, WifiOff } from 'lucide-react'

const DEFAULT_TIMEFRAME = '1d'
const DEFAULT_PERIOD = '1y'
const DEFAULT_CAPITAL = 10000

export default function App() {
  const [mode, setMode] = useState('single') // 'single' | 'compare'
  const [strategies, setStrategies] = useState([])
  const [backendOk, setBackendOk] = useState(null)

  // Strategy 1
  const [strategy1, setStrategy1] = useState('sma_crossover')
  const [params1, setParams1] = useState({})
  const [result1, setResult1] = useState(null)
  const [loading1, setLoading1] = useState(false)
  const [error1, setError1] = useState(null)

  // Strategy 2 (compare)
  const [strategy2, setStrategy2] = useState('rsi')
  const [params2, setParams2] = useState({})
  const [result2, setResult2] = useState(null)
  const [loading2, setLoading2] = useState(false)
  const [error2, setError2] = useState(null)

  // Shared settings
  const [timeframe, setTimeframe] = useState(DEFAULT_TIMEFRAME)
  const [period, setPeriod] = useState(DEFAULT_PERIOD)
  const [initialCapital, setInitialCapital] = useState(DEFAULT_CAPITAL)

  // Load strategies list
  useEffect(() => {
    fetchStrategies()
      .then((list) => {
        setStrategies(list)
        setBackendOk(true)
      })
      .catch(() => setBackendOk(false))
  }, [])

  const handleParamChange1 = useCallback((key, val) => {
    setParams1((prev) => ({ ...prev, [key]: val }))
  }, [])

  const handleParamChange2 = useCallback((key, val) => {
    setParams2((prev) => ({ ...prev, [key]: val }))
  }, [])

  const runSingle = useCallback(async () => {
    if (!strategy1) return
    setLoading1(true)
    setError1(null)
    try {
      const strat = strategies.find((s) => s.id === strategy1)
      const mergedParams = { ...(strat?.default_params || {}), ...params1 }
      const res = await runBacktest({ strategy: strategy1, timeframe, period, params: mergedParams, initialCapital })
      setResult1(res)
      setResult2(null)
    } catch (e) {
      setError1(e.response?.data?.detail || e.message || 'Backtest failed')
    } finally {
      setLoading1(false)
    }
  }, [strategy1, params1, timeframe, period, initialCapital, strategies])

  const runCompare = useCallback(async () => {
    if (!strategy1 || !strategy2) return
    setLoading1(true)
    setLoading2(true)
    setError1(null)
    setError2(null)
    try {
      const s1 = strategies.find((s) => s.id === strategy1)
      const s2 = strategies.find((s) => s.id === strategy2)
      const mp1 = { ...(s1?.default_params || {}), ...params1 }
      const mp2 = { ...(s2?.default_params || {}), ...params2 }
      const res = await compareStrategies({
        strategy1,
        strategy2,
        timeframe,
        period,
        params1: mp1,
        params2: mp2,
        initialCapital,
      })
      setResult1(res.strategy1)
      setResult2(res.strategy2)
    } catch (e) {
      const msg = e.response?.data?.detail || e.message || 'Compare failed'
      setError1(msg)
      setError2(msg)
    } finally {
      setLoading1(false)
      setLoading2(false)
    }
  }, [strategy1, strategy2, params1, params2, timeframe, period, initialCapital, strategies])

  const hasOscillators = result1
    ? Object.values(result1.indicators || {}).some((v) => v.type === 'oscillator' || v.type === 'histogram')
    : false

  const mainHeight = hasOscillators ? 380 : 460
  const oscHeight = 140
  const eqHeight = 130

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#070b14]">
      {/* ── Header ── */}
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-[#1e3a5f] bg-[#0d1526] flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bitcoin size={20} className="text-amber-400" />
          <span className="font-bold text-sm text-slate-100 tracking-tight">BTC Backtest Lab</span>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center bg-[#070b14] border border-[#1e3a5f] rounded-lg p-0.5 ml-4">
          <button
            onClick={() => setMode('single')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${
              mode === 'single'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Activity size={12} />
            Single
          </button>
          <button
            onClick={() => setMode('compare')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${
              mode === 'compare'
                ? 'bg-purple-600 text-white shadow'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <GitCompare size={12} />
            Compare
          </button>
        </div>

        {/* Status indicators */}
        <div className="ml-auto flex items-center gap-3">
          {backendOk === false && (
            <div className="flex items-center gap-1.5 text-xs text-red-400">
              <WifiOff size={13} /> Backend offline — start the Python server
            </div>
          )}
          {backendOk === true && (
            <div className="flex items-center gap-1.5 text-xs text-green-500">
              <Wifi size={13} /> Connected
            </div>
          )}
          <span className="text-xs text-slate-600 font-mono">BTC-USD</span>
        </div>
      </header>

      {/* ── Main layout ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar 1 */}
        <aside className="w-56 flex-shrink-0 border-r border-[#1e3a5f] bg-[#0a1120] overflow-hidden flex flex-col">
          <Sidebar
            strategies={strategies}
            selectedStrategy={strategy1}
            onStrategyChange={(v) => { setStrategy1(v); setParams1({}) }}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
            period={period}
            onPeriodChange={setPeriod}
            params={params1}
            onParamChange={handleParamChange1}
            initialCapital={initialCapital}
            onCapitalChange={setInitialCapital}
            onRun={mode === 'single' ? runSingle : runCompare}
            loading={loading1}
            label={mode === 'compare' ? 'Strategy A' : 'Strategy'}
            accentColor="blue"
          />
        </aside>

        {/* Center: charts + metrics */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Error banner */}
          {(error1 || error2) && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-950/40 border-b border-red-800/40 text-xs text-red-300 flex-shrink-0">
              <AlertCircle size={13} />
              {error1 || error2}
            </div>
          )}

          {/* Loading shimmer */}
          {(loading1 || loading2) && (
            <div className="h-0.5 bg-[#0d1526] flex-shrink-0">
              <div className="h-full bg-gradient-to-r from-blue-600 to-purple-600 animate-pulse" />
            </div>
          )}

          {/* Chart area */}
          <div className="flex-shrink-0">
            <MainChart result={result1} height={mainHeight} />
            {hasOscillators && <OscillatorChart result={result1} height={oscHeight} />}
          </div>

          {/* Equity chart */}
          <EquityChart
            result={result1}
            compareResult={mode === 'compare' ? result2 : null}
            height={eqHeight}
          />

          {/* Metrics + Trade log */}
          <div className="flex-1 overflow-y-auto border-t border-[#1e3a5f] flex flex-col divide-y divide-[#1e3a5f]">
            <MetricsPanel result={result1} compareResult={mode === 'compare' ? result2 : null} />
            <div className="flex flex-1 divide-x divide-[#1e3a5f]">
              <div className="flex-1 min-w-0">
                <TradeList result={result1} maxHeight={180} />
              </div>
              {mode === 'compare' && result2 && (
                <div className="flex-1 min-w-0">
                  <TradeList result={result2} maxHeight={180} />
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Sidebar 2 — compare mode only */}
        {mode === 'compare' && (
          <aside className="w-56 flex-shrink-0 border-l border-[#1e3a5f] bg-[#0a1120] overflow-hidden flex flex-col">
            <Sidebar
              strategies={strategies}
              selectedStrategy={strategy2}
              onStrategyChange={(v) => { setStrategy2(v); setParams2({}) }}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              period={period}
              onPeriodChange={setPeriod}
              params={params2}
              onParamChange={handleParamChange2}
              initialCapital={initialCapital}
              onCapitalChange={setInitialCapital}
              onRun={runCompare}
              loading={loading2}
              label="Strategy B"
              accentColor="purple"
            />
          </aside>
        )}
      </div>
    </div>
  )
}
