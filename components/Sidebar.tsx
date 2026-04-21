'use client';

import React from 'react';
import Link from 'next/link';
import MarketCard from './MarketCard';
import { useLanguage } from '@/lib/hooks/LanguageContext';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

// ─── SVG icons ────────────────────────────────────────────────────────────────

const DashboardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const TaskIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
  </svg>
);

const FinanceIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
  </svg>
);

const ClockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const StockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

// ─── Nav items (tab-based, within the main dashboard SPA) ─────────────────────


// ─── Live clock in sidebar header ────────────────────────────────────────────

function LiveClock() {
  const { lang } = useLanguage();
  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
  const [time, setTime] = React.useState<string | null>(null);
  const [date, setDate] = React.useState<string>('');

  React.useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }));
      setDate(now.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' }));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [locale]);

  if (time === null) return null; // avoid SSR mismatch

  return (
    <div style={{
      margin: '0 12px 20px',
      padding: '12px 16px',
      background: 'var(--surface-2)',
      borderRadius: '10px',
      border: '1px solid var(--border)',
      flexShrink: 0,
    }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.03em', fontFamily: 'var(--font-mono)' }}>
        {time}
      </div>
      <div style={{ fontSize: '0.73rem', color: 'var(--muted-2)', marginTop: '2px' }}>
        {date}
      </div>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const { t } = useLanguage();

  const tabNavItems = [
    { id: 'overview', label: t.tabOverview, icon: <DashboardIcon /> },
    { id: 'calendar', label: t.tabCalendar, icon: <CalendarIcon /> },
    { id: 'tasks',    label: t.tabTasks,    icon: <TaskIcon /> },
    { id: 'finance',  label: t.tabFinance,  icon: <FinanceIcon /> },
  ];

  return (
    <aside style={{
      width: '240px',
      minHeight: '100vh',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      position: 'sticky',
      top: 0,
      flexShrink: 0,
      overflowY: 'auto',
      maxHeight: '100vh',
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', boxShadow: '0 0 16px var(--accent-glow)',
          }}>
            ⚡
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.02em' }}>PersonalOS</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '1px' }}>{t.tagline}</div>
          </div>
        </div>
      </div>

      {/* Live clock widget */}
      <LiveClock />

      {/* Navigation */}
      <nav style={{ padding: '0 8px', flexShrink: 0 }}>
        <div style={{
          fontSize: '0.62rem', fontWeight: 600, color: 'var(--muted)',
          letterSpacing: '0.1em', textTransform: 'uppercase',
          padding: '0 12px', marginBottom: '6px',
        }}>
          {t.navigation}
        </div>

        {/* Tab-based nav items */}
        {tabNavItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => onTabChange(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                width: '100%', padding: '10px 12px', borderRadius: '8px',
                border: 'none',
                background: isActive
                  ? 'linear-gradient(135deg,rgba(108,99,255,0.2),rgba(167,139,250,0.1))'
                  : 'transparent',
                color: isActive ? 'var(--accent-2)' : 'var(--muted-2)',
                fontWeight: isActive ? 600 : 400,
                fontSize: '0.875rem', cursor: 'pointer', textAlign: 'left',
                marginBottom: '2px',
                boxShadow: isActive ? 'inset 0 0 0 1px rgba(108,99,255,0.3)' : 'none',
                transition: 'all 200ms ease',
              }}
              onMouseEnter={e => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
              }}
              onMouseLeave={e => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              <span style={{ opacity: isActive ? 1 : 0.6, color: isActive ? 'var(--accent)' : 'inherit', flexShrink: 0 }}>
                {item.icon}
              </span>
              {item.label}
              {isActive && (
                <span style={{ marginLeft: 'auto', width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
              )}
            </button>
          );
        })}

        {/* Divider */}
        <div style={{ height: '1px', background: 'var(--border)', margin: '10px 8px' }} />

        {/* Clock — links to /clock route */}
        <Link
          href="/clock"
          id="nav-clock"
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            width: '100%', padding: '10px 12px', borderRadius: '8px',
            border: 'none', textDecoration: 'none',
            background: 'transparent',
            color: 'var(--muted-2)',
            fontWeight: 400, fontSize: '0.875rem',
            transition: 'all 200ms ease',
            marginBottom: '2px',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLAnchorElement;
            el.style.background = 'rgba(108,99,255,0.12)';
            el.style.color = 'var(--accent-2)';
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLAnchorElement;
            el.style.background = 'transparent';
            el.style.color = 'var(--muted-2)';
          }}
        >
          <span style={{ opacity: 0.6, flexShrink: 0 }}><ClockIcon /></span>
          {t.clockNav}
          <span style={{ marginLeft: 'auto', fontSize: '0.62rem', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: '4px', padding: '1px 5px' }}>
            ↗
          </span>
        </Link>
        
        {/* Stocks — links to /stocks route */}
        <Link
          href="/stocks"
          id="nav-stocks"
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            width: '100%', padding: '10px 12px', borderRadius: '8px',
            border: 'none', textDecoration: 'none',
            background: 'transparent',
            color: 'var(--muted-2)',
            fontWeight: 400, fontSize: '0.875rem',
            transition: 'all 200ms ease',
            marginBottom: '2px',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLAnchorElement;
            el.style.background = 'rgba(108,99,255,0.12)';
            el.style.color = 'var(--accent-2)';
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLAnchorElement;
            el.style.background = 'transparent';
            el.style.color = 'var(--muted-2)';
          }}
        >
          <span style={{ opacity: 0.6, flexShrink: 0 }}><StockIcon /></span>
          {t.marketNav}
          <span style={{ marginLeft: 'auto', fontSize: '0.62rem', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: '4px', padding: '1px 5px' }}>
            ↗
          </span>
        </Link>
      </nav>

      {/* Market Watchlist - Gerçek Verilerle Değiştirildi */}
      <div style={{ marginTop: '16px', flexShrink: 0, padding: '0 8px' }}>
        <div style={{
          fontSize: '0.62rem', fontWeight: 600, color: 'var(--muted)',
          letterSpacing: '0.1em', textTransform: 'uppercase',
          padding: '0 12px', marginBottom: '8px',
        }}>
          {t.marketLiveSection}
        </div>
        <MarketCard />
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Footer */}
      <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ fontSize: '0.68rem', color: 'var(--muted)', textAlign: 'center' }}>
          {t.dataViaSupabase}
        </div>
      </div>
    </aside>
  );
}