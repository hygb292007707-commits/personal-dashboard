import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const TABLES = {
  TASKS: 'tasks',
  FINANCE_TRANSACTIONS: 'finance_transactions',
  TIMER_PRESETS: 'timer_presets',
} as const;

