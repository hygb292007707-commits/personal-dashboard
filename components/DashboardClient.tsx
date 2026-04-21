'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import Overview from '../components/Overview';
import Calendar from '../components/Calendar';
import TaskManager from '../components/TaskManager';
import Finance from '../components/Finance';
import Clock from '../components/Clock';
import { useLocalStorage } from '../lib/hooks/useLocalStorage';
import { useTable } from '../lib/hooks/useTable';
import { TABLES } from '../lib/supabase';
import type { Task, CalendarEvent, FinanceState, Transaction } from '../lib/types';
import LanguageToggle from '../components/LanguageToggle';
import { useLanguage } from '../lib/hooks/LanguageContext';
// ─── Types ─────────────────────────────────────────────────────────────────────

interface TimerPreset {
  id: string;
  title: string;
  totalMs: number;
  emoji: string;
  isDefault?: boolean;
}

// ─── Row mappers ──────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

function taskFromRow(r: Row): Task {
  return {
    id: String(r.id),
    title: String(r.title),
    description: r.description != null ? String(r.description) : undefined,
    date: r.date != null ? String(r.date) : undefined,
    time: r.time != null ? String(r.time) : undefined,
    priority: (r.priority as Task['priority']) ?? 'medium',
    status: (r.status as Task['status']) ?? 'pending',
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    createdAt: String(r.created_at ?? r.createdAt ?? new Date().toISOString()),
    recurringGroupId: r.recurring_group_id != null ? String(r.recurring_group_id) : undefined,
    repeatDays: Array.isArray(r.repeat_days) ? (r.repeat_days as number[]) as Task['repeatDays'] : undefined,
  };
}

function taskToRow(t: Task): Row {
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? null,
    date: t.date ?? null,
    time: t.time ?? null,
    priority: t.priority,
    status: t.status,
    tags: t.tags,
    created_at: t.createdAt,
    recurring_group_id: t.recurringGroupId ?? null,
    repeat_days: t.repeatDays ?? null,
  };
}

function txFromRow(r: Row): Transaction {
  return {
    id: String(r.id),
    type: r.type as Transaction['type'],
    category: r.category as Transaction['category'],
    amount: Number(r.amount),
    description: String(r.description),
    date: String(r.date),
    createdAt: String(r.created_at ?? r.createdAt ?? new Date().toISOString()),
  };
}

function txToRow(t: Transaction): Row {
  return {
    id: t.id,
    type: t.type,
    category: t.category,
    amount: t.amount,
    description: t.description,
    date: t.date,
    created_at: t.createdAt,
  };
}

function presetFromRow(r: Row): TimerPreset {
  return {
    id: String(r.id),
    title: String(r.title),
    totalMs: Number(r.total_ms),
    emoji: String(r.emoji),
    isDefault: Boolean(r.is_default),
  };
}

function presetToRow(p: TimerPreset): Row {
  return {
    id: p.id,
    title: p.title,
    total_ms: p.totalMs,
    emoji: p.emoji,
    is_default: p.isDefault ?? false,
  };
}

// ─── Finance state defaults ───────────────────────────────────────────────────

const DEFAULT_FINANCE_META: Omit<FinanceState, 'transactions'> = {
  budgets: [], currency: 'TRY', monthlyBudget: null,
};

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  const { t } = useLanguage();
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)' }}>
      <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          border: '3px solid var(--border)', borderTopColor: 'var(--accent)',
          margin: '0 auto 12px', animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ fontSize: '0.85rem' }}>{t.loadingData}</div>
      </div>
    </div>
  );
}

// ─── Error banner ─────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div style={{
      position: 'fixed', bottom: '16px', right: '16px', zIndex: 9999,
      padding: '12px 16px', borderRadius: '10px', maxWidth: '340px',
      background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
      color: '#ef4444', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '10px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    }}>
      <span>⚠ Supabase: {message}</span>
      <button onClick={() => setDismissed(true)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '0.9rem' }}>✕</button>
    </div>
  );
}

