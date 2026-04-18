'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import type { Task, TaskPriority, TaskStatus, WeekDay, RepeatType } from '../lib/types';
import { parseTaskInput, generateId } from '../lib/nlpParser';
import type { NLPParseResult } from '../lib/types';

interface TaskManagerProps {
  tasks: Task[];
  loading: boolean;
  onTasksChange: (tasks: Task[]) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bg: string }> = {
  high:   { label: 'Yüksek', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  medium: { label: 'Orta',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  low:    { label: 'Düşük',  color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
};

const STATUS_CONFIG: Record<TaskStatus, { label: string; icon: string }> = {
  pending:     { label: 'Bekliyor',    icon: '○' },
  'in-progress': { label: 'Devam Ediyor', icon: '◑' },
  done:        { label: 'Tamamlandı',  icon: '●' },
};

/** Mon-first week labels matching JS getDay() (0=Sun) */
const WEEKDAY_LABELS: { day: WeekDay; short: string }[] = [
  { day: 1, short: 'Pzt' },
  { day: 2, short: 'Sal' },
  { day: 3, short: 'Çar' },
  { day: 4, short: 'Per' },
  { day: 5, short: 'Cum' },
  { day: 6, short: 'Cmt' },
  { day: 0, short: 'Paz' },
];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Returns the set of ISO date strings between start and end (inclusive) that fall on the given weekdays */
function expandRecurring(startISO: string, endISO: string, days: WeekDay[]): string[] {
  const dates: string[] = [];
  const cur = new Date(startISO + 'T12:00:00');
  const end = new Date(endISO + 'T12:00:00');
  const daySet = new Set(days);
  while (cur <= end) {
    if (daySet.has(cur.getDay() as WeekDay)) {
      dates.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`);
    }
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// ─── Recurring delete modal ───────────────────────────────────────────────────

interface DeleteModalProps {
  taskId: string;
  hasGroup: boolean;
  onDeleteOne: (id: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onCancel: () => void;
  groupId?: string;
}

function DeleteModal({ taskId, hasGroup, onDeleteOne, onDeleteGroup, onCancel, groupId }: DeleteModalProps) {
  return (
    <div
      id="delete-modal-overlay"
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '16px', padding: '28px 24px', maxWidth: '360px', width: '90vw',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)', animation: 'fadeInUp 0.2s ease',
        }}
      >
        <div style={{ fontSize: '1.6rem', marginBottom: '10px' }}>🗑️</div>
        <h3 style={{ fontWeight: 700, fontSize: '1rem', margin: '0 0 8px' }}>
          {hasGroup ? 'Bu tekrarlayan görevi sil' : 'Görevi sil'}
        </h3>
        {hasGroup ? (
          <p style={{ fontSize: '0.82rem', color: 'var(--muted-2)', margin: '0 0 20px' }}>
            Bu görev bir tekrarlayan seriye ait. Nasıl silmek istersiniz?
          </p>
        ) : (
          <p style={{ fontSize: '0.82rem', color: 'var(--muted-2)', margin: '0 0 20px' }}>
            Bu görevi kalıcı olarak silmek istediğinizden emin misiniz?
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {hasGroup && (
            <button
              id="delete-series-btn"
              onClick={() => groupId && onDeleteGroup(groupId)}
              style={{
                padding: '10px 16px', borderRadius: '8px', border: 'none',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                color: 'white', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
              }}
            >
              🗑 Tüm seriyi sil
            </button>
          )}
          <button
            id="delete-one-btn"
            onClick={() => onDeleteOne(taskId)}
            style={{
              padding: '10px 16px', borderRadius: '8px',
              border: '1px solid var(--border)', background: 'var(--surface-2)',
              color: 'var(--foreground)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
            }}
          >
            {hasGroup ? 'Sadece bunu sil' : 'Evet, sil'}
          </button>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 16px', borderRadius: '8px',
              border: 'none', background: 'none',
              color: 'var(--muted-2)', fontSize: '0.85rem', cursor: 'pointer',
            }}
          >
            İptal
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Recurring Form Section (shown inside NLP area) ──────────────────────────

interface RecurringFormProps {
  repeatType: RepeatType;
  setRepeatType: (r: RepeatType) => void;
  customDays: WeekDay[];
  toggleDay: (d: WeekDay) => void;
  endDate: string;
  setEndDate: (d: string) => void;
}

function RecurringForm({ repeatType, setRepeatType, customDays, toggleDay, endDate, setEndDate }: RecurringFormProps) {
  const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();

  return (
    <div style={{ marginTop: '10px', padding: '14px', borderRadius: '10px', background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Repeat type selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>🔁 Tekrarla:</span>
        <div style={{ display: 'flex', gap: '4px', background: 'var(--surface-3)', padding: '2px', borderRadius: '7px' }}>
          {([
            { val: 'none',   label: 'Yok' },
            { val: 'daily',  label: 'Her Gün' },
            { val: 'custom', label: 'Özel' },
          ] as { val: RepeatType; label: string }[]).map(({ val, label }) => (
            <button
              key={val}
              id={`repeat-${val}`}
              onClick={() => setRepeatType(val)}
              style={{
                padding: '4px 12px', borderRadius: '5px', border: 'none',
                background: repeatType === val ? 'var(--accent)' : 'none',
                color: repeatType === val ? 'white' : 'var(--muted-2)',
                fontWeight: repeatType === val ? 600 : 400,
                fontSize: '0.78rem', cursor: 'pointer', transition: 'all 150ms ease',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom day picker */}
      {repeatType === 'custom' && (
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>Günler:</span>
          {WEEKDAY_LABELS.map(({ day, short }) => {
            const active = customDays.includes(day);
            return (
              <button
                key={day}
                id={`day-toggle-${day}`}
                onClick={() => toggleDay(day)}
                style={{
                  padding: '4px 9px', borderRadius: '6px',
                  border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: active ? 'rgba(108,99,255,0.2)' : 'var(--surface-3)',
                  color: active ? 'var(--accent-2)' : 'var(--muted-2)',
                  fontWeight: active ? 700 : 400,
                  fontSize: '0.75rem', cursor: 'pointer', transition: 'all 150ms ease',
                  boxShadow: active ? '0 0 8px rgba(108,99,255,0.25)' : 'none',
                }}
              >
                {short}
              </button>
            );
          })}
        </div>
      )}

      {/* End date (shown whenever repeat is active) */}
      {repeatType !== 'none' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>📅 Bitiş Tarihi:</span>
          <input
            id="repeat-end-date"
            type="date"
            value={endDate}
            min={tomorrow}
            onChange={e => setEndDate(e.target.value)}
            required
            style={{
              padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem',
              colorScheme: 'dark', border: '1px solid var(--border)',
              background: 'var(--surface-3)', color: 'var(--foreground)',
            }}
          />
          {endDate && (
            <span style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>
              seçildi
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── NLP Input component ──────────────────────────────────────────────────────

interface NLPInputProps {
  onParse: (result: NLPParseResult, repeat: RepeatType, customDays: WeekDay[], endDate: string) => void;
}

function NLPInput({ onParse }: NLPInputProps) {
  const [input, setInput] = useState('');
  const [preview, setPreview] = useState<NLPParseResult | null>(null);
  const [focused, setFocused] = useState(false);

  // Recurrence state
  const [repeatType, setRepeatType] = useState<RepeatType>('none');
  const [customDays, setCustomDays] = useState<WeekDay[]>([]);
  const [endDate, setEndDate] = useState('');
  const [showRecurring, setShowRecurring] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (input.trim().length > 3) {
      setPreview(parseTaskInput(input));
    } else {
      setPreview(null);
    }
  }, [input]);

  const toggleDay = useCallback((d: WeekDay) => {
    setCustomDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    // Validate recurring
    if (repeatType !== 'none') {
      if (!endDate) { alert('Lütfen bitiş tarihi seçin.'); return; }
      if (repeatType === 'custom' && customDays.length === 0) { alert('Lütfen en az bir gün seçin.'); return; }
    }
    const result = parseTaskInput(input);
    onParse(result, repeatType, customDays, endDate);
    setInput('');
    setPreview(null);
    setRepeatType('none');
    setCustomDays([]);
    setEndDate('');
    setShowRecurring(false);
  };

  const examples = [
    'Submit report tomorrow at 2pm #work',
    'Review PR urgent!! #dev',
    'Yarın saat 18:00\'de doktor randevusu #sağlık',
    'Bugün alışveriş yap #market',
    'Pazartesi toplantı saat 10 acil',
  ];

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div>
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Hızlı Ekle </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontStyle: 'italic' }}>— doğal dilde yaz, AI ayıklar</span>
        </div>
        {/* Toggle recurring */}
        <button
          id="toggle-recurring-btn"
          type="button"
          onClick={() => setShowRecurring(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '4px 10px', borderRadius: '7px',
            border: showRecurring ? '1px solid var(--accent)' : '1px solid var(--border)',
            background: showRecurring ? 'rgba(108,99,255,0.12)' : 'var(--surface-2)',
            color: showRecurring ? 'var(--accent-2)' : 'var(--muted-2)',
            fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 150ms ease',
          }}
        >
          🔁 Tekrarla {repeatType !== 'none' && <span style={{ fontSize: '0.6rem', background: 'var(--accent)', color: 'white', borderRadius: '4px', padding: '0 4px' }}>aktif</span>}
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            id="nlp-task-input"
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 200)}
            placeholder="örn. Her sabah egzersiz yap #spor acil"
            style={{
              width: '100%', padding: '12px 16px', borderRadius: '10px',
              border: '1px solid var(--border)', background: 'var(--surface-2)',
              fontSize: '0.9rem', color: 'var(--foreground)',
            }}
          />
          {/* Suggestions dropdown */}
          {focused && !input && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '10px', marginTop: '4px', zIndex: 100, overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}>
              <div style={{ padding: '8px 12px', fontSize: '0.7rem', color: 'var(--muted)', borderBottom: '1px solid var(--border)', letterSpacing: '0.05em', fontWeight: 600, textTransform: 'uppercase' }}>
                Örnekler
              </div>
              {examples.map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => { setInput(ex); inputRef.current?.focus(); }}
                  style={{
                    display: 'block', width: '100%', padding: '10px 16px',
                    background: 'none', border: 'none', color: 'var(--muted-2)',
                    fontSize: '0.82rem', textAlign: 'left', cursor: 'pointer',
                    fontFamily: 'var(--font-mono)',
                    borderBottom: i < examples.length - 1 ? '1px solid rgba(42,47,66,0.5)' : 'none',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  {ex}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          id="add-task-btn"
          type="submit"
          disabled={!input.trim()}
          style={{
            padding: '12px 20px', borderRadius: '10px', border: 'none',
            background: input.trim() ? 'linear-gradient(135deg, var(--accent), var(--accent-2))' : 'var(--surface-3)',
            color: input.trim() ? 'white' : 'var(--muted)',
            fontWeight: 600, fontSize: '0.875rem',
            cursor: input.trim() ? 'pointer' : 'not-allowed',
            whiteSpace: 'nowrap',
          }}
        >
          Ekle
        </button>
      </form>

      {/* Recurring options */}
      {showRecurring && (
        <RecurringForm
          repeatType={repeatType}
          setRepeatType={setRepeatType}
          customDays={customDays}
          toggleDay={toggleDay}
          endDate={endDate}
          setEndDate={setEndDate}
        />
      )}

      {/* NLP Preview */}
      {preview && input.trim().length > 3 && (
        <div style={{
          marginTop: '8px', padding: '10px 14px', borderRadius: '8px',
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: '10px',
          flexWrap: 'wrap', fontSize: '0.78rem',
        }}>
          <span style={{ color: 'var(--muted)' }}>Ayrıştırıldı:</span>
          <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{preview.title}</span>
          {preview.date && (
            <span style={{ background: 'rgba(108,99,255,0.15)', color: 'var(--accent-2)', padding: '2px 8px', borderRadius: '4px' }}>
              📅 {preview.date}
            </span>
          )}
          {preview.time && (
            <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '2px 8px', borderRadius: '4px' }}>
              🕐 {preview.time}
            </span>
          )}
          <span style={{ background: PRIORITY_CONFIG[preview.priority].bg, color: PRIORITY_CONFIG[preview.priority].color, padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
            {PRIORITY_CONFIG[preview.priority].label}
          </span>
          {preview.tags.map(tag => (
            <span key={tag} style={{ background: 'rgba(167,139,250,0.15)', color: 'var(--accent-2)', padding: '2px 8px', borderRadius: '4px' }}>
              #{tag}
            </span>
          ))}
          {repeatType !== 'none' && (
            <span style={{ background: 'rgba(108,99,255,0.15)', color: 'var(--accent-2)', padding: '2px 8px', borderRadius: '4px' }}>
              🔁 {repeatType === 'daily' ? 'Her Gün' : customDays.map(d => WEEKDAY_LABELS.find(w => w.day === d)?.short).join(', ')}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Recurrence badge helper ──────────────────────────────────────────────────

function RepeatBadge({ repeatDays }: { repeatDays: WeekDay[] }) {
  if (repeatDays.length === 7) return <span style={badgeStyle}>🔁 Her Gün</span>;
  const labels = repeatDays
    .slice()
    .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
    .map(d => WEEKDAY_LABELS.find(w => w.day === d)?.short ?? '')
    .join(', ');
  return <span style={badgeStyle}>🔁 {labels}</span>;
}
const badgeStyle: React.CSSProperties = {
  fontSize: '0.62rem', fontWeight: 600,
  background: 'rgba(108,99,255,0.13)', color: 'var(--accent-2)',
  border: '1px solid rgba(108,99,255,0.25)',
  padding: '1px 6px', borderRadius: '4px',
};

// ─── Task Card ────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDeleteRequest: (task: Task) => void;
}

function TaskCard({ task, onStatusChange, onDeleteRequest }: TaskCardProps) {
  const priority = PRIORITY_CONFIG[task.priority];
  const status = STATUS_CONFIG[task.status];
  const isDone = task.status === 'done';

  const nextStatus: Record<TaskStatus, TaskStatus> = {
    pending: 'in-progress',
    'in-progress': 'done',
    done: 'pending',
  };

  return (
    <div
      id={`task-${task.id}`}
      style={{
        padding: '12px 14px', borderRadius: '10px',
        background: isDone ? 'var(--surface-2)' : 'var(--surface)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${isDone ? 'var(--muted)' : priority.color}`,
        display: 'flex', alignItems: 'flex-start', gap: '12px',
        opacity: isDone ? 0.6 : 1, transition: 'all 200ms ease',
        marginBottom: '6px',
      }}
    >
      {/* Status toggle */}
      <button
        id={`task-status-${task.id}`}
        onClick={() => onStatusChange(task.id, nextStatus[task.status])}
        title={`Durum: ${status.label}`}
        style={{
          width: '22px', height: '22px', borderRadius: '50%',
          border: `2px solid ${priority.color}`,
          background: task.status === 'done' ? priority.color : 'none',
          color: task.status === 'done' ? 'white' : priority.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.7rem', flexShrink: 0, marginTop: '1px', cursor: 'pointer',
        }}
      >
        {task.status === 'done' ? '✓' : task.status === 'in-progress' ? '◑' : ''}
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 600, fontSize: '0.9rem',
          textDecoration: isDone ? 'line-through' : 'none',
          color: isDone ? 'var(--muted)' : 'var(--foreground)',
          marginBottom: '5px',
        }}>
          {task.title}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {task.date && (
            <span style={{ fontSize: '0.7rem', color: 'var(--muted-2)' }}>
              📅 {new Date(task.date + 'T12:00:00').toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' })}
            </span>
          )}
          {task.time && (
            <span style={{ fontSize: '0.68rem', background: 'rgba(16,185,129,0.12)', color: '#10b981', padding: '1px 7px', borderRadius: '4px' }}>
              🕐 {task.time}
            </span>
          )}
          <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '1px 7px', borderRadius: '4px', background: priority.bg, color: priority.color }}>
            {priority.label}
          </span>
          <span style={{ fontSize: '0.68rem', color: 'var(--muted)', padding: '1px 7px', borderRadius: '4px', background: 'var(--surface-3)' }}>
            {status.label}
          </span>
          {task.tags.map(tag => (
            <span key={tag} style={{ fontSize: '0.68rem', color: 'var(--accent-2)', background: 'rgba(167,139,250,0.12)', padding: '1px 7px', borderRadius: '4px' }}>
              #{tag}
            </span>
          ))}
          {/* Recurrence badge */}
          {task.recurringGroupId && task.repeatDays && task.repeatDays.length > 0 && (
            <RepeatBadge repeatDays={task.repeatDays} />
          )}
        </div>
      </div>

      {/* Delete */}
      <button
        id={`delete-task-${task.id}`}
        onClick={() => onDeleteRequest(task)}
        style={{
          background: 'none', border: 'none', color: 'var(--muted)',
          padding: '4px', borderRadius: '4px', cursor: 'pointer',
          fontSize: '0.85rem', flexShrink: 0,
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
      >✕</button>
    </div>
  );
}

// ─── Main TaskManager ──────────────────────────────────────────────────────────

export default function TaskManager({ tasks, loading, onTasksChange }: TaskManagerProps) {
  const [filter, setFilter] = useState<'all' | TaskStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'created'>('created');

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  // ── Task creation ──────────────────────────────────────────────────────────

  const handleParse = (result: NLPParseResult, repeat: RepeatType, customDays: WeekDay[], endDate: string) => {
    const baseDate = result.date ?? todayISO();

    if (repeat === 'none') {
      const newTask: Task = {
        id: generateId(), title: result.title,
        date: result.date ?? undefined, time: result.time ?? undefined,
        priority: result.priority, status: 'pending',
        tags: result.tags, createdAt: new Date().toISOString(),
      };
      onTasksChange([newTask, ...tasks]);
      return;
    }

    // Build list of effective weekdays
    const effectiveDays: WeekDay[] = repeat === 'daily'
      ? [0, 1, 2, 3, 4, 5, 6]
      : customDays;

    const dates = expandRecurring(baseDate, endDate, effectiveDays);
    if (dates.length === 0) {
      alert('Seçilen tarih aralığında uygun gün bulunamadı.');
      return;
    }

    const groupId = generateId();
    const newTasks: Task[] = dates.map(d => ({
      id: generateId(), title: result.title,
      date: d, time: result.time ?? undefined,
      priority: result.priority, status: 'pending',
      tags: result.tags, createdAt: new Date().toISOString(),
      recurringGroupId: groupId,
      repeatDays: effectiveDays,
    }));
    onTasksChange([...newTasks, ...tasks]);
  };

  // ── Status change ──────────────────────────────────────────────────────────

  const handleStatusChange = (id: string, status: TaskStatus) => {
    onTasksChange(tasks.map(t => t.id === id ? { ...t, status } : t));
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDeleteRequest = (task: Task) => {
    setDeleteTarget(task);
  };

  const handleDeleteOne = (id: string) => {
    onTasksChange(tasks.filter(t => t.id !== id));
    setDeleteTarget(null);
  };

  const handleDeleteGroup = (groupId: string) => {
    onTasksChange(tasks.filter(t => t.recurringGroupId !== groupId));
    setDeleteTarget(null);
  };

  // ── Filter & sort ──────────────────────────────────────────────────────────

  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (filter !== 'all') result = result.filter(t => t.status === filter);
    if (priorityFilter !== 'all') result = result.filter(t => t.priority === priorityFilter);

    return [...result].sort((a, b) => {
      if (sortBy === 'priority') {
        const order: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
        return order[a.priority] - order[b.priority];
      }
      if (sortBy === 'date') {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return a.date.localeCompare(b.date);
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [tasks, filter, priorityFilter, sortBy]);

  const stats = useMemo(() => ({
    total: tasks.length,
    done: tasks.filter(t => t.status === 'done').length,
    inProgress: tasks.filter(t => t.status === 'in-progress').length,
    pending: tasks.filter(t => t.status === 'pending').length,
    recurring: tasks.filter(t => t.recurringGroupId).length,
  }), [tasks]);

  const completionPct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <div style={{ animation: 'fadeInUp 0.3s ease' }}>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '20px' }}>
        {[
          { label: 'Toplam',       value: stats.total,      color: 'var(--accent)' },
          { label: 'Bekliyor',     value: stats.pending,    color: '#f59e0b' },
          { label: 'Devam Eden',   value: stats.inProgress, color: '#6c63ff' },
          { label: 'Tamamlandı',   value: stats.done,       color: '#10b981' },
          { label: 'Tekrarlayan',  value: stats.recurring,  color: '#a78bfa' },
        ].map(s => (
          <div key={s.label} style={{ padding: '12px 10px', borderRadius: '10px', background: 'var(--surface)', border: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '2px', whiteSpace: 'nowrap' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {stats.total > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--muted-2)' }}>Genel İlerleme</span>
            <span style={{ fontWeight: 600, color: '#10b981' }}>%{completionPct}</span>
          </div>
          <div style={{ height: '6px', borderRadius: '3px', background: 'var(--surface-3)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${completionPct}%`, background: 'linear-gradient(90deg, var(--accent), #10b981)', borderRadius: '3px', transition: 'width 500ms ease' }} />
          </div>
        </div>
      )}

      {/* NLP Input */}
      <NLPInput onParse={handleParse} />

      {/* Filters & Sort */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {/* Status filter */}
        <div style={{ display: 'flex', gap: '4px', background: 'var(--surface-2)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          {(['all', 'pending', 'in-progress', 'done'] as const).map(s => (
            <button
              key={s}
              id={`filter-status-${s}`}
              onClick={() => setFilter(s)}
              style={{
                padding: '4px 10px', borderRadius: '6px', border: 'none',
                background: filter === s ? 'var(--accent)' : 'none',
                color: filter === s ? 'white' : 'var(--muted-2)',
                fontSize: '0.75rem', fontWeight: filter === s ? 600 : 400, cursor: 'pointer',
              }}
            >
              {s === 'all' ? 'Tümü' : s === 'in-progress' ? 'Devam Eden' : s === 'pending' ? 'Bekliyor' : 'Tamamlandı'}
            </button>
          ))}
        </div>

        {/* Priority filter */}
        <div style={{ display: 'flex', gap: '4px', background: 'var(--surface-2)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          {(['all', 'high', 'medium', 'low'] as const).map(p => (
            <button
              key={p}
              id={`filter-priority-${p}`}
              onClick={() => setPriorityFilter(p)}
              style={{
                padding: '4px 10px', borderRadius: '6px', border: 'none',
                background: priorityFilter === p ? (p === 'all' ? 'var(--accent)' : PRIORITY_CONFIG[p as TaskPriority]?.color || 'var(--accent)') : 'none',
                color: priorityFilter === p ? 'white' : 'var(--muted-2)',
                fontSize: '0.75rem', fontWeight: priorityFilter === p ? 600 : 400, cursor: 'pointer',
              }}
            >
              {p === 'all' ? 'Tüm Öncelikler' : PRIORITY_CONFIG[p as TaskPriority].label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <select
          id="task-sort-select"
          value={sortBy}
          onChange={e => setSortBy(e.target.value as typeof sortBy)}
          style={{ marginLeft: 'auto', padding: '6px 10px', borderRadius: '8px', fontSize: '0.78rem' }}
        >
          <option value="created">Sırala: Yeni</option>
          <option value="priority">Sırala: Öncelik</option>
          <option value="date">Sırala: Tarih</option>
        </select>
      </div>

      {/* Task list */}
      <div>
        {filteredTasks.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '48px 24px', color: 'var(--muted)',
            background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>✅</div>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>
              {tasks.length === 0 ? 'Henüz görev yok' : 'Filtreye uyan görev yok'}
            </div>
            <div style={{ fontSize: '0.82rem' }}>
              {tasks.length === 0 ? 'Yukarıya doğal dilde yazarak ilk görevinizi ekleyin!' : 'Filtreleri temizleyin'}
            </div>
          </div>
        ) : (
          filteredTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onStatusChange={handleStatusChange}
              onDeleteRequest={handleDeleteRequest}
            />
          ))
        )}
      </div>

      {/* Delete modal */}
      {deleteTarget && (
        <DeleteModal
          taskId={deleteTarget.id}
          groupId={deleteTarget.recurringGroupId}
          hasGroup={!!deleteTarget.recurringGroupId}
          onDeleteOne={handleDeleteOne}
          onDeleteGroup={handleDeleteGroup}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
