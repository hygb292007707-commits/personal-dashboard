'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { useLanguage } from '@/lib/hooks/LanguageContext';


async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  const res = await fetch(url);
  if ((res.status === 503 || res.status === 500) && retries > 0) {
    await new Promise((r) => setTimeout(r, 500));
    return fetchWithRetry(url, retries - 1);
  }
  return res;
}

function formatVolume(vol: number) {
  if (!vol) return 'N/A';
  if (vol >= 1_000_000_000) return (vol / 1_000_000_000).toFixed(1) + 'B';
  if (vol >= 1_000_000) return (vol / 1_000_000).toFixed(1) + 'M';
  if (vol >= 1_000) return (vol / 1_000).toFixed(1) + 'K';
  return vol.toString();
}

export default function StocksPage() {
  const [trackedStocks, setTrackedStocks] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem('trackedStocks');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [symbol, setSymbol] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [days, setDays] = useState(30);
  const [customDaysInput, setCustomDaysInput] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<'TRY' | 'USD'>('TRY');
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [resolvedSymbol, setResolvedSymbol] = useState('');
  const [mounted, setMounted] = useState(false);
  const { t, lang, toggleLanguage } = useLanguage();

  useEffect(() => {
    let active = true;

    if (!symbol) return;

    async function fetchHistorical() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchWithRetry(`/api/stocks?symbols=${symbol}&days=${days}`, 3);
        const json = await res.json();

        if (res.ok && Array.isArray(json.data)) {
          if (active) {
            setData(json.data);
            setExchangeRate(json.exchangeRate ?? 1);
            setResolvedSymbol(json.resolvedSymbol ?? symbol);
          }
        } else {
          if (active) {
            setError(json.error ?? t.fetchError);
            setData([]);
          }
        }
      } catch (err) {
        console.error('Fetch sırasında teknik hata oluştu:', err);
        if (active) setError(t.connectionError);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchHistorical();

    return () => { active = false; };
  }, [symbol, days]);

  useEffect(() => {
    setMounted(true);
    const saved = (() => {
      try {
        const raw = localStorage.getItem('trackedStocks');
        return raw ? (JSON.parse(raw) as string[]) : [];
      } catch {
        return [];
      }
    })();
    if (saved.length > 0) setSymbol(saved[0]);
  }, []);

  useEffect(() => {
    localStorage.setItem('trackedStocks', JSON.stringify(trackedStocks));
  }, [trackedStocks]);

  const handleCustomDaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const d = parseInt(customDaysInput, 10);
    if (!isNaN(d) && d > 0) {
      setDays(d);
      setCustomDaysInput('');
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const s = searchInput.trim().toUpperCase();
    if (s) {
      setSymbol(s);
      setSearchInput('');
    }
  };

  // resolvedSymbol tells us exactly which Yahoo symbol was matched (e.g. "GARAN.IS" vs "PLTR")
  // .IS suffix means BIST/TRY, anything else is treated as USD-denominated
  const isUSStock = resolvedSymbol ? !resolvedSymbol.endsWith('.IS') : true;
  const conversionFactor = (() => {
    if (currency === 'TRY' && isUSStock)  return exchangeRate;
    if (currency === 'USD' && !isUSStock) return 1 / exchangeRate;
    return 1;
  })();
  const currencySymbol = currency === 'TRY' ? '₺' : '$';
  const displayData = data.map(row => ({
    ...row,
    open:  row.open  * conversionFactor,
    close: row.close * conversionFactor,
    high:  row.high  * conversionFactor,
    low:   row.low   * conversionFactor,
  }));

  const startPrice = displayData[0]?.close ?? 0;
  const endPrice = displayData[displayData.length - 1]?.close ?? 0;
  const isPositive = endPrice >= startPrice;
  const strokeColor = isPositive ? '#10b981' : '#ef4444';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)', padding: '28px', display: 'flex', flexDirection: 'column' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <Link href="/" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
            {t.backToDashboard}
          </Link>
          <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-0.03em' }}>{t.marketAnalysis}</h1>
        </div>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', alignItems: 'center' }}>
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              style={{
                width: '190px',
                padding: '6px 10px',
                borderRadius: '8px 0 0 8px',
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--foreground)',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={!searchInput.trim()}
              style={{
                padding: '7px 12px',
                borderRadius: '0 8px 8px 0',
                border: '1px solid var(--border)',
                borderLeft: 'none',
                background: searchInput.trim() ? 'var(--accent)' : 'var(--surface-3)',
                color: searchInput.trim() ? '#fff' : 'var(--muted)',
                fontWeight: 700,
                fontSize: '1rem',
                cursor: searchInput.trim() ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
              }}
            >
              →
            </button>
          </form>

          <div style={{ display: 'flex', gap: '4px', background: 'var(--surface-2)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border)', flexWrap: 'wrap', minHeight: '36px', alignItems: 'center' }}>
            {!mounted ? (
              <div style={{ width: '180px', height: '24px', borderRadius: '6px', background: 'var(--surface-3)', opacity: 0.5 }} />
            ) : (
              <>
                {trackedStocks.map(s => (
                  <button
                    key={s}
                    onClick={() => setSymbol(s)}
                    style={{
                      padding: '6px 8px 6px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      background: symbol === s ? 'var(--accent)' : 'transparent',
                      color: symbol === s ? '#fff' : 'var(--muted-2)',
                      fontWeight: symbol === s ? 700 : 500,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: symbol === s ? '0 0 10px rgba(108,99,255,0.3)' : 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {s}
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setTrackedStocks(prev => prev.filter(x => x !== s));
                      }}
                      style={{
                        fontSize: '0.75rem',
                        lineHeight: 1,
                        opacity: 0.45,
                        padding: '1px 3px',
                        borderRadius: '3px',
                        cursor: 'pointer',
                      }}
                    >
                      ×
                    </span>
                  </button>
                ))}
                <button
                  onClick={() => {
                    if (!trackedStocks.includes(symbol)) {
                      setTrackedStocks(prev => [...prev, symbol]);
                    }
                  }}
                  disabled={trackedStocks.includes(symbol)}
                  title={trackedStocks.includes(symbol) ? t.alreadyInList : `${symbol} ${t.addToFavorites}`}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'transparent',
                    color: trackedStocks.includes(symbol) ? 'var(--border)' : 'var(--accent)',
                    fontWeight: 700,
                    fontSize: '1rem',
                    cursor: trackedStocks.includes(symbol) ? 'default' : 'pointer',
                    transition: 'all 0.2s',
                    lineHeight: 1,
                  }}
                >
                  +
                </button>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: '4px', background: 'var(--surface-2)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border)' }}>
            {[
              { label: '1W', value: 7 },
              { label: '1M', value: 30 },
              { label: '3M', value: 90 },
              { label: '1Y', value: 365 },
            ].map(tf => (
              <button
                key={tf.label}
                onClick={() => setDays(tf.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: days === tf.value ? 'var(--surface-3)' : 'transparent',
                  color: days === tf.value ? 'var(--foreground)' : 'var(--muted-2)',
                  fontWeight: days === tf.value ? 700 : 500,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {tf.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '4px', background: 'var(--surface-2)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border)' }}>
            {(['tr', 'en'] as const).map(l => (
              <button
                key={l}
                onClick={() => lang !== l && toggleLanguage()}
                style={{
                  padding: '6px 12px', borderRadius: '6px', border: 'none',
                  background: lang === l ? 'var(--surface-3)' : 'transparent',
                  color: lang === l ? 'var(--foreground)' : 'var(--muted-2)',
                  fontWeight: lang === l ? 700 : 500,
                  fontSize: '0.85rem',
                  cursor: lang === l ? 'default' : 'pointer',
                  transition: 'all 0.2s',
                  textTransform: 'uppercase',
                }}
              >
                {l}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '4px', background: 'var(--surface-2)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border)' }}>
            {(['TRY', 'USD'] as const).map(c => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: currency === c ? 'var(--surface-3)' : 'transparent',
                  color: currency === c ? 'var(--foreground)' : 'var(--muted-2)',
                  fontWeight: currency === c ? 700 : 500,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {c}
              </button>
            ))}
          </div>

          <form onSubmit={handleCustomDaySubmit} style={{ display: 'flex', alignItems: 'center' }}>
            <input
              type="number"
              placeholder={t.daysPlaceholder}
              value={customDaysInput}
              onChange={e => setCustomDaysInput(e.target.value)}
              style={{
                width: '70px',
                padding: '6px 10px',
                borderRadius: '8px 0 0 8px',
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--foreground)',
                fontSize: '0.85rem',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              disabled={!customDaysInput}
              style={{
                padding: '7px 12px',
                borderRadius: '0 8px 8px 0',
                border: '1px solid var(--border)',
                borderLeft: 'none',
                background: customDaysInput ? 'var(--accent)' : 'var(--surface-3)',
                color: customDaysInput ? '#fff' : 'var(--muted)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: customDaysInput ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s'
              }}
            >
              {t.go}
            </button>
          </form>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1 }}>
        {!symbol ? (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            minHeight: '400px',
          }}>
            <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📈</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, maxWidth: '320px', lineHeight: 1.5 }}>
                {t.emptyStateMessage}
              </div>
            </div>
          </div>
        ) : (<>
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '24px',
          height: '500px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                {resolvedSymbol || symbol}
                <span style={{ fontSize: '0.8rem', padding: '2px 6px', background: 'var(--surface-2)', borderRadius: '4px', color: 'var(--muted)', fontWeight: 500 }}>{t.liveData}</span>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                {error ? (
                  <span style={{ fontSize: '1rem', color: '#ef4444', fontWeight: 600 }}>{error}</span>
                ) : (
                  <>
                    {currencySymbol}{endPrice.toFixed(2)}
                    {data.length > 0 && (
                      <span style={{ fontSize: '1rem', fontWeight: 600, color: strokeColor, background: isPositive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', padding: '4px 8px', borderRadius: '8px' }}>
                        {isPositive ? '▲' : '▼'} {Math.abs(((endPrice - startPrice) / Math.max(startPrice, 1)) * 100).toFixed(2)}%
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
              {loading ? t.loadingDataDots : t.lastNDays.replace('{n}', String(days))}
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0 }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)' }}>
                {t.loading}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={displayData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={strokeColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="var(--muted)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={30}
                  />
                  <YAxis
                    domain={['auto', 'auto']}
                    stroke="var(--muted)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${currencySymbol}${value.toFixed(0)}`}
                  />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
                    itemStyle={{ color: 'var(--foreground)', fontWeight: 600 }}
                    labelStyle={{ color: 'var(--muted)', marginBottom: '4px' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="close"
                    name={t.closingPrice}
                    stroke={strokeColor}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorClose)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: '0.9rem' }}>
            {t.historicalData}
          </div>
          <div style={{ overflowX: 'auto', maxHeight: '500px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--surface)' }}>
                <tr style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
                  <th style={{ padding: '12px 20px', fontSize: '0.8rem' }}>{t.date}</th>
                  <th style={{ padding: '12px 20px', fontSize: '0.8rem' }}>{t.colVolume}</th>
                  <th style={{ padding: '12px 20px', fontSize: '0.8rem' }}>{t.colOpen}</th>
                  <th style={{ padding: '12px 20px', fontSize: '0.8rem' }}>{t.colClose}</th>
                  <th style={{ padding: '12px 20px', fontSize: '0.8rem' }}>{t.colChange}</th>
                </tr>
              </thead>
              <tbody>
                {[...displayData].reverse().map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 20px', fontSize: '0.85rem', color: 'var(--muted-2)' }}>{row.date}</td>
                    <td style={{ padding: '12px 20px', fontSize: '0.85rem', color: 'var(--muted)' }}>{formatVolume(row.volume)}</td>
                    <td style={{ padding: '12px 20px', fontSize: '0.85rem' }}>{currencySymbol}{row.open.toFixed(2)}</td>
                    <td style={{ padding: '12px 20px', fontSize: '0.85rem', fontWeight: 600 }}>{currencySymbol}{row.close.toFixed(2)}</td>
                    <td style={{ padding: '12px 20px', fontSize: '0.85rem', fontWeight: 600, color: (row.changePercent ?? 0) >= 0 ? '#10b981' : '#ef4444' }}>
                      {(row.changePercent ?? 0) >= 0 ? '+' : ''}{(row.changePercent ?? 0).toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>)}
      </div>
    </div>
  );
}