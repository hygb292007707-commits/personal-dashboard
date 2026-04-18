'use client';

import React, { useState, useMemo, useCallback } from 'react';
import type { CalendarEvent, CalendarView } from '../lib/types';
import { generateId } from '../lib/nlpParser';

interface CalendarProps {
  events: CalendarEvent[];
  onEventsChange: (events: CalendarEvent[]) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isSameDay(a: string, b: string) {
  return a === b;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const COLORS = ['#6c63ff','#10b981','#f59e0b','#ef4444','#06b6d4','#8b5cf6','#f97316'];

// ─── Component: Add Event Modal ───────────────────────────────────────────────

interface AddEventModalProps {
  initialDate: string;
  onSave: (event: Omit<CalendarEvent, 'id' | 'createdAt'>) => void;
  onClose: () => void;
}

function AddEventModal({ initialDate, onSave, onClose }: AddEventModalProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLORS[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({ title: title.trim(), date, startTime, endTime, description, color });
    onClose();
  };

  return (
    <div
      id="event-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        id="event-modal"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '28px',
          width: '380px',
          maxWidth: '90vw',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          animation: 'fadeInUp 0.25s ease',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontWeight: 700, fontSize: '1.1rem', margin: 0 }}>Add Event</h3>
          <button
            id="close-event-modal"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--muted)',
              fontSize: '1.2rem',
              padding: '4px',
              borderRadius: '6px',
              lineHeight: 1,
            }}
          >✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--muted-2)', display: 'block', marginBottom: '6px' }}>Title *</label>
            <input
              id="event-title-input"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Meeting with team..."
              required
              style={{ width: '100%' }}
              autoFocus
            />
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--muted-2)', display: 'block', marginBottom: '6px' }}>Date</label>
            <input
              id="event-date-input"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{ width: '100%', colorScheme: 'dark' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--muted-2)', display: 'block', marginBottom: '6px' }}>Start</label>
              <input
                id="event-start-input"
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                style={{ width: '100%', colorScheme: 'dark' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--muted-2)', display: 'block', marginBottom: '6px' }}>End</label>
              <input
                id="event-end-input"
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                style={{ width: '100%', colorScheme: 'dark' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--muted-2)', display: 'block', marginBottom: '6px' }}>Color</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: c,
                    border: color === c ? '3px solid white' : '2px solid transparent',
                    cursor: 'pointer',
                    boxShadow: color === c ? `0 0 8px ${c}` : 'none',
                  }}
                />
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--muted-2)', display: 'block', marginBottom: '6px' }}>Description</label>
            <textarea
              id="event-desc-input"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional details..."
              rows={2}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'none',
                color: 'var(--muted-2)',
                fontSize: '0.875rem',
              }}
            >
              Cancel
            </button>
            <button
              id="save-event-btn"
              type="submit"
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                color: 'white',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
            >
              Save Event
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Monthly View ────────────────────────────────────────────────────────────