// ─── DB loading indicator (non-blocking) ─────────────────────────────────────

function DbLoadingPill({ loading }: { loading: boolean }) {
  const { t } = useLanguage();
  if (!loading) return null;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      fontSize: '0.68rem', color: 'var(--muted)', padding: '3px 8px',
      background: 'var(--surface-2)', borderRadius: '6px', border: '1px solid var(--border)',
    }}>
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', border: '1.5px solid var(--muted)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
      {t.syncing}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DashboardClient() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('overview');
  const [mounted, setMounted] = useState(false);
  const [quickAddText, setQuickAddText] = useState('');
  useEffect(() => setMounted(true), []);

  // ── Calendar: still localStorage ──────────────────────────────────────────
  const [events, setEvents] = useLocalStorage<CalendarEvent[]>('dashboard:events', []);

  // ── Finance metadata (budget, currency) — localStorage ─────────────────────
  const [financeMeta, setFinanceMeta] = useLocalStorage<Omit<FinanceState, 'transactions'>>(
    'dashboard:finance-meta', DEFAULT_FINANCE_META,
  );

  // ── Tasks from Supabase ─────────────────────────────────────────────────────
  const {
    data: tasks, loading: tasksLoading, error: tasksError,
    insertOne: insertTask, deleteById: deleteTaskById, replaceAll: replaceAllTasks,
  } = useTable<Task>({
    table: TABLES.TASKS,
    lsKey: 'dashboard:tasks',
    fallback: [],
    orderBy: 'created_at',
    orderAsc: false,
    fromRow: taskFromRow,
    toRow: taskToRow,
  });

  // ── Transactions from Supabase ──────────────────────────────────────────────
  const {
    data: transactions, loading: txLoading, error: txError,
    insertOne: insertTx, deleteById: deleteTxById,
  } = useTable<Transaction>({
    table: TABLES.FINANCE_TRANSACTIONS,
    lsKey: 'dashboard:transactions',
    fallback: [],
    orderBy: 'created_at',
    orderAsc: false,
    fromRow: txFromRow,
    toRow: txToRow,
  });

  // ── Timer Presets from Supabase ─────────────────────────────────────────────
  const {
    data: presets, loading: presetsLoading, error: presetsError,
    insertOne: insertPreset, deleteById: deletePresetById, replaceAll: replaceAllPresets,
  } = useTable<TimerPreset>({
    table: TABLES.TIMER_PRESETS,
    lsKey: 'dashboard:timer-presets',
    fallback: [],
    orderBy: 'created_at',
    orderAsc: true,
    fromRow: presetFromRow,
    toRow: presetToRow,
  });

  // ── Derived finance state ───────────────────────────────────────────────────
  const financeState: FinanceState = {
    ...financeMeta,
    transactions,
  };

  // ── Task handlers ───────────────────────────────────────────────────────────
  const handleTasksChange = useCallback(async (updated: Task[]) => {
    // Note: We use the local state 'tasks' which already has optimistic updates.
    // We check against the current DB-synced snapshot to find deltas.
    const existingIds = new Set(tasks.map(t => t.id));
    const added = updated.filter(t => !existingIds.has(t.id));
    const removed = tasks.filter(t => !updated.some(u => u.id === t.id));
    const changed = updated.filter(t => {
      const old = tasks.find(o => o.id === t.id);
      return old && JSON.stringify(old) !== JSON.stringify(t);
    });

    // We await these because useTable handles the optimistic logic internally now.
    for (const t of added) await insertTask(t);
    for (const t of removed) await deleteTaskById(t.id);
    if (changed.length > 0) await replaceAllTasks(updated);
  }, [tasks, insertTask, deleteTaskById, replaceAllTasks]);

  // ── Finance handlers ────────────────────────────────────────────────────────
  const handleFinanceChange = useCallback(async (state: FinanceState) => {
    setFinanceMeta({ budgets: state.budgets, currency: state.currency, monthlyBudget: state.monthlyBudget });
    const existingIds = new Set(transactions.map(t => t.id));
    const added = state.transactions.filter(t => !existingIds.has(t.id));
    const removed = transactions.filter(t => !state.transactions.some(s => s.id === t.id));

    for (const t of added) await insertTx(t);
    for (const t of removed) await deleteTxById(t.id);
  }, [transactions, insertTx, deleteTxById, setFinanceMeta]);

  // ── Presets handlers ────────────────────────────────────────────────────────
  const handlePresetsChange = useCallback(async (updated: TimerPreset[]) => {
    const existingIds = new Set(presets.map(p => p.id));
    const added = updated.filter(p => !existingIds.has(p.id));
    const removed = presets.filter(p => !updated.some(u => u.id === p.id));
    const changed = updated.filter(p => {
      const old = presets.find(o => o.id === p.id);
      return old && JSON.stringify(old) !== JSON.stringify(p);
    });

    for (const p of added) await insertPreset(p);
    for (const p of removed) await deletePresetById(p.id);
    if (changed.length > 0) await replaceAllPresets(updated);
  }, [presets, insertPreset, deletePresetById, replaceAllPresets]);

  // ── Initial loading barrier ────────────────────────────────────────────────
  if (!mounted) return <LoadingSkeleton />;

  const tabLabel: Record<string, string> = {
    overview: t.tabOverview, calendar: t.tabCalendar,
    tasks: t.tabTasks, finance: t.tabFinance, clock: t.tabClock,
  };
  const tabEmoji: Record<string, string> = {
    overview: '🏠', calendar: '🗓️', tasks: '📋', finance: '💰', clock: '⏱',
  };

  const dbError = tasksError?.message || txError?.message || presetsError?.message;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--background)' }}>
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <header style={{
          padding: '16px 28px', borderBottom: '1px solid var(--border)',
          background: 'rgba(13,15,20,0.8)', backdropFilter: 'blur(8px)',
          position: 'sticky', top: 0, zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.2rem' }}>{tabEmoji[activeTab]}</span>
            <h2 style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>
              {tabLabel[activeTab]}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <DbLoadingPill loading={tasksLoading || txLoading || presetsLoading} />

            <div style={{ display: 'flex', gap: '16px', fontSize: '0.78rem', color: 'var(--muted-2)' }}>
              <span>
                <span style={{ color: '#f59e0b', fontWeight: 700 }}>{tasks.filter(task => task.status !== 'done').length}</span> {t.pendingTasks}
              </span>
              <span>
                <span style={{ color: '#06b6d4', fontWeight: 700 }}>
                  {events.filter(e => {
                    const now = new Date();
                    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                    return e.date === today;
                  }).length}
                </span> {t.todayEvents}
              </span>
            </div>

            {/* Quick Add Task Input */}
            <div style={{ paddingLeft: '16px', borderLeft: '1px solid var(--border)', display: 'flex', alignItems: 'center' }}>
              <input
                type="text"
                placeholder={t.quickAddPlaceholder}
                value={quickAddText}
                onChange={(e) => setQuickAddText(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && quickAddText.trim() !== '') {
                    const tokens = quickAddText.split(/\s+/);
                    let extractedPriority: Task['priority'] = 'medium';
                    let extractedDate: string | null = null;
                    let timeKeyword: 'sabah' | 'öğlen' | 'akşam' | 'gece' | null = null;
                    let rawHour: number | null = null;
                    let rawMinute: number = 0;
                    const remainingTokens: string[] = [];

                    const now = new Date();
                    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                    const tomorrow = new Date(now);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

                    for (const t of tokens) {
                      const lower = t.toLowerCase();
                      if (lower === 'yö') { extractedPriority = 'high'; continue; }
                      if (lower === 'oo') { extractedPriority = 'medium'; continue; }
                      if (lower === 'dö') { extractedPriority = 'low'; continue; }

                      if (lower === 'bugün') { extractedDate = todayStr; continue; }
                      if (lower === 'yarın') { extractedDate = tomorrowStr; continue; }

                      // Check for time keywords
                      // Check for time keywords
                      if (['sabah', 'öğlen', 'akşam', 'gece'].includes(lower)) {
                        timeKeyword = lower as 'sabah' | 'öğlen' | 'akşam' | 'gece';
                        continue;
                      }

                      // Match exactly HH:MM where HH 0-23 and MM 0-59
                      const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
                      const timeMatch = t.match(timeRegex);
                      if (rawHour === null && timeMatch) {
                        rawHour = parseInt(timeMatch[1], 10);
                        rawMinute = parseInt(timeMatch[2], 10);
                        continue;
                      }

                      // Match standalone hour 0-24
                      const hourRegex = /^([0-9]|1[0-9]|2[0-4])$/;
                      const hourMatch = t.match(hourRegex);
                      if (rawHour === null && hourMatch) {
                        rawHour = parseInt(hourMatch[1], 10);
                        rawMinute = 0;
                        continue;
                      }

                      remainingTokens.push(t);
                    }

                    // Resolve Contextual Time Logic
                    let finalTime: string | undefined = undefined;

                    if (rawHour !== null) {
                      let h = rawHour;
                      if (timeKeyword === 'öğlen' && h >= 1 && h <= 5) {
                        h += 12;
                      } else if (timeKeyword === 'akşam' && h >= 5 && h <= 11) {
                        h += 12;
                      } else if (timeKeyword === 'gece') {
                        if (h === 12) h = 0;
                        else if (h === 11) h = 23;
                      }

                      // Safety wrapper
                      if (h === 24) h = 0;

                      finalTime = `${String(h).padStart(2, '0')}:${String(rawMinute).padStart(2, '0')}`;
                    } else if (timeKeyword) {
                      // Fallbacks if no number was given
                      if (timeKeyword === 'sabah') finalTime = '09:00';
                      else if (timeKeyword === 'öğlen') finalTime = '14:00';
                      else if (timeKeyword === 'akşam') finalTime = '19:00';
                      else if (timeKeyword === 'gece') finalTime = '23:00';
                    }

                    // Build final text
                    const finalTitle = remainingTokens.join(' ').trim() || 'Yeni Görev';

                    const newTask: Task = {
                      id: Date.now().toString(),
                      title: finalTitle,
                      status: 'pending',
                      priority: extractedPriority,
                      tags: [],
                      date: extractedDate || todayStr,
                      time: finalTime,
                      createdAt: now.toISOString()
                    };
                    await insertTask(newTask);
                    setQuickAddText('');
                  }
                }}
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--foreground)',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '0.85rem',
                  outline: 'none',
                  minWidth: '200px',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            <div style={{ paddingLeft: '16px', borderLeft: '1px solid var(--border)', display: 'flex', alignItems: 'center' }}>
              <LanguageToggle />
            </div>

          </div>
        </header>

        {/* Content */}
        <div style={{ flex: 1, padding: '28px', maxWidth: '1400px', width: '100%', alignSelf: 'center' }}>
          {activeTab === 'overview' && (
            <Overview tasks={tasks} events={events} finance={financeState} onTabChange={setActiveTab} />
          )}
          {activeTab === 'calendar' && (
            <Calendar events={events} onEventsChange={setEvents} />
          )}
          {activeTab === 'tasks' && (
            <TaskManager
              tasks={tasks}
              loading={tasksLoading}
              onTasksChange={handleTasksChange}
            />
          )}
          {activeTab === 'finance' && (
            <Finance
              state={financeState}
              loading={txLoading}
              onStateChange={handleFinanceChange}
            />
          )}
          {activeTab === 'clock' && (
            <Clock
              presets={presets}
              presetsLoading={presetsLoading}
              onPresetsChange={handlePresetsChange}
            />
          )}
        </div>
      </main>

      {dbError && <ErrorBanner message={dbError} />}
    </div>
  );
}
