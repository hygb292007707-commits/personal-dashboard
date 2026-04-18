// ─── Calendar Types ───────────────────────────────────────────────────────────

export type CalendarView = 'daily' | 'weekly' | 'monthly';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // ISO date string "YYYY-MM-DD"
  startTime?: string; // "HH:mm"
  endTime?: string;   // "HH:mm"
  color?: string;
  description?: string;
  createdAt: string;
}

// ─── Task Types ───────────────────────────────────────────────────────────────

export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'in-progress' | 'done';

/** 0=Sun 1=Mon … 6=Sat — same as Date.prototype.getDay() */
export type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type RepeatType = 'none' | 'daily' | 'custom';

export interface Task {
  id: string;
  title: string;
  description?: string;
  date?: string;       // ISO date "YYYY-MM-DD"
  time?: string;       // "HH:mm"
  priority: TaskPriority;
  status: TaskStatus;
  tags: string[];
  createdAt: string;
  /** Non-null when this task belongs to a recurring series */
  recurringGroupId?: string;
  /** Days of week this series repeats on (0=Sun…6=Sat) */
  repeatDays?: WeekDay[];
}

export interface ParsedTask {
  title: string;
  date?: string;
  time?: string;
  priority: TaskPriority;
  tags: string[];
}


// ─── Finance Types ────────────────────────────────────────────────────────────

export type TransactionType = 'income' | 'expense';

export type TransactionCategory =
  | 'food'
  | 'transport'
  | 'entertainment'
  | 'health'
  | 'shopping'
  | 'utilities'
  | 'salary'
  | 'freelance'
  | 'investment'
  | 'other';

export interface Transaction {
  id: string;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  description: string;
  date: string; // "YYYY-MM-DD"
  createdAt: string;
}

export interface Budget {
  category: TransactionCategory;
  limit: number;
  period: 'monthly';
}

/** Monthly spending cap tracked via a progress bar */
export interface MonthlyBudget {
  /** Budget limit amount in local currency */
  limit: number;
  /** Month this limit was set, format "YYYY-MM" */
  month: string;
}

export interface FinanceState {
  transactions: Transaction[];
  budgets: Budget[];
  currency: string;
  /** Optional overall monthly budget */
  monthlyBudget: MonthlyBudget | null;
}

// ─── Dashboard State ──────────────────────────────────────────────────────────

export interface DashboardState {
  tasks: Task[];
  events: CalendarEvent[];
  finance: FinanceState;
  activeTab: 'calendar' | 'tasks' | 'finance';
}

// ─── NLP Parser Types ─────────────────────────────────────────────────────────

export interface NLPParseResult {
  title: string;
  date: string | null;
  time: string | null;
  priority: TaskPriority;
  tags: string[];
  raw: string;
}

// ─── Market Watchlist Types ───────────────────────────────────────────────────

export interface WatchlistItem {
  id: string;
  /** Ticker symbol, e.g. "THYAO", "AAPL" */
  symbol: string;
  /** User's purchase price in local currency */
  purchasePrice: number;
  /**
   * Current price (user-entered static value for now).
   * TODO: replace with real-time API fetch
   */
  currentPrice: number;
  /** Optional user note */
  note?: string;
  createdAt: string;
}