function MonthlyView({ 
  year, month, events, today, onDayClick
}: { 
  year: number; month: number; events: CalendarEvent[]; today: string; onDayClick: (date: string) => void 
}) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
        {DAY_NAMES.map(d => (
          <div key={d} style={{ textAlign: 'center', padding: '8px 4px', fontSize: '0.7rem', fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.05em' }}>
            {d}
          </div>
        ))}
      </div>
      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayEvents = events.filter(e => e.date === dateStr);
          const isToday = dateStr === today;
          return (
            <div
              key={idx}
              id={`calendar-day-${dateStr}`}
              onClick={() => onDayClick(dateStr)}
              style={{
                minHeight: '80px',
                padding: '6px',
                borderRadius: '8px',
                background: isToday ? 'rgba(108,99,255,0.12)' : 'var(--surface-2)',
                border: isToday ? '1px solid var(--accent)' : '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'all 200ms ease',
              }}
              onMouseEnter={e => {
                if (!isToday) (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-3)';
              }}
              onMouseLeave={e => {
                if (!isToday) (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-2)';
              }}
            >
              <div style={{
                fontSize: '0.8rem',
                fontWeight: isToday ? 700 : 400,
                color: isToday ? 'var(--accent)' : 'var(--foreground)',
                marginBottom: '4px',
              }}>
                {day}
              </div>
              {dayEvents.slice(0, 3).map(ev => (
                <div
                  key={ev.id}
                  style={{
                    fontSize: '0.65rem',
                    padding: '2px 5px',
                    borderRadius: '4px',
                    background: ev.color || 'var(--accent)',
                    color: 'white',
                    marginBottom: '2px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontWeight: 500,
                  }}
                >
                  {ev.title}
                </div>
              ))}
              {dayEvents.length > 3 && (
                <div style={{ fontSize: '0.6rem', color: 'var(--muted)', marginTop: '2px' }}>+{dayEvents.length - 3} more</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Weekly View ─────────────────────────────────────────────────────────────

function WeeklyView({
  weekStart, events, today, onDayClick
}: {
  weekStart: Date; events: CalendarEvent[]; today: string; onDayClick: (date: string) => void
}) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  const hours = Array.from({ length: 16 }, (_, i) => i + 7); // 7am-10pm

  return (
    <div style={{ overflowX: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', borderBottom: '1px solid var(--border)', marginBottom: '0' }}>
        <div />
        {days.map((d) => {
          const ds = formatDate(d);
          const isToday = ds === today;
          return (
            <div
              key={ds}
              style={{
                textAlign: 'center',
                padding: '10px 4px',
                borderLeft: '1px solid var(--border)',
                background: isToday ? 'rgba(108,99,255,0.08)' : 'transparent',
              }}
            >
              <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 500 }}>
                {DAY_NAMES[d.getDay()]}
              </div>
              <div style={{
                fontSize: '1.1rem',
                fontWeight: isToday ? 700 : 400,
                color: isToday ? 'var(--accent)' : 'var(--foreground)',
                marginTop: '2px',
              }}>
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>
      {/* Time grid */}
      <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
        {hours.map(h => (
          <div key={h} style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', borderBottom: '1px solid rgba(42,47,66,0.5)', minHeight: '48px' }}>
            <div style={{ padding: '4px 8px 0', fontSize: '0.65rem', color: 'var(--muted)', textAlign: 'right' }}>
              {h % 12 || 12}{h < 12 ? 'am' : 'pm'}
            </div>
            {days.map((d) => {
              const ds = formatDate(d);
              const hourEvents = events.filter(e => {
                if (e.date !== ds) return false;
                const startH = e.startTime ? parseInt(e.startTime.split(':')[0]) : -1;
                return startH === h;
              });
              const isToday = ds === today;
              return (
                <div
                  key={ds}
                  onClick={() => onDayClick(ds)}
                  style={{
                    borderLeft: '1px solid var(--border)',
                    padding: '2px 4px',
                    cursor: 'pointer',
                    background: isToday ? 'rgba(108,99,255,0.04)' : 'transparent',
                    minHeight: '48px',
                  }}
                >
                  {hourEvents.map(ev => (
                    <div
                      key={ev.id}
                      style={{
                        fontSize: '0.65rem',
                        padding: '3px 6px',
                        borderRadius: '4px',
                        marginBottom: '2px',
                        fontWeight: 500,
                        borderLeft: `3px solid ${ev.color || 'var(--accent)'}`,
                        background: `${ev.color || 'var(--accent)'}22`,
                        color: ev.color || 'var(--accent-2)',
                      }}
                    >
                      {ev.startTime} {ev.title}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Daily View ───────────────────────────────────────────────────────────────

function DailyView({
  date, events, onAddEvent
}: {
  date: Date; events: CalendarEvent[]; onAddEvent: () => void
}) {
  const ds = formatDate(date);
  const dayEvents = events.filter(e => e.date === ds).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  const hours = Array.from({ length: 17 }, (_, i) => i + 6); // 6am - 10pm

  return (
    <div>
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
            {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '2px' }}>
            {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
          </div>
        </div>
        <button
          id="add-event-daily-btn"
          onClick={onAddEvent}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
            color: 'white',
            fontWeight: 600,
            fontSize: '0.8rem',
          }}
        >
          + Add Event
        </button>
      </div>
      <div style={{ maxHeight: '520px', overflowY: 'auto', position: 'relative' }}>
        {hours.map(h => {
          const hourEvents = dayEvents.filter(e => {
            const startH = e.startTime ? parseInt(e.startTime.split(':')[0]) : -1;
            return startH === h;
          });
          return (
            <div key={h} style={{ display: 'flex', borderTop: '1px solid rgba(42,47,66,0.5)', minHeight: '56px' }}>
              <div style={{ width: '56px', flexShrink: 0, padding: '8px 8px 0', fontSize: '0.7rem', color: 'var(--muted)', textAlign: 'right' }}>
                {h % 12 || 12}{h < 12 ? ' AM' : ' PM'}
              </div>
              <div style={{ flex: 1, padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {hourEvents.map(ev => (
                  <div
                    key={ev.id}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      borderLeft: `3px solid ${ev.color || 'var(--accent)'}`,
                      background: `${ev.color || 'var(--accent)'}22`,
                      color: ev.color || 'var(--accent-2)',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{ev.title}</div>
                    {ev.startTime && (
                      <div style={{ fontSize: '0.72rem', opacity: 0.8, marginTop: '2px' }}>
                        {ev.startTime}{ev.endTime ? ` – ${ev.endTime}` : ''}
                      </div>
                    )}
                    {ev.description && (
                      <div style={{ fontSize: '0.72rem', opacity: 0.7, marginTop: '4px' }}>{ev.description}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Calendar Component ──────────────────────────────────────────────────

export default function Calendar({ events, onEventsChange }: CalendarProps) {
  const today = useMemo(() => formatDate(new Date()), []);
  const [view, setView] = useState<CalendarView>('monthly');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(today);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const getWeekStart = (d: Date) => {
    const s = new Date(d);
    s.setDate(d.getDate() - d.getDay());
    return s;
  };

  const navigate = (dir: number) => {
    const d = new Date(currentDate);
    if (view === 'monthly') d.setMonth(d.getMonth() + dir);
    else if (view === 'weekly') d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    setCurrentDate(d);
  };

  const headerLabel = useMemo(() => {
    if (view === 'monthly') return `${MONTH_NAMES[month]} ${year}`;
    if (view === 'weekly') {
      const ws = getWeekStart(currentDate);
      const we = new Date(ws);
      we.setDate(ws.getDate() + 6);
      return `${ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${we.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }, [view, currentDate, month, year]);

  const handleDayClick = (date: string) => {
    setSelectedDate(date);
    setCurrentDate(new Date(date + 'T12:00:00'));
    setView('daily');
  };

  const handleAddEvent = (eventData: Omit<CalendarEvent, 'id' | 'createdAt'>) => {
    const newEvent: CalendarEvent = {
      ...eventData,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    onEventsChange([...events, newEvent]);
  };

  const handleDeleteEvent = (id: string) => {
    onEventsChange(events.filter(e => e.id !== id));
  };

  return (
    <div style={{ animation: 'fadeInUp 0.3s ease' }}>
      {/* Calendar Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '2px', background: 'var(--surface-2)', borderRadius: '8px', padding: '2px', border: '1px solid var(--border)' }}>
            {(['daily', 'weekly', 'monthly'] as CalendarView[]).map(v => (
              <button
                key={v}
                id={`calendar-view-${v}`}
                onClick={() => setView(v)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: view === v ? 'var(--accent)' : 'none',
                  color: view === v ? 'white' : 'var(--muted-2)',
                  fontSize: '0.8rem',
                  fontWeight: view === v ? 600 : 400,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              id="calendar-prev"
              onClick={() => navigate(-1)}
              style={{
                width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border)',
                background: 'var(--surface-2)', color: 'var(--foreground)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
              }}
            >←</button>
            <span style={{ fontWeight: 600, fontSize: '0.9rem', minWidth: '200px', textAlign: 'center' }}>{headerLabel}</span>
            <button
              id="calendar-next"
              onClick={() => navigate(1)}
              style={{
                width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border)',
                background: 'var(--surface-2)', color: 'var(--foreground)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
              }}
            >→</button>
          </div>
          <button
            id="calendar-today-btn"
            onClick={() => setCurrentDate(new Date())}
            style={{
              padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border)',
              background: 'var(--surface-2)', color: 'var(--muted-2)', fontSize: '0.8rem',
            }}
          >Today</button>
          <button
            id="add-event-btn"
            onClick={() => { setSelectedDate(today); setShowModal(true); }}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none',
              background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
              color: 'white', fontWeight: 600, fontSize: '0.85rem',
            }}
          >+ Event</button>
        </div>
      </div>

      {/* Calendar Body */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
        {view === 'monthly' && (
          <MonthlyView year={year} month={month} events={events} today={today} onDayClick={handleDayClick} />
        )}
        {view === 'weekly' && (
          <WeeklyView weekStart={getWeekStart(currentDate)} events={events} today={today} onDayClick={handleDayClick} />
        )}
        {view === 'daily' && (
          <DailyView date={currentDate} events={events} onAddEvent={() => { setSelectedDate(formatDate(currentDate)); setShowModal(true); }} />
        )}
      </div>

      {/* Upcoming events */}
      {view === 'monthly' && (
        <div style={{ marginTop: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '12px', color: 'var(--muted-2)' }}>Upcoming Events</div>
          {events
            .filter(e => e.date >= today)
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(0, 5)
            .map(ev => (
              <div
                key={ev.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  marginBottom: '6px',
                }}
              >
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: ev.color || 'var(--accent)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '2px' }}>
                    {new Date(ev.date + 'T12:00:00').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })}
                    {ev.startTime ? ` · ${ev.startTime}` : ''}
                  </div>
                </div>
                <button
                  id={`delete-event-${ev.id}`}
                  onClick={() => handleDeleteEvent(ev.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.9rem', padding: '4px', borderRadius: '4px' }}
                >✕</button>
              </div>
            ))}
          {events.filter(e => e.date >= today).length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem', padding: '16px 0' }}>
              No upcoming events. Click a day to add one!
            </div>
          )}
        </div>
      )}

      {/* Add Event Modal */}
      {showModal && (
        <AddEventModal
          initialDate={selectedDate}
          onSave={handleAddEvent}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
