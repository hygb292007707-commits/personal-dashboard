'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface StopwatchState {
  elapsedMs: number;          // ms accumulated before last start
  startTimestamp: number | null; // absolute Date.now() of last start
  isRunning: boolean;
  laps: number[];             // absolute elapsed ms at each lap press
}

interface TimerState {
  totalMs: number;            // full countdown duration
  remainingMs: number;        // ms remaining as of startTimestamp (or when paused)
  startTimestamp: number | null;
  isRunning: boolean;
}

interface TimerPreset {
  id: string;
  title: string;
  totalMs: number;            // duration in ms
  emoji: string;              // displayed on the button
  isDefault?: boolean;        // default presets cannot be deleted (but can be hidden)
}

interface ClockProps {
  presets: TimerPreset[];
  presetsLoading: boolean;
  onPresetsChange: (presets: TimerPreset[]) => void;
}

// ─── localStorage helpers ──────────────────────────────────────────────────────

function loadLS<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const v = window.localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch { return fallback; }
}

function saveLS<T>(key: string, val: T): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ─── Format helpers ────────────────────────────────────────────────────────────

/** Stopwatch: MM:SS.cs  (or HH:MM:SS when ≥1 hour) */
function fmtSW(ms: number): string {
  const totalCs = Math.floor(ms / 10);
  const cs = totalCs % 100;
  const totalSec = Math.floor(ms / 1000);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60) % 60;
  const hr = Math.floor(totalSec / 3600);
  if (hr > 0) {
    return `${pad(hr)}:${pad(min)}:${pad(sec)}`;
  }
  return `${pad(min)}:${pad(sec)}.${pad(cs)}`;
}

