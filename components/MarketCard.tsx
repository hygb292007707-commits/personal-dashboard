"use client";

import { useEffect, useState } from 'react';
import { DEFAULT_TRACKED_STOCKS } from '@/lib/config/stocks';
import { useLanguage } from '@/lib/hooks/LanguageContext';

const US_STOCKS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'JEPI', 'JEPQ', 'SPY', 'QQQ'];

type AssetRow = {
  symbol: string;
  price: number;
  changePercent: number;
};

export default function MarketCard() {
  const { t } = useLanguage();
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMarketData() {
      try {
        const results = await Promise.all(
          DEFAULT_TRACKED_STOCKS.map(async (symbol) => {
            const res = await fetch(`/api/stocks?symbols=${symbol}&days=7`);
            if (!res.ok) return null;
            const json = await res.json();
            const rows: any[] = json.data ?? [];
            const last = rows[rows.length - 1];
            if (!last) return null;
            return { symbol, price: last.close, changePercent: last.changePercent ?? 0 } as AssetRow;
          })
        );
        setAssets(results.filter(Boolean) as AssetRow[]);
      } catch (err) {
        console.error('Fetch error:', err);
      }
      setLoading(false);
    }
    fetchMarketData();
  }, []);

  if (loading) return <div className="p-4 text-zinc-500 animate-pulse">{t.loadingMarkets}</div>;

  return (
    <div className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 italic">Global Market Watch</h2>
        <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-mono uppercase">Live</span>
      </div>

      <div className="space-y-3">
        {assets.length === 0 ? (
          <p className="text-xs text-zinc-500">{t.noData}</p>
        ) : (
          assets.map((asset) => {
            const currencySymbol = US_STOCKS.includes(asset.symbol) ? '$' : '₺';
            return (
              <div key={asset.symbol} className="flex justify-between items-center p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700">
                <p className="font-bold text-zinc-900 dark:text-white leading-none">{asset.symbol}</p>
                <div className="text-right">
                  <p className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                    {currencySymbol}{asset.price.toFixed(2)}
                  </p>
                  <p className={`text-[10px] font-medium ${asset.changePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {asset.changePercent >= 0 ? '▲' : '▼'} {Math.abs(asset.changePercent).toFixed(2)}%
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
        <p className="text-[9px] text-zinc-400 text-center">Data fetched from Yahoo Finance via Custom API</p>
      </div>
    </div>
  );
}
