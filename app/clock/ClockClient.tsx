'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import Clock from '../../components/Clock';
import { useTable } from '../../lib/hooks/useTable';
import { TABLES } from '../../lib/supabase';

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

function presetFromRow(r: Row): TimerPreset {
  return {
    id:        String(r.id),
    title:     String(r.title),
    totalMs:   Number(r.total_ms),
    emoji:     String(r.emoji),
    isDefault: Boolean(r.is_default),
  };
}

function presetToRow(p: TimerPreset): Row {
  return {
    id:         p.id,
    title:      p.title,
    total_ms:   p.totalMs,
    emoji:      p.emoji,
    is_default: p.isDefault ?? false,
  };
}

export default function ClockClient() {
  // Sync presets with Supabase
  const {
    data: presets,
    loading: presetsLoading,
    insertOne: insertPreset,
    deleteById: deletePresetById,
    replaceAll: replaceAllPresets,
  } = useTable<TimerPreset>({
    table: TABLES.TIMER_PRESETS,
    lsKey: 'dashboard:timer-presets',
    fallback: [],
    orderBy: 'created_at',
    orderAsc: true,
    fromRow: presetFromRow,
    toRow: presetToRow,
  });

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--background)' }}>
      {/* Top bar */}
      <header style={{
        padding: '14px 28px',
        borderBottom: '1px solid var(--border)',
        background: 'rgba(13,15,20,0.85)',
        backdropFilter: 'blur(10px)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        {/* Left: back + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link
            href="/"
            id="clock-back-btn"
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px', borderRadius: '8px',
              border: '1px solid var(--border)', background: 'var(--surface-2)',
              color: 'var(--muted-2)', fontSize: '0.82rem', fontWeight: 500,
              textDecoration: 'none', transition: 'all 150ms ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--accent)';
              (e.currentTarget as HTMLAnchorElement).style.color = 'var(--accent-2)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border)';
              (e.currentTarget as HTMLAnchorElement).style.color = 'var(--muted-2)';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            Dashboard
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '30px', height: '30px', borderRadius: '8px',
              background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '15px', boxShadow: '0 0 12px var(--accent-glow)',
            }}>
              ⏱
            </div>
            <h1 style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem', letterSpacing: '-0.02em' }}>
              Zaman Yönetimi
            </h1>
          </div>
        </div>

        {/* Right: sync state */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {presetsLoading && (
            <div style={{
              fontSize: '0.7rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '6px'
            }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
              Eşitleniyor
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.6 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>PersonalOS</span>
            <span style={{ fontSize: '1rem' }}>⚡</span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '48px 24px', overflowY: 'auto' }}>
        <Clock 
          presets={presets}
          presetsLoading={presetsLoading}
          onPresetsChange={handlePresetsChange}
        />
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
