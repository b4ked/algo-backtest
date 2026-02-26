import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 60_000,
})

export async function fetchStrategies() {
  const { data } = await api.get('/strategies')
  return data.strategies
}

export async function runBacktest({ strategy, timeframe, period, params, initialCapital }) {
  const { data } = await api.post('/backtest', {
    strategy,
    timeframe,
    period,
    params,
    initial_capital: initialCapital,
  })
  return data
}

export async function compareStrategies({
  strategy1,
  strategy2,
  timeframe,
  period,
  params1,
  params2,
  initialCapital,
}) {
  const { data } = await api.post('/compare', {
    strategy1,
    strategy2,
    timeframe,
    period,
    params1,
    params2,
    initial_capital: initialCapital,
  })
  return data
}
