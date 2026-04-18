/**
 * A lightweight hook that fetches rows from a Supabase table and provides
 * insert / delete helpers. Falls back to localStorage on error so the app
 * degrades gracefully if the DB is unreachable.
 */
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import type { PostgrestError } from '@supabase/supabase-js';

type Row = Record<string, unknown>;

interface UseTableOptions<T> {
  /** Supabase table name */
  table: string;
  /** localStorage key used as a fallback / offline cache */
  lsKey: string;
  /** Default value when both DB and LS are empty */
  fallback: T[];
  /** Optional column to order by (default: 'created_at') */
  orderBy?: string;
  orderAsc?: boolean;
  /** Map snake_case DB rows → camelCase app types */
  fromRow: (row: Row) => T;
  /** Map camelCase app type → snake_case DB row */
  toRow: (item: T) => Row;
}

interface UseTableResult<T> {
  data: T[];
  loading: boolean;
  error: PostgrestError | null;
  /** 
   * Insert a single item into DB and optimistically update local state.
   * Will swap the temporary ID with the real DB-generated ID upon success.
   */
  insertOne: (item: T) => Promise<T | null>;
  /** Delete by primary key (column named `id`) */
  deleteById: (id: string) => Promise<void>;
  /** Replace entire dataset (upsert all, then prune removed). 
   * WARNING: Upsert requires IDs to exist. Use insertOne for new records.
   */
  replaceAll: (items: T[]) => Promise<void>;
  /** Refresh from DB */
  refresh: () => Promise<void>;
}

function readLS<T>(key: string, fallback: T[]): T[] {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : fallback;
  } catch { return fallback; }
}

function writeLS<T>(key: string, data: T[]): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

export function useTable<T extends { id: string }>({
  table, lsKey, fallback, orderBy = 'created_at', orderAsc = false, fromRow, toRow,
}: UseTableOptions<T>): UseTableResult<T> {
  const [data, setData] = useState<T[]>(() => readLS(lsKey, fallback));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<PostgrestError | null>(null);

  // Ref to keep track of concurrent updates to avoid stale state
  const dataRef = useRef(data);
  dataRef.current = data;

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data: rows, error: err } = await supabase
      .from(table)
      .select('*')
      .order(orderBy, { ascending: orderAsc });

    if (err) {
      setError(err);
      setData(readLS(lsKey, fallback));
    } else {
      const mapped = (rows ?? []).map(r => fromRow(r as Row));
      setData(mapped);
      writeLS(lsKey, mapped);
      setError(null);
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, lsKey, orderBy, orderAsc]);

  useEffect(() => { refresh(); }, [refresh]);

  const insertOne = useCallback(async (item: T): Promise<T | null> => {
    const optimisticId = item.id;
    
    // 1. Optimistic local update
    setData(prev => {
      const next = [item, ...prev];
      writeLS(lsKey, next);
      return next;
    });

    // 2. Prepare payload for Supabase: REMOVE ID if it's new
    // We assume the caller provides a temporary UUID for optimistic UI.
    const row = toRow(item);
    delete row.id; // Let Postgres generate the real UUID

    // 3. Insert and select the returned record
    const { data: returnedRow, error: err } = await supabase
      .from(table)
      .insert(row)
      .select()
      .single();

    if (err) {
      setError(err);
      console.error(`[supabase insert into ${table}]`, err);
      // Optional: rollback optimistic update on error
      return null;
    }

    if (returnedRow) {
      const realItem = fromRow(returnedRow as Row);
      
      // 4. Swap temporary ID with real DB ID in local state
      setData(prev => {
        const next = prev.map(x => x.id === optimisticId ? realItem : x);
        writeLS(lsKey, next);
        return next;
      });
      return realItem;
    }

    return null;
  }, [table, lsKey, toRow, fromRow]);

  const deleteById = useCallback(async (id: string) => {
    setData(prev => {
      const next = prev.filter(x => x.id !== id);
      writeLS(lsKey, next);
      return next;
    });
    const { error: err } = await supabase.from(table).delete().eq('id', id);
    if (err) { setError(err); console.error(`[supabase delete from ${table}]`, err); }
  }, [table, lsKey]);

  const replaceAll = useCallback(async (items: T[]) => {
    setData(items);
    writeLS(lsKey, items);
    if (items.length > 0) {
      const { error: err } = await supabase.from(table).upsert(items.map(toRow));
      if (err) { setError(err); console.error(`[supabase upsert ${table}]`, err); }
    }
  }, [table, lsKey, toRow]);

  return { data, loading, error, insertOne, deleteById, replaceAll, refresh };
}