/** Timer: HH:MM:SS, always ceiling to next second */
function fmtTimer(ms: number): string {
  const totalSec = Math.ceil(Math.max(0, ms) / 1000);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60) % 60;
  const hr = Math.floor(totalSec / 3600);
  return `${pad(hr)}:${pad(min)}:${pad(sec)}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// ─── Web Audio fallback beep (if mp3 unavailable) ─────────────────────────────

function beepOnce() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    const ctx = new AC() as AudioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.8);
  } catch { /* ignore */ }
}

// ─── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_SW: StopwatchState = {
  elapsedMs: 0, startTimestamp: null, isRunning: false, laps: [],
};
const DEFAULT_TIMER: TimerState = {
  totalMs: 5 * 60 * 1000, remainingMs: 5 * 60 * 1000,
  startTimestamp: null, isRunning: false,
};

/** Built-in presets */
const BUILTIN_PRESETS: TimerPreset[] = [
  { id: 'preset-builtin-1', title: 'Kayısı Yumurta',  totalMs:  6 * 60 * 1000, emoji: '🥚', isDefault: true },
  { id: 'preset-builtin-2', title: 'Sert Yumurta',    totalMs: 10 * 60 * 1000, emoji: '🍳', isDefault: true },
  { id: 'preset-builtin-3', title: 'Pomodoro',        totalMs: 25 * 60 * 1000, emoji: '🍅', isDefault: true },
  { id: 'preset-builtin-4', title: 'Kısa Mola',       totalMs:  5 * 60 * 1000, emoji: '☕', isDefault: true },
];

function fmtPresetDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60) % 60;
  const hr  = Math.floor(totalSec / 3600);
  if (hr > 0) return `${hr}:${pad(min)}:${pad(sec)}`;
  if (sec > 0) return `${min}:${pad(sec)}`;
  return `${min} dk`;
}

function nanoid(): string {
  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ════════════════════════════════════════════════════════════════════════════════
// STOPWATCH
// ════════════════════════════════════════════════════════════════════════════════

function Stopwatch() {
  const [sw, setSw] = useState<StopwatchState>(() => loadLS('dashboard:stopwatch', DEFAULT_SW));
  const [displayMs, setDisplayMs] = useState<number>(() => {
    const s = loadLS<StopwatchState>('dashboard:stopwatch', DEFAULT_SW);
    if (s.isRunning && s.startTimestamp) {
      return s.elapsedMs + (Date.now() - s.startTimestamp);
    }
    return s.elapsedMs;
  });

  const rafRef = useRef<number | null>(null);
  const swRef = useRef(sw);
  swRef.current = sw;

  const tick = useCallback(() => {
    const s = swRef.current;
    if (s.isRunning && s.startTimestamp !== null) {
      setDisplayMs(s.elapsedMs + (Date.now() - s.startTimestamp));
      rafRef.current = requestAnimationFrame(tick);
    }
  }, []);

  useEffect(() => {
    if (sw.isRunning) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      setDisplayMs(sw.elapsedMs);
    }
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [sw.isRunning, tick]);

  const commit = (next: StopwatchState) => {
    setSw(next);
    saveLS('dashboard:stopwatch', next);
  };

  const handleStartPause = () => {
    if (sw.isRunning) {
      const elapsed = sw.startTimestamp !== null
        ? sw.elapsedMs + (Date.now() - sw.startTimestamp)
        : sw.elapsedMs;
      commit({ ...sw, isRunning: false, elapsedMs: elapsed, startTimestamp: null });
    } else {
      commit({ ...sw, isRunning: true, startTimestamp: Date.now() });
    }
  };

  const handleLap = () => {
    if (!sw.isRunning) return;
    const currentMs = sw.startTimestamp !== null
      ? sw.elapsedMs + (Date.now() - sw.startTimestamp)
      : sw.elapsedMs;
    commit({ ...sw, laps: [...sw.laps, currentMs] });
  };

  const handleReset = () => {
    commit(DEFAULT_SW);
    setDisplayMs(0);
  };

  const lapRows = sw.laps.map((ms, i) => ({
    lap: i + 1,
    total: ms,
    delta: i === 0 ? ms : ms - sw.laps[i - 1],
  }));
  const deltas = lapRows.map(l => l.delta);
  const fastest = deltas.length > 1 ? Math.min(...deltas) : null;
  const slowest = deltas.length > 1 ? Math.max(...deltas) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '36px' }}>
      <div style={{
        fontSize: 'clamp(3.5rem, 10vw, 6rem)',
        fontWeight: 700,
        fontFamily: 'var(--font-mono)',
        letterSpacing: '-0.02em',
        color: sw.isRunning ? 'var(--accent-2)' : 'var(--foreground)',
        textShadow: sw.isRunning ? '0 0 48px rgba(167,139,250,0.35)' : 'none',
        transition: 'color 300ms ease, text-shadow 300ms ease',
        lineHeight: 1,
        userSelect: 'none',
      }}>
        {fmtSW(displayMs)}
      </div>

      <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
        <button id="sw-lap-btn" onClick={handleLap} disabled={!sw.isRunning} style={{ width: '76px', height: '76px', borderRadius: '50%', border: '2px solid var(--border)', background: sw.isRunning ? 'var(--surface-2)' : 'var(--surface-3)', color: sw.isRunning ? 'var(--foreground)' : 'var(--muted)', fontSize: '0.85rem', fontWeight: 600, cursor: sw.isRunning ? 'pointer' : 'not-allowed', transition: 'all 200ms ease' }}>Tur</button>
        <button id="sw-start-pause-btn" onClick={handleStartPause} style={{ width: '100px', height: '100px', borderRadius: '50%', border: 'none', background: sw.isRunning ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, var(--accent), var(--accent-2))', color: 'white', fontSize: '1.05rem', fontWeight: 700, cursor: 'pointer', boxShadow: sw.isRunning ? '0 0 32px rgba(239,68,68,0.45)' : '0 0 32px var(--accent-glow)', transition: 'all 200ms ease' }}>{sw.isRunning ? 'Dur' : displayMs > 0 ? 'Devam' : 'Başla'}</button>
        <button id="sw-reset-btn" onClick={handleReset} style={{ width: '76px', height: '76px', borderRadius: '50%', border: '2px solid var(--border)', background: 'var(--surface-2)', color: 'var(--muted-2)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 200ms ease' }}>Sıfırla</button>
      </div>

      {lapRows.length > 0 && (
        <div style={{ width: '100%', maxWidth: '520px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr auto', gap: '8px', padding: '6px 12px 10px', fontSize: '0.68rem', color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', marginBottom: '6px' }}><span>#</span><span>Tur sǬresi</span><span>Toplam</span><span></span></div>
          <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {[...lapRows].reverse().map(({ lap, total, delta }) => {
              const isFastest = fastest !== null && delta === fastest;
              const isSlowest = slowest !== null && delta === slowest;
              const color = isFastest ? '#10b981' : isSlowest ? '#ef4444' : 'var(--foreground)';
              return (
                <div key={lap} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr auto', gap: '8px', padding: '10px 12px', borderRadius: '8px', background: 'var(--surface-2)', fontSize: '0.88rem', alignItems: 'center' }}>
                  <span style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{lap}</span>
                  <span style={{ color, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{fmtSW(delta)}</span>
                  <span style={{ color: 'var(--muted-2)', fontFamily: 'var(--font-mono)' }}>{fmtSW(total)}</span>
                  <span style={{ fontSize: '0.7rem', color, fontWeight: 600, whiteSpace: 'nowrap' }}>{isFastest ? '🏆 En hızlı' : isSlowest ? '🐢 En yavaş' : ''}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// TIMER
// ════════════════════════════════════════════════════════════════════════════════

interface TimerProps {
  presets: TimerPreset[];
  presetsLoading: boolean;
  onPresetsChange: (presets: TimerPreset[]) => void;
}

function Timer({ presets, presetsLoading, onPresetsChange }: TimerProps) {
  const [timer, setTimer] = useState<TimerState>(() => {
    const s = loadLS<TimerState>('dashboard:timer', DEFAULT_TIMER);
    if (s.isRunning && s.startTimestamp !== null) {
      const remaining = Math.max(0, s.remainingMs - (Date.now() - s.startTimestamp));
      return { ...s, remainingMs: remaining > 0 ? s.remainingMs : 0 };
    }
    return s;
  });

  const [displayMs, setDisplayMs] = useState<number>(() => {
    const s = loadLS<TimerState>('dashboard:timer', DEFAULT_TIMER);
    if (s.isRunning && s.startTimestamp !== null) {
      return Math.max(0, s.remainingMs - (Date.now() - s.startTimestamp));
    }
    return s.remainingMs;
  });

  const [alarmActive, setAlarmActive] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>('default');

  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newH, setNewH] = useState(0);
  const [newM, setNewM] = useState(5);
  const [newS, setNewS] = useState(0);
  const [newEmoji, setNewEmoji] = useState('⏳');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const initTotal = loadLS<TimerState>('dashboard:timer', DEFAULT_TIMER).totalMs;
  const [inputH, setInputH] = useState(Math.floor(initTotal / 3600000));
  const [inputM, setInputM] = useState(Math.floor((initTotal % 3600000) / 60000));
  const [inputS, setInputS] = useState(Math.floor((initTotal % 60000) / 1000));

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef(timer);
  const alarmFiredRef = useRef(false);
  timerRef.current = timer;

  useEffect(() => {
    audioRef.current = new Audio('/sounds/alert.mp3');
    audioRef.current.loop = true;
    audioRef.current.preload = 'auto';
    if ('Notification' in window) setNotifPerm(Notification.permission);
    
    const s = loadLS<TimerState>('dashboard:timer', DEFAULT_TIMER);
    if (s.isRunning && s.startTimestamp !== null) {
      const remaining = Math.max(0, s.remainingMs - (Date.now() - s.startTimestamp));
      if (remaining === 0) {
        const finishedState: TimerState = { ...s, isRunning: false, remainingMs: 0, startTimestamp: null };
        setTimer(finishedState);
        saveLS('dashboard:timer', finishedState);
        setDisplayMs(0);
        setAlarmActive(true);
      }
    }
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      audioRef.current?.pause();
    };
  }, []);

  const triggerAlarm = useCallback(() => {
    setAlarmActive(true);
    if (audioRef.current) audioRef.current.play().catch(() => beepOnce());
    else beepOnce();
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('⏰ Zamanlayıcı bitti!', { body: 'SǬre doldu! Susturmak iYǬn tıklayın.', icon: '/favicon.ico' });
    }
  }, []);

  const tick = useCallback(() => {
    const s = timerRef.current;
    if (!s.isRunning || s.startTimestamp === null) return;
    const remaining = Math.max(0, s.remainingMs - (Date.now() - s.startTimestamp));
    setDisplayMs(remaining);
    if (remaining <= 0 && !alarmFiredRef.current) {
      alarmFiredRef.current = true;
      const finished: TimerState = { ...s, isRunning: false, remainingMs: 0, startTimestamp: null };
      setTimer(finished);
      saveLS('dashboard:timer', finished);
      triggerAlarm();
      return;
    }
    if (remaining > 0) rafRef.current = requestAnimationFrame(tick);
  }, [triggerAlarm]);

  useEffect(() => {
    if (timer.isRunning) {
      alarmFiredRef.current = false;
      rafRef.current = requestAnimationFrame(tick);
    } else {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    }
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [timer.isRunning, tick]);

  const commit = (next: TimerState) => {
    setTimer(next);
    saveLS('dashboard:timer', next);
  };

  const handleStartPause = () => {
    if (timer.isRunning) {
      const remaining = timer.startTimestamp !== null
        ? Math.max(0, timer.remainingMs - (Date.now() - timer.startTimestamp))
        : timer.remainingMs;
      commit({ ...timer, isRunning: false, remainingMs: remaining, startTimestamp: null });
      setDisplayMs(remaining);
    } else {
      if (displayMs <= 0) return;
      commit({ ...timer, isRunning: true, startTimestamp: Date.now() });
    }
  };

  const handleReset = () => {
    const totalMs = ((inputH * 3600) + (inputM * 60) + inputS) * 1000;
    const t: TimerState = { totalMs, remainingMs: totalMs, startTimestamp: null, isRunning: false };
    commit(t);
    setDisplayMs(totalMs);
    alarmFiredRef.current = false;
    setAlarmActive(false);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
  };

  const handleSetTime = () => {
    if (timer.isRunning) return;
    const totalMs = ((inputH * 3600) + (inputM * 60) + inputS) * 1000;
    if (totalMs <= 0) return;
    const t: TimerState = { totalMs, remainingMs: totalMs, startTimestamp: null, isRunning: false };
    commit(t);
    setDisplayMs(totalMs);
  };

  const handleSustur = () => {
    setAlarmActive(false);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
  };

  const handleTestSound = () => {
    if (audioRef.current) {
      const a = audioRef.current;
      a.loop = false;
      a.currentTime = 0;
      a.play().catch(() => beepOnce());
      a.loop = true;
    } else {
      beepOnce();
    }
  };

  const handleRequestNotif = async () => {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
  };

  const handleQuickStart = (preset: TimerPreset) => {
    setAlarmActive(false);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    alarmFiredRef.current = false;
    setInputH(Math.floor(preset.totalMs / 3600000));
    setInputM(Math.floor((preset.totalMs % 3600000) / 60000));
    setInputS(Math.floor((preset.totalMs % 60000) / 1000));
    const next: TimerState = {
      totalMs: preset.totalMs,
      remainingMs: preset.totalMs,
      startTimestamp: Date.now(),
      isRunning: true,
    };
    commit(next);
    setDisplayMs(preset.totalMs);
  };

  const handleAddPreset = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    const totalMs = ((newH * 3600) + (newM * 60) + newS) * 1000;
    if (totalMs <= 0) return;
    onPresetsChange([...presets, { id: nanoid(), title, totalMs, emoji: newEmoji || '⏳' }]);
    setShowAddForm(false);
    setNewTitle(''); setNewH(0); setNewM(5); setNewS(0); setNewEmoji('⏳');
  };

  const handleDeletePreset = (id: string) => {
    onPresetsChange(presets.filter(p => p.id !== id));
    setDeletingId(null);
  };

  const handleRestoreDefaults = () => {
    onPresetsChange(BUILTIN_PRESETS);
  };

  const ringSize = 240;
  const strokeW = 14;
  const radius = (ringSize - strokeW) / 2;
  const circ = 2 * Math.PI * radius;
  const progress = timer.totalMs > 0 ? displayMs / timer.totalMs : 0;
  const dashFilled = Math.max(0, Math.min(circ, progress * circ));
  const ringColor = alarmActive ? '#ef4444' : progress > 0.5 ? '#10b981' : progress > 0.2 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '28px' }}>
      <div style={{ position: 'relative', width: ringSize, height: ringSize }}>
        <svg width={ringSize} height={ringSize} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={ringSize / 2} cy={ringSize / 2} r={radius} fill="none" stroke="var(--surface-3)" strokeWidth={strokeW} />
          <circle cx={ringSize / 2} cy={ringSize / 2} r={radius} fill="none" stroke={ringColor} strokeWidth={strokeW} strokeLinecap="round" strokeDasharray={`${dashFilled} ${circ - dashFilled}`} style={{ transition: 'stroke-dasharray 150ms linear, stroke 500ms ease' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 'clamp(1.9rem, 5vw, 2.6rem)', fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em', color: alarmActive ? '#ef4444' : ringColor, textShadow: `0 0 24px ${ringColor}55`, lineHeight: 1, userSelect: 'none' }}>{fmtTimer(displayMs)}</div>
          <div style={{ fontSize: '0.68rem', marginTop: '8px', fontWeight: 600, color: alarmActive ? '#ef4444' : 'var(--muted)', animation: alarmActive ? 'clockPulse 1s ease-in-out infinite' : 'none' }}>{alarmActive ? '⏰ SǬRE DOLDU' : timer.isRunning ? 'Yalışıyor…' : displayMs < timer.totalMs && displayMs > 0 ? 'duraklatıldı' : 'hazır'}</div>
        </div>
      </div>

      {alarmActive && <button id="timer-sustur-btn" onClick={handleSustur} style={{ padding: '14px 40px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', fontSize: '1.05rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 0 28px rgba(239,68,68,0.5)', animation: 'clockPulse 1s ease-in-out infinite' }}>🔕 Sustur</button>}

      {!timer.isRunning && !alarmActive && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {([ { label: 'SA', val: inputH, max: 23, set: setInputH }, { label: 'DK', val: inputM, max: 59, set: setInputM }, { label: 'SN', val: inputS, max: 59, set: setInputS } ] as const).map(({ label, val, max, set }, i) => (
            <React.Fragment key={label}>
              {i > 0 && <span style={{ fontSize: '1.6rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: '20px' }}>:</span>}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                <button id={`timer-up-${label}`} onClick={() => set((v: number) => Math.min(max, v + 1))} style={{ background: 'none', border: 'none', color: 'var(--muted-2)', cursor: 'pointer', fontSize: '1.1rem', padding: '2px 10px', borderRadius: '4px' }}>▲</button>
                <div style={{ width: '62px', textAlign: 'center', fontSize: '1.7rem', fontWeight: 700, fontFamily: 'var(--font-mono)', background: 'var(--surface-2)', borderRadius: '8px', padding: '6px 0', border: '1px solid var(--border)', color: 'var(--foreground)', userSelect: 'none' }}>{pad(val)}</div>
                <div style={{ fontSize: '0.6rem', color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.05em', marginTop: '2px' }}>{label}</div>
                <button id={`timer-down-${label}`} onClick={() => set((v: number) => Math.max(0, v - 1))} style={{ background: 'none', border: 'none', color: 'var(--muted-2)', cursor: 'pointer', fontSize: '1.1rem', padding: '2px 10px', borderRadius: '4px' }}>▼</button>
              </div>
            </React.Fragment>
          ))}
          <button id="timer-set-btn" onClick={handleSetTime} style={{ marginLeft: '10px', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--accent-2)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', alignSelf: 'center', marginTop: '-18px' }}>Ayarla</button>
        </div>
      )}

      {!alarmActive && (
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <button id="timer-reset-btn" onClick={handleReset} style={{ width: '76px', height: '76px', borderRadius: '50%', border: '2px solid var(--border)', background: 'var(--surface-2)', color: 'var(--muted-2)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 200ms ease' }}>Sıfırla</button>
          <button id="timer-start-pause-btn" onClick={handleStartPause} disabled={displayMs <= 0 && !timer.isRunning} style={{ width: '100px', height: '100px', borderRadius: '50%', border: 'none', background: timer.isRunning ? 'linear-gradient(135deg, #ef4444, #dc2626)' : displayMs <= 0 ? 'var(--surface-3)' : 'linear-gradient(135deg, var(--accent), var(--accent-2))', color: displayMs <= 0 && !timer.isRunning ? 'var(--muted)' : 'white', fontSize: '1.05rem', fontWeight: 700, cursor: displayMs <= 0 && !timer.isRunning ? 'not-allowed' : 'pointer', boxShadow: timer.isRunning ? '0 0 32px rgba(239,68,68,0.45)' : displayMs > 0 ? '0 0 32px var(--accent-glow)' : 'none', transition: 'all 200ms ease' }}>{timer.isRunning ? 'Dur' : 'Başla'}</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button id="timer-notif-btn" onClick={handleRequestNotif} style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', transition: 'all 200ms ease', border: `1px solid ${notifPerm === 'granted' ? '#10b981' : notifPerm === 'denied' ? '#ef4444' : 'var(--border)'}`, background: notifPerm === 'granted' ? 'rgba(16,185,129,0.1)' : 'var(--surface-2)', color: notifPerm === 'granted' ? '#10b981' : notifPerm === 'denied' ? '#ef4444' : 'var(--muted-2)' }}>{notifPerm === 'granted' ? '🔔 Bildirimler Aktif' : notifPerm === 'denied' ? '🚫 Bildirimler Engellendi' : '🔔 Bildirimleri Etkinleştir'}</button>
        <button id="timer-test-sound-btn" onClick={handleTestSound} style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--muted-2)', transition: 'all 200ms ease' }}>🔊 Test Sesi</button>
      </div>

      <div style={{ width: '100%', maxWidth: '560px', marginTop: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>⚡ Kayıtlı Sayalar</span>
            <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: '10px', background: 'rgba(108,99,255,0.15)', color: 'var(--accent-2)', border: '1px solid rgba(108,99,255,0.25)' }}>{presets.length}</span>
            {presetsLoading && <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {!presets.some(p => p.isDefault) && <button id="timer-restore-defaults" onClick={handleRestoreDefaults} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'none', color: 'var(--muted)', fontSize: '0.7rem', cursor: 'pointer' }}>Varsayılanları geri yǬkle</button>}
            <button id="timer-add-preset-toggle" onClick={() => setShowAddForm(v => !v)} style={{ width: '28px', height: '28px', borderRadius: '7px', border: 'none', background: showAddForm ? 'var(--surface-3)' : 'rgba(108,99,255,0.2)', color: 'var(--accent-2)', fontWeight: 700, fontSize: '1.05rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>{showAddForm ? '−' : '+'}</button>
          </div>
        </div>

        {showAddForm && (
          <form onSubmit={handleAddPreset} style={{ padding: '14px', borderRadius: '10px', background: 'var(--surface-2)', border: '1px solid var(--border)', marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input id="preset-emoji-input" type="text" value={newEmoji} onChange={e => setNewEmoji(e.target.value.slice(-2) || '⏳')} maxLength={2} style={{ width: '48px', textAlign: 'center', fontSize: '1.3rem', padding: '4px', borderRadius: '7px', flexShrink: 0 }} />
              <input id="preset-title-input" type="text" placeholder="Saya adı (r. ay Demle)" value={newTitle} onChange={e => setNewTitle(e.target.value)} required autoFocus style={{ flex: 1, padding: '6px 10px', borderRadius: '7px', fontSize: '0.85rem' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--muted)', flexShrink: 0 }}>SǬre:</span>
              {([{ label: 'SA', val: newH, max: 23, set: setNewH }, { label: 'DK', val: newM, max: 59, set: setNewM }, { label: 'SN', val: newS, max: 59, set: setNewS }] as const).map(({ label, val, max, set }, i) => (
                <React.Fragment key={label}>
                  {i > 0 && <span style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>:</span>}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                    <input id={`preset-input-${label}`} type="number" min={0} max={max} value={val} onChange={e => set(Math.min(max, Math.max(0, parseInt(e.target.value) || 0)))} style={{ width: '52px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '1rem', padding: '4px 0', borderRadius: '6px' }} />
                    <span style={{ fontSize: '0.55rem', color: 'var(--muted)', letterSpacing: '0.05em' }}>{label}</span>
                  </div>
                </React.Fragment>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => setShowAddForm(false)} style={{ flex: 1, padding: '7px', borderRadius: '7px', border: '1px solid var(--border)', background: 'none', color: 'var(--muted-2)', fontSize: '0.8rem', cursor: 'pointer' }}>İptal</button>
              <button id="preset-save-btn" type="submit" style={{ flex: 1, padding: '7px', borderRadius: '7px', border: 'none', background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', color: 'white', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>Kaydet</button>
            </div>
          </form>
        )}

        {presets.length === 0 && !presetsLoading ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.82rem', padding: '20px 0' }}>HenǬz kayıtlı saya yok. + butonuyla ekleyin.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px' }}>
            {presets.map(preset => {
              const isConfirmingDelete = deletingId === preset.id;
              return (
                <div key={preset.id} style={{ position: 'relative', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface-2)', overflow: 'hidden', transition: 'all 200ms ease' }}>
                  {isConfirmingDelete && (
                    <div style={{ position: 'absolute', inset: 0, zIndex: 2, background: 'rgba(15,17,23,0.94)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--muted-2)', textAlign: 'center' }}>Silinsin mi?</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => setDeletingId(null)} style={{ padding: '4px 10px', borderRadius: '5px', border: '1px solid var(--border)', background: 'none', color: 'var(--muted-2)', fontSize: '0.72rem', cursor: 'pointer' }}>Hayır</button>
                        <button id={`preset-confirm-del-${preset.id}`} onClick={() => handleDeletePreset(preset.id)} style={{ padding: '4px 10px', borderRadius: '5px', border: 'none', background: '#ef4444', color: 'white', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}>Sil</button>
                      </div>
                    </div>
                  )}
                  <button id={`preset-del-${preset.id}`} onClick={e => { e.stopPropagation(); setDeletingId(preset.id); }} title="Sil" style={{ position: 'absolute', top: '4px', right: '4px', zIndex: 1, width: '18px', height: '18px', borderRadius: '4px', border: 'none', background: 'rgba(239,68,68,0)', color: 'var(--muted)', fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, transition: 'all 150ms ease' }}>✕</button>
                  <button id={`preset-quickstart-${preset.id}`} onClick={() => handleQuickStart(preset)} disabled={timer.isRunning} style={{ width: '100%', padding: '14px 10px 12px', border: 'none', background: 'none', cursor: timer.isRunning ? 'not-allowed' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', opacity: timer.isRunning ? 0.5 : 1 }}>
                    <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>{preset.emoji}</span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--foreground)', textAlign: 'center', lineHeight: 1.2 }}>{preset.title}</span>
                    <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-2)', marginTop: '2px' }}>{fmtPresetDuration(preset.totalMs)}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// MAIN CLOCK COMPONENT
// ════════════════════════════════════════════════════════════════════════════════

export default function Clock({ presets, presetsLoading, onPresetsChange }: ClockProps) {
  const [tab, setTab] = useState<'stopwatch' | 'timer'>('stopwatch');

  return (
    <div style={{ animation: 'fadeInUp 0.3s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '48px' }}>
        <div style={{ display: 'flex', gap: '3px', background: 'var(--surface-2)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          {([ { id: 'stopwatch', label: 'Kronometre', emoji: '⏱' }, { id: 'timer', label: 'Zamanlayıcı', emoji: '⏲' } ] as const).map(t => (
            <button key={t.id} id={`clock-tab-${t.id}`} onClick={() => setTab(t.id)} style={{ padding: '11px 32px', borderRadius: '9px', border: 'none', background: tab === t.id ? 'linear-gradient(135deg, var(--accent), var(--accent-2))' : 'none', color: tab === t.id ? 'white' : 'var(--muted-2)', fontWeight: tab === t.id ? 700 : 400, fontSize: '0.92rem', cursor: 'pointer', transition: 'all 200ms ease', display: 'flex', alignItems: 'center', gap: '7px', boxShadow: tab === t.id ? '0 4px 16px var(--accent-glow)' : 'none' }}>
              <span style={{ fontSize: '1.1rem' }}>{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '620px' }}>
          {tab === 'stopwatch' ? <Stopwatch /> : <Timer presets={presets} presetsLoading={presetsLoading} onPresetsChange={onPresetsChange} />}
        </div>
      </div>

      <style>{`
        @keyframes clockPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.7; transform: scale(1.04); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
