'use client';

import React from 'react';
import type { Task, CalendarEvent, FinanceState } from '../lib/types';

interface OverviewProps {
  tasks: Task[];
  events: CalendarEvent[]
  finance: FinanceState;
  onTabChange: (tab: string) => void;
}

/** Turkish Lira formatter */
function fmt(amount: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(amount);
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Returns the Monday of the ISO week containing `date` */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── Circular progress ring ───────────────────────────────────────────────────

interface CircularRingProps {
  pct: number;
  size: number;
  color: string;
  label: string;
}

function CircularRing({ pct, size, color, label }: CircularRingProps) {
  const strokeWidth = 6;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const dash = (pct / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={strokeWidth} />
        <circle
          cx={size/2} cy={size/2} r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 600ms ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 800, color, lineHeight: 1 }}>{pct.toFixed(0)}%</div>
        <div style={{ fontSize: '0.5rem', color: 'var(--muted)', marginTop: '1px' }}>{label}</div>
      </div>
    </div>
  );
}

export default function Overview({ tasks, events, finance, onTabChange }: OverviewProps) {
  const today = formatDate(new Date());
  const now = new Date();

  // ── Task stats ──────────────────────────────────────────────
  const pendingTasks = tasks.filter(t => t.status !== 'done');
  const todayTasks   = tasks.filter(t => t.date === today && t.status !== 'done');
  const doneTasks    = tasks.filter(t => t.status === 'done');
  const completionRate = tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0;

  // ── Productivity Score — this ISO week ──────────────────────
  const weekStart = getWeekStart(now);
  const weekEnd   = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const weekTasks = tasks.filter(t => {
    // Include tasks created this week OR due this week
    const created = new Date(t.createdAt);
    const due     = t.date ? new Date(t.date + 'T12:00:00') : null;
    return created >= weekStart || (due && due >= weekStart && due <= weekEnd);
  });
  const weekDone = weekTasks.filter(t => t.status === 'done').length;
  const productivityScore = weekTasks.length > 0 ? Math.round((weekDone / weekTasks.length) * 100) : 0;
  const productivityColor = productivityScore >= 70 ? '#10b981' : productivityScore >= 40 ? '#f59e0b' : '#ef4444';

  // ── Calendar stats ──────────────────────────────────────────
  const todayEvents    = events.filter(e => e.date === today).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  const upcomingEvents = events.filter(e => e.date > today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);

  // ── Finance stats ───────────────────────────────────────────
  const thisMonthTx = finance.transactions.filter(t => {
    const d = new Date(t.date + 'T12:00:00');
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthIncome  = thisMonthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const monthExpense = thisMonthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  // ── Greeting ────────────────────────────────────────────────
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Günaydın' : hour < 17 ? 'İyi Günler' : 'İyi Akşamlar';

  return (
    <div style={{ animation: 'fadeInUp 0.3s ease' }}>
      {/* Greeting */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '1.7rem', fontWeight: 800, letterSpacing: '-0.03em', margin: 0 }}>
          {greeting}! 👋
        </h1>
        <p style={{ color: 'var(--muted-2)', marginTop: '6px', fontSize: '0.9rem' }}>
          {now.toLocaleDateString('tr-TR', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          {todayTasks.length > 0 && ` · Bugün ${todayTasks.length} görev var`}
        </p>
      </div>

      {/* Quick Stats Grid — 3 columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '24px' }}>

        {/* Tasks Card */}
        <div
          id="overview-tasks-card"
          onClick={() => onTabChange('tasks')}
          style={{
            padding: '20px', borderRadius: '14px', background: 'var(--surface)', border: '1px solid var(--border)',
            cursor: 'pointer', transition: 'all 200ms ease',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 20px var(--accent-glow)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                ✅ Görevler
              </div>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--accent)' }}>
                {pendingTasks.length}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted-2)', marginTop: '4px' }}>
                bekliyor · %{completionRate} tamamlandı
              </div>
            </div>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(108,99,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
              📋
            </div>
          </div>
          {tasks.length > 0 && (
            <div style={{ marginTop: '14px' }}>
              <div style={{ height: '4px', borderRadius: '2px', background: 'var(--surface-3)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${completionRate}%`, background: 'linear-gradient(90deg, var(--accent), #10b981)', borderRadius: '2px', transition: 'width 600ms ease' }} />
              </div>
            </div>
          )}
        </div>

        {/* Productivity Score KPI */}
        <div
          id="overview-productivity-card"
          style={{
            padding: '20px', borderRadius: '14px', background: 'var(--surface)', border: '1px solid var(--border)',
            transition: 'all 200ms ease',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = productivityColor; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 20px ${productivityColor}33`; }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                🎯 Verimlilik Skoru
              </div>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-0.04em', color: productivityColor }}>
                %{productivityScore}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted-2)', marginTop: '4px' }}>
                {weekTasks.length > 0 ? `Bu hafta: ${weekDone}/${weekTasks.length} tamamlandı` : 'Bu hafta görev yok'}
              </div>
            </div>
            <CircularRing pct={productivityScore} size={60} color={productivityColor} label="Bu Hafta" />
          </div>
        </div>

        {/* Calendar Card */}
        <div
          id="overview-calendar-card"
          onClick={() => onTabChange('calendar')}
          style={{
            padding: '20px', borderRadius: '14px', background: 'var(--surface)', border: '1px solid var(--border)',
            cursor: 'pointer', transition: 'all 200ms ease',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#06b6d4'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 20px rgba(6,182,212,0.2)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                📅 Bugünkü Etkinlikler
              </div>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-0.04em', color: '#06b6d4' }}>
                {todayEvents.length}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted-2)', marginTop: '4px' }}>
                {upcomingEvents.length} yaklaşan
              </div>
            </div>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(6,182,212,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
              🗓️
            </div>
          </div>
        </div>

        {/* Finance Income */}
        <div
          id="overview-income-card"
          onClick={() => onTabChange('finance')}
          style={{
            padding: '20px', borderRadius: '14px', background: 'var(--surface)', border: '1px solid var(--border)',
            cursor: 'pointer', transition: 'all 200ms ease',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#10b981'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 20px rgba(16,185,129,0.2)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                ⬆ Bu Ay Gelir
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#10b981' }}>
                {fmt(monthIncome)}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted-2)', marginTop: '4px' }}>
                {thisMonthTx.filter(t => t.type === 'income').length} işlem
              </div>
            </div>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
              💰
            </div>
          </div>
        </div>

        {/* Finance Expense */}
        <div
          id="overview-expense-card"
          onClick={() => onTabChange('finance')}
          style={{
            padding: '20px', borderRadius: '14px', background: 'var(--surface)', border: '1px solid var(--border)',
            cursor: 'pointer', transition: 'all 200ms ease',
            gridColumn: 'span 2',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#ef4444'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 20px rgba(239,68,68,0.15)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                ⬇ Bu Ay Gider
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#ef4444' }}>
                {fmt(monthExpense)}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted-2)', marginTop: '4px' }}>
                {thisMonthTx.filter(t => t.type === 'expense').length} işlem
              </div>
            </div>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
              💸
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Today's Schedule + Urgent Tasks */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* Today's events */}
        <div style={{ padding: '20px', borderRadius: '14px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '14px' }}>📅 Bugünkü Program</div>
          {todayEvents.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: '0.82rem', padding: '12px 0', textAlign: 'center' }}>
              Bugün etkinlik yok
            </div>
          ) : (
            todayEvents.map(ev => (
              <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', padding: '10px 12px', borderRadius: '8px', background: 'var(--surface-2)' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: ev.color || 'var(--accent)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                  {ev.startTime && <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '1px' }}>{ev.startTime}{ev.endTime ? ` – ${ev.endTime}` : ''}</div>}
                </div>
              </div>
            ))
          )}
          {upcomingEvents.length > 0 && (
            <>
              <div style={{ fontSize: '0.68rem', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, margin: '12px 0 8px' }}>
                Yaklaşan
              </div>
              {upcomingEvents.map(ev => (
                <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', padding: '8px 12px', borderRadius: '8px', background: 'var(--surface-2)', opacity: 0.75 }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: ev.color || 'var(--accent)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>
                      {new Date(ev.date + 'T12:00:00').toLocaleDateString('tr-TR', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Priority Tasks */}
        <div style={{ padding: '20px', borderRadius: '14px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '14px' }}>🔥 Öncelikli Görevler</div>
          {pendingTasks
            .sort((a, b) => { const order = { high: 0, medium: 1, low: 2 }; return order[a.priority] - order[b.priority]; })
            .slice(0, 5)
            .map(task => (
              <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', padding: '10px 12px', borderRadius: '8px', background: 'var(--surface-2)' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: task.priority === 'high' ? '#ef4444' : task.priority === 'medium' ? '#f59e0b' : '#10b981' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
                  {task.date && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '1px' }}>
                      {new Date(task.date + 'T12:00:00').toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' })}
                      {task.time ? ` · ${task.time}` : ''}
                    </div>
                  )}
                </div>
                <span style={{
                  fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: '4px',
                  background: task.priority === 'high' ? 'rgba(239,68,68,0.15)' : task.priority === 'medium' ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)',
                  color: task.priority === 'high' ? '#ef4444' : task.priority === 'medium' ? '#f59e0b' : '#10b981',
                  textTransform: 'uppercase',
                }}>
                  {task.priority === 'high' ? 'Yüksek' : task.priority === 'medium' ? 'Orta' : 'Düşük'}
                </span>
              </div>
            ))}
          {pendingTasks.length === 0 && (
            <div style={{ color: 'var(--muted)', fontSize: '0.82rem', padding: '12px 0', textAlign: 'center' }}>
              🎉 Harika! Bekleyen görev yok.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
