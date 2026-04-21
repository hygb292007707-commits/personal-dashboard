# PersonalOS — Personal Dashboard

A full-stack personal productivity and market dashboard built with Next.js 16. Combines real-time stock charts, task management, a finance tracker, and a calendar — all in a dark-themed single-page app with bilingual (TR/EN) support.

---

## Features

### Market & Stocks
- **Real-time price charts** via Yahoo Finance v8 API (server-side proxy with crumb/cookie auth)
- **Dynamic stock search** — search any ticker worldwide (BIST stocks auto-resolve with `.IS` suffix fallback)
- **TRY / USD currency toggle** with live USDTRY=X exchange rate fetched in parallel
- **Favorites bar** — persisted to `localStorage`, add/remove quick-access symbols
- **Time range selector** — 1W, 1M, 3M, 6M, 1Y, 2Y, or custom N days
- **OHLC data table** with open/close/high/low/volume and daily change %
- **Sidebar market watchlist** showing live prices for default tracked symbols

### Productivity
- **Tasks** — create, complete, and delete tasks stored in Supabase
- **Finance tracker** — log income/expense transactions with running balance
- **Calendar** — event planning with date navigation
- **Pomodoro timer** — customizable work/break presets

### UI / UX
- **Bilingual** — Turkish / English toggle, persisted to `localStorage`
- **Dark theme** with CSS custom properties (`var(--accent)`, `var(--surface)`, etc.)
- **Responsive sidebar** with live clock widget
- SSR-safe hydration (no client/server mismatch on localStorage-dependent state)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2 (App Router) |
| UI | React 19, Tailwind CSS 4 |
| Charts | Recharts 3 |
| Language | TypeScript 5 |
| Database | Supabase (PostgreSQL + RLS) |
| Market Data | Yahoo Finance v8 (unofficial API) |
| State | React Context (language), localStorage (favorites, language pref) |

---

## Setup

### 1. Clone & install

```bash
git clone https://github.com/hygb292007707-commits/personal-dashboard.git
cd personal-dashboard
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

> The anon key is safe to expose in the browser — Supabase security is enforced via Row Level Security policies on the database side.

### 3. Supabase tables

Run the following SQL in your Supabase SQL editor:

```sql
-- Tasks
create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text default 'todo',
  created_at timestamptz default now()
);

-- Finance transactions
create table transactions (
  id uuid primary key default gen_random_uuid(),
  description text,
  amount numeric not null,
  type text check (type in ('income', 'expense')),
  created_at timestamptz default now()
);

-- Timer presets
create table timer_presets (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  work_minutes integer not null,
  break_minutes integer not null
);

-- Enable RLS (add your own policies as needed)
alter table tasks enable row level security;
alter table transactions enable row level security;
alter table timer_presets enable row level security;
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
app/
  api/stocks/route.ts     # Yahoo Finance proxy (crumb auth, USDTRY rate, symbol resolution)
  stocks/page.tsx         # Full market analysis page
  clock/page.tsx          # Fullscreen clock
  layout.tsx              # Root layout with LanguageProvider
  page.tsx                # Dashboard entry point
components/
  DashboardClient.tsx     # Main app shell (tabs, sidebar, quick-add)
  Sidebar.tsx             # Navigation + live clock + market watchlist
  MarketCard.tsx          # Sidebar price widget
  FinanceTab.tsx
  TasksTab.tsx
  CalendarTab.tsx
  TimerTab.tsx
lib/
  config/stocks.ts        # DEFAULT_TRACKED_STOCKS list
  dictionaries.ts         # TR/EN translation dictionaries
  hooks/
    LanguageContext.tsx   # React Context for i18n
  supabase.ts             # Supabase client
.env.example              # Environment variable template
```

---

## Security Notes

- `.env.local` is git-ignored and never committed
- All market data fetches go through a server-side Next.js API route — Yahoo Finance credentials (crumb/cookie) are never exposed to the browser
- User input (ticker symbols) is sanitized server-side: `replace(/[^A-Z0-9.=\-]/g, '')`
- Supabase anon key is intentionally public; data is protected by RLS policies

---

## License

MIT
