'use client';

import React, { useState, useMemo } from 'react';
import type { Transaction, TransactionType, TransactionCategory, FinanceState, MonthlyBudget } from '../lib/types';
import { generateId } from '../lib/nlpParser';

interface FinanceProps {
  state: FinanceState;
  loading: boolean;
  onStateChange: (state: FinanceState) => void;
}

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<TransactionCategory, { label: string; emoji: string; type: 'income' | 'expense' | 'both' }> = {
  food:          { label: 'Yemek & Restoran', emoji: '🍔', type: 'expense' },
  transport:     { label: 'Ulaşım',           emoji: '🚗', type: 'expense' },
  entertainment: { label: 'Eğlence',          emoji: '🎬', type: 'expense' },
  health:        { label: 'Sağlık',           emoji: '💊', type: 'expense' },
  shopping:      { label: 'Alışveriş',        emoji: '🛍️', type: 'expense' },
  utilities:     { label: 'Faturalar',        emoji: '💡', type: 'expense' },
  salary:        { label: 'Maaş',             emoji: '💼', type: 'income' },
  freelance:     { label: 'Serbest Çalışma',  emoji: '💻', type: 'income' },
  investment:    { label: 'Yatırım',          emoji: '📈', type: 'both' },
  other:         { label: 'Diğer',            emoji: '📦', type: 'both' },
};

const EXPENSE_CATEGORIES = (Object.entries(CATEGORY_CONFIG) as [TransactionCategory, typeof CATEGORY_CONFIG[TransactionCategory]][])
  .filter(([, c]) => c.type === 'expense' || c.type === 'both')
  .map(([k]) => k);

const INCOME_CATEGORIES = (Object.entries(CATEGORY_CONFIG) as [TransactionCategory, typeof CATEGORY_CONFIG[TransactionCategory]][])
  .filter(([, c]) => c.type === 'income' || c.type === 'both')
  .map(([k]) => k);

// ─── Turkish Lira formatter ───────────────────────────────────────────────────

function fmt(amount: number) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
  }).format(amount);
}

// ─── Chart colors ─────────────────────────────────────────────────────────────

const CHART_COLORS = ['#6c63ff','#10b981','#f59e0b','#ef4444','#06b6d4','#8b5cf6','#f97316','#ec4899','#14b8a6','#a3e635'];

// ─── Donut Chart ──────────────────────────────────────────────────────────────

interface DonutChartProps {
  data: { label: string; value: number; color: string }[];
  total: number;
}

