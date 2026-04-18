"use client"; // Bu satır şart, React hook'larını (useEffect/useState) kullanıyoruz.

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase'; // Senin supabase.ts dosyanı çağırıyoruz.

export default function MarketCard() {
    const [assets, setAssets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchMarketData() {
            // market_assets tablosundan verileri çekiyoruz
            const { data, error } = await supabase
                .from('market_assets')
                .select('*')
                .order('symbol', { ascending: true });

            if (error) {
                console.error('Veri çekme hatası:', error);
            } else if (data) {
                setAssets(data);
            }
            setLoading(false);
        }

        fetchMarketData();
    }, []);

    if (loading) return <div className="p-4 text-zinc-500 animate-pulse">Piyasalar yükleniyor...</div>;

    return (
        <div className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 italic">Global Market Watch</h2>
                <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-mono uppercase">Live</span>
            </div>

            <div className="space-y-3">
                {assets.length === 0 ? (
                    <p className="text-xs text-zinc-500">Henüz veri bulunamadı.</p>
                ) : (
                    assets.map((asset) => (
                        <div key={asset.id} className="flex justify-between items-center p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700">
                            <div>
                                <p className="font-bold text-zinc-900 dark:text-white leading-none">{asset.symbol}</p>
                                <p className="text-[10px] text-zinc-500 uppercase mt-1">{asset.name}</p>
                            </div>
                            <div className="text-right">
                                <p className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                                    ${asset.current_price?.toFixed(2)}
                                </p>
                                <p className="text-[10px] text-green-500 font-medium">
                                    Yield: %{asset.dividend_yield?.toFixed(2)}
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </div>
            <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <p className="text-[9px] text-zinc-400 text-center">Data fetched from Supabase Cloud</p>
            </div>
        </div>
    );
}