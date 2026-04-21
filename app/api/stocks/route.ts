import { NextRequest, NextResponse } from "next/server";

let crumbCache: { crumb: string; cookie: string; expiresAt: number } | null = null;

async function getCrumb(): Promise<{ crumb: string; cookie: string }> {
  const now = Date.now();
  if (crumbCache && crumbCache.expiresAt > now) {
    return { crumb: crumbCache.crumb, cookie: crumbCache.cookie };
  }

  const consentRes = await fetch("https://fc.yahoo.com", {
    headers: { "User-Agent": "Mozilla/5.0" },
    redirect: "follow",
  });

  const rawCookie = consentRes.headers.get("set-cookie") ?? "";
  const cookie = rawCookie.split(",").map((c) => c.split(";")[0].trim()).filter((c) => c.length > 0).join("; ");

  const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
    headers: { "User-Agent": "Mozilla/5.0", Cookie: cookie },
  });

  if (!crumbRes.ok) throw new Error(`Crumb fetch failed: ${crumbRes.status}`);
  const crumb = await crumbRes.text();

  crumbCache = { crumb, cookie, expiresAt: now + 55 * 60 * 1000 };
  return { crumb, cookie };
}

async function fetchChart(symbol: string, range: string, crumb: string, cookie: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=1d&crumb=${crumb}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Cookie: cookie }, cache: "no-store" });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.chart?.result?.[0] ? json : null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbolParam = searchParams.get("symbols")?.split(',')[0];
  const days = searchParams.get("days") || "30";

  if (!symbolParam) return NextResponse.json({ error: "Symbol required" }, { status: 400 });

  // Whitelist valid ticker characters to prevent URL injection into the Yahoo Finance request
  const rawSymbol = symbolParam.trim().toUpperCase().replace(/[^A-Z0-9.=\-]/g, '');
  if (!rawSymbol) return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });

  let range = "1mo";
  const d = parseInt(days);
  if (d <= 7) range = "5d";
  else if (d <= 30) range = "1mo";
  else if (d <= 90) range = "3mo";
  else if (d <= 365) range = "1y";
  else range = "max";

  try {
    const { crumb, cookie } = await getCrumb();
    const rateUrl = `https://query1.finance.yahoo.com/v8/finance/chart/USDTRY=X?range=5d&interval=1d&crumb=${crumb}`;

    // Try bare symbol first; fall back to BIST .IS suffix if Yahoo returns no data.
    // Explicit suffixes (GARAN.IS, BAS.F) are respected as-is. Rate fetch runs in parallel.
    const useSuffix = rawSymbol.includes('.');

    const [firstJson, rateRes] = await Promise.all([
      fetchChart(rawSymbol, range, crumb, cookie),
      fetch(rateUrl, { headers: { "User-Agent": "Mozilla/5.0", Cookie: cookie }, cache: "no-store" }),
    ]);

    let chartJson = firstJson;
    let resolvedSymbol = rawSymbol;

    if (!chartJson && !useSuffix) {
      const bistSymbol = `${rawSymbol}.IS`;
      chartJson = await fetchChart(bistSymbol, range, crumb, cookie);
      if (chartJson) resolvedSymbol = bistSymbol;
    }

    if (!chartJson) throw new Error(`Symbol not found: ${rawSymbol}`);

    const result = chartJson.chart.result[0];
    const timestamps = result.timestamp;
    const quotes = result.indicators.quote[0];

    const rateJson = await rateRes.json();
    const rateResult = rateJson.chart?.result?.[0];
    const rateCloses: (number | null)[] = rateResult?.indicators?.quote?.[0]?.close ?? [];
    const exchangeRate = rateCloses.filter(Boolean).at(-1) ?? 1;

    const formatted = timestamps.map((ts: number, i: number) => ({
      date: new Date(ts * 1000).toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' }),
      open: quotes.open[i] || quotes.close[i],
      close: quotes.close[i],
      high: quotes.high[i],
      low: quotes.low[i],
      volume: result.indicators.quote[0].volume[i] || 0,
      changePercent: i > 0 ? ((quotes.close[i] - quotes.close[i - 1]) / quotes.close[i - 1]) * 100 : 0
    })).filter((item: any) => item.close !== null);

    return NextResponse.json({ data: formatted, exchangeRate, resolvedSymbol });
  } catch (err: any) {
    console.error("[stocks] Chart error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}