function DonutChart({ data, total }: DonutChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const size = 160;
  const strokeWidth = 28;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const segments = data.map((d, i) => {
    const pct = total > 0 ? d.value / total : 0;
    const dash = pct * circumference;
    const gap = circumference - dash;
    const seg = { ...d, dashArray: `${dash} ${gap}`, offset, index: i };
    offset += dash;
    return seg;
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="var(--surface-3)" strokeWidth={strokeWidth} />
          {segments.map((seg, i) => (
            <circle
              key={i}
              cx={size/2} cy={size/2} r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={hovered === i ? strokeWidth + 4 : strokeWidth}
              strokeDasharray={seg.dashArray}
              strokeDashoffset={-seg.offset}
              style={{ cursor: 'pointer', transition: 'stroke-width 200ms ease' }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ fontSize: hovered !== null ? '0.7rem' : '0.85rem', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.2, textAlign: 'center', padding: '0 8px' }}>
            {hovered !== null ? fmt(data[hovered].value) : fmt(total)}
          </div>
          <div style={{ fontSize: '0.6rem', color: 'var(--muted)', marginTop: '2px' }}>
            {hovered !== null ? data[hovered].label : 'Toplam'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
        {data.map((d, i) => (
          <div
            key={i}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              cursor: 'pointer',
              opacity: hovered !== null && hovered !== i ? 0.5 : 1,
              transition: 'opacity 200ms ease',
            }}
          >
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: d.color, flexShrink: 0 }} />
            <div style={{ fontSize: '0.78rem', color: 'var(--muted-2)', flex: 1 }}>{d.label}</div>
            <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>{total > 0 ? `${((d.value / total) * 100).toFixed(0)}%` : '0%'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Daily Bar Chart ──────────────────────────────────────────────────────────

interface DailyBarChartProps {
  transactions: Transaction[];
}

function DailyBarChart({ transactions }: DailyBarChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  // Build last 30 days bucket
  const days = useMemo(() => {
    const today = new Date();
    const result: { label: string; date: string; amount: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const dayLabel = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
      const amount = transactions
        .filter(t => t.type === 'expense' && t.date === dateStr)
        .reduce((s, t) => s + t.amount, 0);
      result.push({ label: dayLabel, date: dateStr, amount });
    }
    return result;
  }, [transactions]);

  const maxAmount = Math.max(...days.map(d => d.amount), 1);
  // Show only last 14 days in the visible chart to avoid crowding
  const visible = days.slice(-14);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '80px', padding: '4px 0' }}>
        {visible.map((day, i) => {
          const pct = day.amount > 0 ? (day.amount / maxAmount) * 100 : 0;
          const isHovered = hovered === i;
          return (
            <div
              key={day.date}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', position: 'relative' }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {isHovered && day.amount > 0 && (
                <div style={{
                  position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: '6px', padding: '4px 8px', fontSize: '0.65rem',
                  whiteSpace: 'nowrap', zIndex: 10, marginBottom: '4px', fontWeight: 600,
                  color: 'var(--foreground)',
                }}>
                  {fmt(day.amount)}
                </div>
              )}
              <div
                style={{
                  width: '100%',
                  height: pct > 0 ? `${pct}%` : '3px',
                  background: isHovered
                    ? 'linear-gradient(180deg, var(--accent), var(--accent-2))'
                    : pct > 0 ? 'rgba(108,99,255,0.45)' : 'var(--surface-3)',
                  borderRadius: '3px 3px 1px 1px',
                  transition: 'all 150ms ease',
                  minHeight: '3px',
                }}
              />
            </div>
          );
        })}
      </div>
      {/* X-axis labels — show every 3rd */}
      <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
        {visible.map((day, i) => (
          <div key={day.date} style={{ flex: 1, textAlign: 'center', fontSize: '0.55rem', color: i % 3 === 0 ? 'var(--muted)' : 'transparent', overflow: 'hidden' }}>
            {day.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Monthly Budget Card ──────────────────────────────────────────────────────

interface MonthlyBudgetCardProps {
  monthlyBudget: MonthlyBudget | null;
  currentExpense: number;
  onUpdate: (budget: MonthlyBudget | null) => void;
}

function MonthlyBudgetCard({ monthlyBudget, currentExpense, onUpdate }: MonthlyBudgetCardProps) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const budget = monthlyBudget?.month === currentMonth ? monthlyBudget : null;

  const pct = budget ? Math.min((currentExpense / budget.limit) * 100, 100) : 0;
  const color = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#10b981';

  const handleSave = () => {
    const val = parseFloat(inputVal);
    if (!val || val <= 0) return;
    onUpdate({ limit: val, month: currentMonth });
    setEditing(false);
    setInputVal('');
  };

  const handleRemove = () => {
    onUpdate(null);
    setEditing(false);
  };

  return (
    <div style={{ padding: '20px', borderRadius: '12px', background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontWeight: 600, fontSize: '0.72rem', color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          💰 Aylık Bütçe
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {budget && (
            <button
              id="remove-budget-btn"
              onClick={handleRemove}
              style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.72rem', cursor: 'pointer', padding: '2px 6px', borderRadius: '4px' }}
            >
              Kaldır
            </button>
          )}
          <button
            id="set-budget-btn"
            onClick={() => { setEditing(!editing); setInputVal(budget ? String(budget.limit) : ''); }}
            style={{
              background: 'none', border: '1px solid var(--border)', color: 'var(--accent-2)',
              fontSize: '0.72rem', cursor: 'pointer', padding: '2px 10px', borderRadius: '6px',
            }}
          >
            {budget ? 'Düzenle' : 'Limit Belirle'}
          </button>
        </div>
      </div>

      {editing && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <input
            id="budget-limit-input"
            type="number"
            min="1"
            step="100"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            placeholder="Aylık limit (₺)"
            autoFocus
            style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem' }}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
          <button
            id="save-budget-btn"
            onClick={handleSave}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none',
              background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
              color: 'white', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
            }}
          >
            Kaydet
          </button>
        </div>
      )}

      {budget ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.82rem' }}>
            <span style={{ color: color, fontWeight: 700 }}>{fmt(currentExpense)}</span>
            <span style={{ color: 'var(--muted)' }}>/ {fmt(budget.limit)}</span>
          </div>
          <div style={{ height: '8px', borderRadius: '4px', background: 'var(--surface-3)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${pct}%`,
              background: pct >= 90
                ? 'linear-gradient(90deg,#ef4444,#dc2626)'
                : pct >= 70
                  ? 'linear-gradient(90deg,#f59e0b,#d97706)'
                  : 'linear-gradient(90deg,#10b981,#059669)',
              borderRadius: '4px',
              transition: 'width 600ms ease',
            }} />
          </div>
          <div style={{ marginTop: '6px', fontSize: '0.7rem', color: color, fontWeight: 600 }}>
            {pct >= 100
              ? '⚠️ Bütçe aşıldı!'
              : pct >= 70
                ? `⚡ Bütçenin %${pct.toFixed(0)}'i kullanıldı`
                : `✓ ${fmt(budget.limit - currentExpense)} kaldı (%${(100 - pct).toFixed(0)})`}
          </div>
        </div>
      ) : (
        <div style={{ color: 'var(--muted)', fontSize: '0.82rem', textAlign: 'center', padding: '8px 0' }}>
          Bu ay için limit belirlenmedi.
        </div>
      )}
    </div>
  );
}

// ─── Add Transaction Modal ────────────────────────────────────────────────────

interface AddTransactionModalProps {
  onSave: (tx: Omit<Transaction, 'id' | 'createdAt'>) => void;
  onClose: () => void;
}

function AddTransactionModal({ onSave, onClose }: AddTransactionModalProps) {
  const [type, setType] = useState<TransactionType>('expense');
  const [category, setCategory] = useState<TransactionCategory>('food');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    onSave({ type, category, amount: amt, description: description || CATEGORY_CONFIG[category].label, date });
    onClose();
  };

  return (
    <div
      id="transaction-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div id="transaction-modal" style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px',
        padding: '28px', width: '380px', maxWidth: '90vw',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)', animation: 'fadeInUp 0.25s ease',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontWeight: 700, fontSize: '1.1rem', margin: 0 }}>İşlem Ekle</h3>
          <button id="close-tx-modal" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '1.2rem', padding: '4px', borderRadius: '6px', cursor: 'pointer' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Type toggle */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {(['expense', 'income'] as const).map(t => (
              <button
                key={t}
                type="button"
                id={`tx-type-${t}`}
                onClick={() => { setType(t); setCategory(t === 'income' ? 'salary' : 'food'); }}
                style={{
                  padding: '10px', borderRadius: '8px',
                  border: `2px solid ${type === t ? (t === 'income' ? '#10b981' : '#ef4444') : 'var(--border)'}`,
                  background: type === t ? (t === 'income' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)') : 'none',
                  color: type === t ? (t === 'income' ? '#10b981' : '#ef4444') : 'var(--muted-2)',
                  fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
                }}
              >
                {t === 'expense' ? '⬇ Gider' : '⬆ Gelir'}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--muted-2)', display: 'block', marginBottom: '6px' }}>Tutar (₺) *</label>
            <input
              id="tx-amount-input"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0,00"
              required
              style={{ width: '100%', fontSize: '1.1rem', padding: '10px 14px' }}
              autoFocus
            />
          </div>

          {/* Category */}
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--muted-2)', display: 'block', marginBottom: '6px' }}>Kategori</label>
            <select id="tx-category-select" value={category} onChange={e => setCategory(e.target.value as TransactionCategory)} style={{ width: '100%' }}>
              {categories.map(c => (
                <option key={c} value={c}>
                  {CATEGORY_CONFIG[c].emoji} {CATEGORY_CONFIG[c].label}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--muted-2)', display: 'block', marginBottom: '6px' }}>Açıklama</label>
            <input
              id="tx-desc-input"
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="İsteğe bağlı açıklama..."
              style={{ width: '100%' }}
            />
          </div>

          {/* Date */}
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--muted-2)', display: 'block', marginBottom: '6px' }}>Tarih</label>
            <input id="tx-date-input" type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: '100%', colorScheme: 'dark' }} />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'none', color: 'var(--muted-2)', fontSize: '0.875rem', cursor: 'pointer' }}>İptal</button>
            <button id="save-tx-btn" type="submit" style={{
              flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
              background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
              color: 'white', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
            }}>Kaydet</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Finance component ───────────────────────────────────────────────────

export default function Finance({ state, loading, onStateChange }: FinanceProps) {
  const { transactions, monthlyBudget } = state;
  const [showModal, setShowModal] = useState(false);
  const [period, setPeriod] = useState<'week' | 'month' | 'year' | 'all'>('month');

  const now = new Date();

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (period === 'all') return true;
      const d = new Date(t.date + 'T12:00:00');
      const now = new Date();
      if (period === 'week') {
        const weekAgo = new Date(); weekAgo.setDate(now.getDate() - 7);
        return d >= weekAgo;
      }
      if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (period === 'year') return d.getFullYear() === now.getFullYear();
      return true;
    });
  }, [transactions, period]);

  const stats = useMemo(() => {
    const income = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { income, expense, balance: income - expense };
  }, [filtered]);

  // Monthly expense for budget tracking (always current month regardless of period filter)
  const currentMonthExpense = useMemo(() => {
    return transactions.filter(t => {
      const d = new Date(t.date + 'T12:00:00');
      return t.type === 'expense' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce((s, t) => s + t.amount, 0);
  }, [transactions, now]);

  const expenseByCategory = useMemo(() => {
    const map = new Map<TransactionCategory, number>();
    filtered.filter(t => t.type === 'expense').forEach(t => {
      map.set(t.category, (map.get(t.category) || 0) + t.amount);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cat, val], i) => ({
        label: `${CATEGORY_CONFIG[cat].emoji} ${CATEGORY_CONFIG[cat].label}`,
        value: val,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }));
  }, [filtered]);

  const handleAddTransaction = (tx: Omit<Transaction, 'id' | 'createdAt'>) => {
    const newTx: Transaction = { ...tx, id: generateId(), createdAt: new Date().toISOString() };
    onStateChange({ ...state, transactions: [newTx, ...transactions] });
  };

  const handleDeleteTransaction = (id: string) => {
    onStateChange({ ...state, transactions: transactions.filter(t => t.id !== id) });
  };

  const handleBudgetUpdate = (budget: MonthlyBudget | null) => {
    onStateChange({ ...state, monthlyBudget: budget });
  };

  const PERIOD_LABELS: Record<string, string> = {
    week: 'Bu Hafta',
    month: 'Bu Ay',
    year: 'Bu Yıl',
    all: 'Tüm Zamanlar',
  };

  return (
    <div style={{ animation: 'fadeInUp 0.3s ease' }}>
      {/* Header with controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '2px', background: 'var(--surface-2)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          {(['week', 'month', 'year', 'all'] as const).map(p => (
            <button
              key={p}
              id={`finance-period-${p}`}
              onClick={() => setPeriod(p)}
              style={{
                padding: '5px 12px', borderRadius: '6px', border: 'none',
                background: period === p ? 'var(--accent)' : 'none',
                color: period === p ? 'white' : 'var(--muted-2)',
                fontSize: '0.78rem', fontWeight: period === p ? 600 : 400, cursor: 'pointer',
              }}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {loading && (
            <div style={{
              width: '18px', height: '18px', borderRadius: '50%',
              border: '2px solid var(--border)', borderTopColor: 'var(--accent)',
              animation: 'spin 0.8s linear infinite',
            }} />
          )}
          <button
            id="add-transaction-btn"
            onClick={() => setShowModal(true)}
            style={{
              padding: '8px 18px', borderRadius: '8px', border: 'none',
              background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
              color: 'white', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
            }}
          >
            + İşlem Ekle
          </button>
        </div>

      </div>

      {/* Monthly Budget */}
      <MonthlyBudgetCard
        monthlyBudget={monthlyBudget}
        currentExpense={currentMonthExpense}
        onUpdate={handleBudgetUpdate}
      />

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '20px' }}>
        {[
          { label: 'Gelir', value: stats.income, color: '#10b981', bg: 'rgba(16,185,129,0.1)', icon: '⬆' },
          { label: 'Gider', value: stats.expense, color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: '⬇' },
          { label: 'Bakiye', value: stats.balance, color: stats.balance >= 0 ? '#10b981' : '#ef4444', bg: stats.balance >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', icon: '💰' },
        ].map(s => (
          <div key={s.label} style={{
            padding: '18px 20px', borderRadius: '12px', background: s.bg,
            border: `1px solid ${s.color}33`,
          }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--muted-2)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '8px' }}>
              {s.icon} {s.label}
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: s.color, letterSpacing: '-0.02em' }}>
              {fmt(Math.abs(s.value))}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '4px' }}>
              {filtered.filter(t => s.label === 'Gelir' ? t.type === 'income' : t.type === 'expense').length} işlem
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        {/* Donut breakdown */}
        <div style={{ padding: '20px', borderRadius: '12px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 600, fontSize: '0.72rem', marginBottom: '16px', color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Kategori Dağılımı
          </div>
          {expenseByCategory.length > 0 ? (
            <DonutChart data={expenseByCategory} total={stats.expense} />
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px 0', fontSize: '0.85rem' }}>
              Bu dönemde gider yok
            </div>
          )}
        </div>

        {/* Daily bar chart */}
        <div style={{ padding: '20px', borderRadius: '12px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 600, fontSize: '0.72rem', marginBottom: '12px', color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Günlük Harcama (Son 14 Gün)
          </div>
          <DailyBarChart transactions={transactions} />
        </div>
      </div>

      {/* Top categories */}
      <div style={{ padding: '20px', borderRadius: '12px', background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: '20px' }}>
        <div style={{ fontWeight: 600, fontSize: '0.72rem', marginBottom: '16px', color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          En Yüksek Harcamalar
        </div>
        {expenseByCategory.slice(0, 5).map((c) => (
          <div key={c.label} style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--muted-2)' }}>{c.label}</span>
              <span style={{ fontWeight: 600 }}>{fmt(c.value)}</span>
            </div>
            <div style={{ height: '4px', borderRadius: '2px', background: 'var(--surface-3)', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${stats.expense > 0 ? (c.value / stats.expense) * 100 : 0}%`,
                background: c.color,
                borderRadius: '2px',
              }} />
            </div>
          </div>
        ))}
        {expenseByCategory.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px 0', fontSize: '0.85rem' }}>
            Henüz gider yok
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
        <div style={{ fontWeight: 600, fontSize: '0.72rem', marginBottom: '16px', color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Son İşlemler
        </div>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0', fontSize: '0.85rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>💳</div>
            Henüz işlem yok. &quot;+ İşlem Ekle&quot; ile başlayın!
          </div>
        ) : (
          [...filtered]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, 15)
            .map(tx => {
              const cat = CATEGORY_CONFIG[tx.category];
              const isIncome = tx.type === 'income';
              return (
                <div
                  key={tx.id}
                  id={`tx-${tx.id}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '12px 0', borderBottom: '1px solid rgba(42,47,66,0.5)',
                  }}
                >
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '9px', flexShrink: 0,
                    background: isIncome ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem',
                  }}>
                    {cat.emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tx.description}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '2px' }}>
                      {cat.label} · {new Date(tx.date + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: isIncome ? '#10b981' : '#ef4444' }}>
                      {isIncome ? '+' : '-'}{fmt(tx.amount)}
                    </div>
                  </div>
                  <button
                    id={`delete-tx-${tx.id}`}
                    onClick={() => handleDeleteTransaction(tx.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.8rem', padding: '4px', borderRadius: '4px', cursor: 'pointer', flexShrink: 0 }}
                  >✕</button>
                </div>
              );
            })
        )}
      </div>

      {showModal && (
        <AddTransactionModal
          onSave={handleAddTransaction}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
