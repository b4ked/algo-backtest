import { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { searchSymbols } from '../api/client'

const TYPE_LABELS = {
  EQUITY: 'Stock',
  ETF: 'ETF',
  MUTUALFUND: 'Fund',
  CRYPTOCURRENCY: 'Crypto',
  CURRENCY: 'FX',
  INDEX: 'Index',
  FUTURE: 'Future',
}

export default function SymbolSearch({ symbol, onSymbolChange }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const inputRef = useRef(null)
  const containerRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
        setResults([])
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const data = await searchSymbols(query.trim())
        setResults(data)
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  function handleOpen() {
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 30)
  }

  function handleSelect(result) {
    onSymbolChange(result.symbol)
    setOpen(false)
    setQuery('')
    setResults([])
  }

  const showDropdown = open && query.trim().length > 0

  return (
    <div ref={containerRef} className="relative">
      {!open ? (
        <button
          onClick={handleOpen}
          title="Search symbol"
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#0d1526] border border-[#1e3a5f] rounded-lg text-xs font-mono text-slate-300 hover:border-blue-500 hover:text-blue-400 transition-all"
        >
          <Search size={11} />
          {symbol}
        </button>
      ) : (
        <div className="flex items-center gap-1">
          <div className="relative">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={symbol}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setOpen(false); setQuery(''); setResults([]) }
              }}
              className="w-40 bg-[#0d1526] border border-blue-500 rounded-lg pl-6 pr-2 py-1.5 text-xs font-mono text-slate-200 focus:outline-none placeholder:text-slate-600"
            />
          </div>
          <button
            onClick={() => { setOpen(false); setQuery(''); setResults([]) }}
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Results dropdown */}
      {showDropdown && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-[#0d1526] border border-[#1e3a5f] rounded-lg shadow-2xl z-50 overflow-hidden">
          {searching && (
            <div className="px-3 py-2.5 text-xs text-slate-500">Searching…</div>
          )}
          {!searching && results.length === 0 && (
            <div className="px-3 py-2.5 text-xs text-slate-500">No results for "{query}"</div>
          )}
          {results.map((r) => (
            <button
              key={r.symbol}
              onClick={() => handleSelect(r)}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-[#162035] transition-colors text-left border-b border-[#1e3a5f] last:border-0"
            >
              <div className="min-w-0">
                <div className="text-xs font-mono font-bold text-slate-200">{r.symbol}</div>
                <div className="text-xs text-slate-500 truncate max-w-[200px]">{r.name}</div>
              </div>
              <div className="text-right ml-2 flex-shrink-0">
                <div className="text-xs text-slate-600">{r.exchange}</div>
                <div className="text-xs text-blue-600">{TYPE_LABELS[r.type] || r.type}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
