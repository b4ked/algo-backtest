import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchStrategies, runSmartSearch } from "./api";

const TIMEFRAMES = ["5m", "15m", "1h", "4h", "1d", "1w"];
const LOOKBACK_UNITS = ["days", "months", "years"];
const STEP_SCALE_OPTIONS = [1, 2, 5, 10, 20, 50];
const TOP_N_OPTIONS = [50, 100, 200, 500, "all"];

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatPct(value) {
  const numeric = Number(value || 0);
  const sign = numeric > 0 ? "+" : "";
  return `${sign}${numeric.toFixed(2)}%`;
}

function formatParams(params) {
  const keys = Object.keys(params || {});
  if (keys.length === 0) return "default";
  return keys.map((key) => `${key}: ${params[key]}`).join(" | ");
}

function toTitle(text) {
  return text
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function App() {
  const [strategies, setStrategies] = useState([]);
  const [selectedStrategies, setSelectedStrategies] = useState([]);
  const [loadingStrategies, setLoadingStrategies] = useState(true);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [error, setError] = useState("");
  const [searchResponse, setSearchResponse] = useState(null);
  const [selectedRank, setSelectedRank] = useState(1);
  const [form, setForm] = useState({
    timeframe: "1d",
    lookbackValue: 12,
    lookbackUnit: "months",
    initialCapital: 10000,
    stepScale: 10,
    autoScaleSteps: true,
    maxCombinationsPerStrategy: 1200,
    topN: 200,
  });

  function getErrorMessage(err, fallbackText) {
    if (err?.response?.data?.detail) {
      return err.response.data.detail;
    }
    if (String(err?.message || "").toLowerCase() === "network error") {
      return "Cannot reach Smart Search backend. Start it with ./start-smart-search.sh and confirm http://localhost:8001/api/health works.";
    }
    return err?.message || fallbackText;
  }

  useEffect(() => {
    async function loadStrategies() {
      try {
        setLoadingStrategies(true);
        const data = await fetchStrategies();
        setStrategies(data);
        setSelectedStrategies(data.map((item) => item.id));
      } catch (err) {
        setError(getErrorMessage(err, "Failed to load strategies."));
      } finally {
        setLoadingStrategies(false);
      }
    }

    loadStrategies();
  }, []);

  const rankedResults = searchResponse?.results ?? [];
  const selectedResult = rankedResults.find((item) => item.rank === selectedRank) || rankedResults[0];
  const bestResult = rankedResults[0];
  const meta = searchResponse?.meta;

  const chartData = useMemo(
    () =>
      rankedResults.slice(0, 12).map((item) => ({
        label: `#${item.rank} ${item.strategy_name}`,
        totalReturn: item.metrics.total_return,
      })),
    [rankedResults]
  );

  function toggleStrategy(strategyId) {
    setSelectedStrategies((prev) =>
      prev.includes(strategyId) ? prev.filter((id) => id !== strategyId) : [...prev, strategyId]
    );
  }

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (selectedStrategies.length === 0) {
      setError("Select at least one strategy.");
      return;
    }

    const payload = {
      strategies: selectedStrategies,
      timeframe: form.timeframe,
      lookback_value: Number(form.lookbackValue),
      lookback_unit: form.lookbackUnit,
      initial_capital: Number(form.initialCapital),
      step_scale: Number(form.stepScale),
      auto_scale_steps: Boolean(form.autoScaleSteps),
      max_combinations_per_strategy: Number(form.maxCombinationsPerStrategy),
      top_n: form.topN === "all" ? null : Number(form.topN),
    };

    try {
      setLoadingSearch(true);
      const data = await runSmartSearch(payload);
      setSearchResponse(data);
      setSelectedRank(1);
    } catch (err) {
      setError(getErrorMessage(err, "Search request failed."));
    } finally {
      setLoadingSearch(false);
    }
  }

  return (
    <main className="app-shell">
      <div className="page-glow page-glow-left" />
      <div className="page-glow page-glow-right" />

      <header className="hero">
        <p className="hero-kicker">Smart Algo Search</p>
        <h1>Find the best strategy configuration by profitability</h1>
        <p className="hero-subtitle">
          Run an exhaustive grid search across strategy parameters and rank every tested configuration.
        </p>
      </header>

      <section className="panel">
        <form onSubmit={handleSubmit}>
          <div className="control-grid">
            <label>
              <span>Candle timeframe</span>
              <select value={form.timeframe} onChange={(e) => updateForm("timeframe", e.target.value)}>
                {TIMEFRAMES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Lookback value</span>
              <input
                type="number"
                min={1}
                value={form.lookbackValue}
                onChange={(e) => updateForm("lookbackValue", e.target.value)}
                required
              />
            </label>

            <label>
              <span>Lookback unit</span>
              <select value={form.lookbackUnit} onChange={(e) => updateForm("lookbackUnit", e.target.value)}>
                {LOOKBACK_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {toTitle(unit)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Starting capital (USD)</span>
              <input
                type="number"
                min={100}
                step={100}
                value={form.initialCapital}
                onChange={(e) => updateForm("initialCapital", e.target.value)}
                required
              />
            </label>

            <label>
              <span>Base step scale</span>
              <select value={form.stepScale} onChange={(e) => updateForm("stepScale", e.target.value)}>
                {STEP_SCALE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    x{option}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Max combos per strategy</span>
              <input
                type="number"
                min={1}
                value={form.maxCombinationsPerStrategy}
                onChange={(e) => updateForm("maxCombinationsPerStrategy", e.target.value)}
                required
              />
            </label>

            <label>
              <span>Returned results</span>
              <select value={form.topN} onChange={(e) => updateForm("topN", e.target.value)}>
                {TOP_N_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === "all" ? "All" : option}
                  </option>
                ))}
              </select>
            </label>

            <label className="checkbox-label">
              <span>Auto-scale steps if combos are too large</span>
              <input
                type="checkbox"
                checked={form.autoScaleSteps}
                onChange={(e) => updateForm("autoScaleSteps", e.target.checked)}
              />
            </label>
          </div>

          <div className="strategy-header">
            <h2>Strategies</h2>
            <div className="strategy-actions">
              <button type="button" onClick={() => setSelectedStrategies(strategies.map((item) => item.id))}>
                Select all
              </button>
              <button type="button" onClick={() => setSelectedStrategies([])}>
                Clear
              </button>
            </div>
          </div>

          <div className="strategy-grid">
            {loadingStrategies && <p className="muted-text">Loading strategies...</p>}
            {!loadingStrategies &&
              strategies.map((strategy) => (
                <label key={strategy.id} className="strategy-card">
                  <input
                    type="checkbox"
                    checked={selectedStrategies.includes(strategy.id)}
                    onChange={() => toggleStrategy(strategy.id)}
                  />
                  <div>
                    <strong>{strategy.name}</strong>
                    <p>{strategy.description}</p>
                  </div>
                </label>
              ))}
          </div>

          <div className="submit-row">
            <button className="run-button" type="submit" disabled={loadingSearch}>
              {loadingSearch ? "Running search..." : "Run Smart Search"}
            </button>
            <p className="muted-text">
              Large sweeps can take time. Use higher step scale for faster but coarser coverage.
            </p>
          </div>
        </form>
      </section>

      {error && <section className="panel error-panel">{error}</section>}

      {meta && bestResult && (
        <section className="summary-grid">
          <article className="panel summary-card">
            <h3>Best return</h3>
            <p className="value">{formatPct(bestResult.metrics.total_return)}</p>
            <p>{bestResult.strategy_name}</p>
          </article>
          <article className="panel summary-card">
            <h3>Best final capital</h3>
            <p className="value">{formatMoney(bestResult.metrics.final_capital)}</p>
            <p>From {formatMoney(meta.initial_capital)}</p>
          </article>
          <article className="panel summary-card">
            <h3>Total runs</h3>
            <p className="value">{meta.total_runs}</p>
            <p>{meta.returned_runs} returned</p>
          </article>
          <article className="panel summary-card">
            <h3>Runtime</h3>
            <p className="value">{meta.duration_seconds}s</p>
            <p>
              {meta.lookback.value} {meta.lookback.unit}, {meta.timeframe}
            </p>
          </article>
        </section>
      )}

      {chartData.length > 0 && (
        <section className="panel">
          <h2>Top profitability ranking</h2>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="4 4" stroke="#1f2937" />
                <XAxis dataKey="label" tick={{ fill: "#d1d5db", fontSize: 11 }} interval={0} angle={-25} height={80} />
                <YAxis tick={{ fill: "#d1d5db", fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => `${Number(value).toFixed(2)}%`}
                  contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "10px" }}
                />
                <Bar dataKey="totalReturn" radius={[8, 8, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`${entry.label}-${index}`} fill={index < 3 ? "#f97316" : "#0ea5e9"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {meta?.strategy_summaries?.length > 0 && (
        <section className="panel">
          <h2>Strategy sweep diagnostics</h2>
          <div className="table-wrap">
            <table className="result-table compact-table">
              <thead>
                <tr>
                  <th>Strategy</th>
                  <th>Executed</th>
                  <th>Skipped invalid</th>
                  <th>Estimated combos</th>
                  <th>Applied step multiplier</th>
                </tr>
              </thead>
              <tbody>
                {meta.strategy_summaries.map((summary) => (
                  <tr key={summary.strategy_id}>
                    <td>{summary.strategy_name}</td>
                    <td>{summary.executed_runs}</td>
                    <td>{summary.skipped_invalid_combinations}</td>
                    <td>{summary.estimated_combinations}</td>
                    <td>x{summary.applied_step_multiplier}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {rankedResults.length > 0 && (
        <section className="panel">
          <h2>Ranked configurations</h2>
          <div className="table-wrap">
            <table className="result-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Strategy</th>
                  <th>Total return</th>
                  <th>Final capital</th>
                  <th>Sharpe</th>
                  <th>Max drawdown</th>
                  <th>Trades</th>
                  <th>Params</th>
                </tr>
              </thead>
              <tbody>
                {rankedResults.map((item) => (
                  <tr
                    key={`${item.strategy_id}-${item.rank}-${item.metrics.final_capital}`}
                    className={item.rank === selectedResult?.rank ? "active-row" : ""}
                    onClick={() => setSelectedRank(item.rank)}
                  >
                    <td>#{item.rank}</td>
                    <td>{item.strategy_name}</td>
                    <td className={item.metrics.total_return >= 0 ? "gain" : "loss"}>{formatPct(item.metrics.total_return)}</td>
                    <td>{formatMoney(item.metrics.final_capital)}</td>
                    <td>{item.metrics.sharpe_ratio}</td>
                    <td>{formatPct(-Math.abs(item.metrics.max_drawdown))}</td>
                    <td>{item.metrics.num_trades}</td>
                    <td>{formatParams(item.params)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {selectedResult && (
        <section className="panel detail-panel">
          <h2>
            Selected result: #{selectedResult.rank} {selectedResult.strategy_name}
          </h2>
          <div className="detail-grid">
            <div className="metric-box">
              <span>Total Return</span>
              <strong className={selectedResult.metrics.total_return >= 0 ? "gain" : "loss"}>
                {formatPct(selectedResult.metrics.total_return)}
              </strong>
            </div>
            <div className="metric-box">
              <span>Buy & Hold Return</span>
              <strong>{formatPct(selectedResult.metrics.buy_hold_return)}</strong>
            </div>
            <div className="metric-box">
              <span>Final Capital</span>
              <strong>{formatMoney(selectedResult.metrics.final_capital)}</strong>
            </div>
            <div className="metric-box">
              <span>Win Rate</span>
              <strong>{formatPct(selectedResult.metrics.win_rate)}</strong>
            </div>
            <div className="metric-box">
              <span>Profit Factor</span>
              <strong>{selectedResult.metrics.profit_factor}</strong>
            </div>
            <div className="metric-box">
              <span>Trades</span>
              <strong>{selectedResult.metrics.num_trades}</strong>
            </div>
          </div>
          <pre className="param-view">{JSON.stringify(selectedResult.params, null, 2)}</pre>
        </section>
      )}
    </main>
  );
}

export default App;
