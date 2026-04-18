import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_KEY!;

/** Singleton Supabase client — safe to import in both Server and Client components */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── Table name constants (match your Supabase schema exactly) ─────────────────

export const TABLES = {
  TASKS: 'tasks',
  FINANCE_TRANSACTIONS: 'finance_transactions',
  TIMER_PRESETS: 'timer_presets',
} as const;

