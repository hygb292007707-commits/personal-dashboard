import type { NLPParseResult, TaskPriority } from './types';

// ─── Date / Time Patterns ────────────────────────────────────────────────────

const RELATIVE_DAY_MAP: Record<string, number> = {
  // English
  today: 0,
  tonight: 0,
  tomorrow: 1,
  'day after tomorrow': 2,
  yesterday: -1,
  // Turkish
  'bugün': 0,
  'bu gün': 0,
  'bu akşam': 0,
  'yarın': 1,
  'dün': -1,
  'öbür gün': 2,
  'öbür günü': 2,
};

const WEEKDAY_MAP: Record<string, number> = {
  // English
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  // Turkish
  pazar: 0,
  pazartesi: 1,
  salı: 2,
  çarşamba: 3,
  perşembe: 4,
  cuma: 5,
  cumartesi: 6,
};

const MONTH_MAP: Record<string, number> = {
  // English
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
  // Turkish
  ocak: 0,
  şubat: 1,
  mart: 2,
  nisan: 3,
  mayıs: 4,
  haziran: 5,
  temmuz: 6,
  ağustos: 7,
  eylül: 8,
  ekim: 9,
  kasım: 10,
  aralık: 11,
};

const PRIORITY_PATTERNS: Record<TaskPriority, RegExp[]> = {
  high: [
    /\b(urgent|asap|critical|high[- ]?priority|important|immediately|right now|acil|önemli|kritik)\b/i,
    /!!+/,
  ],
  medium: [
    /\b(medium[- ]?priority|normal|when possible|soon|orta)\b/i,
    /\b(priority:?\s*med|medium)\b/i,
  ],
  low: [
    /\b(low[- ]?priority|whenever|no rush|eventually|someday|düşük|acil değil)\b/i,
    /\b(priority:?\s*low)\b/i,
  ],
};

const TAG_PATTERN = /#(\w+)/g;

// ─── Helper: format date to YYYY-MM-DD ───────────────────────────────────────

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── Helper: next occurrence of a weekday ──────────────────────────────────

function nextWeekday(target: number, ref: Date = new Date()): Date {
  const d = new Date(ref);
  const diff = (target - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d;
}

// ─── Parse date from text ─────────────────────────────────────────────────

function parseDate(text: string): string | null {
  const lower = text.toLowerCase();

  // "next monday / next week / next month"
  const nextMatch = lower.match(/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month)\b/i);
  if (nextMatch) {
    const what = nextMatch[1].toLowerCase();
    if (what === 'week') {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return formatDate(d);
    }
    if (what === 'month') {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      return formatDate(d);
    }
    if (WEEKDAY_MAP[what] !== undefined) {
      const d = nextWeekday(WEEKDAY_MAP[what]);
      const today = new Date();
      if ((d.getTime() - today.getTime()) / 86400000 < 6) {
        d.setDate(d.getDate() + 7);
      }
      return formatDate(d);
    }
  }

  // "this monday / this friday"
  const thisMatch = lower.match(/\bthis\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
  if (thisMatch) {
    const day = WEEKDAY_MAP[thisMatch[1].toLowerCase()];
    return formatDate(nextWeekday(day));
  }

  // Turkish "gelecek pazartesi / gelecek hafta / gelecek ay"
  const trNextMatch = lower.match(/\bgelecek\s+(pazartesi|salı|çarşamba|perşembe|cuma|cumartesi|pazar|hafta|ay)\b/i);
  if (trNextMatch) {
    const what = trNextMatch[1].toLowerCase();
    if (what === 'hafta') {
      const d = new Date(); d.setDate(d.getDate() + 7); return formatDate(d);
    }
    if (what === 'ay') {
      const d = new Date(); d.setMonth(d.getMonth() + 1); return formatDate(d);
    }
    if (WEEKDAY_MAP[what] !== undefined) return formatDate(nextWeekday(WEEKDAY_MAP[what]));
  }

  // Turkish "bu pazartesi / bu cuma"
  const trThisMatch = lower.match(/\bbu\s+(pazartesi|salı|çarşamba|perşembe|cuma|cumartesi|pazar)\b/i);
  if (trThisMatch) {
    const day = WEEKDAY_MAP[trThisMatch[1].toLowerCase()];
    return formatDate(nextWeekday(day));
  }

  // Relative days (today, tomorrow, yesterday + Turkish equivalents)
  // Must check multi-word phrases first
  const multiWordRelatives = ['day after tomorrow', 'öbür günü', 'öbür gün', 'bu akşam', 'bu gün'];
  for (const phrase of multiWordRelatives) {
    if (lower.includes(phrase)) {
      const offset = RELATIVE_DAY_MAP[phrase] ?? 0;
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return formatDate(d);
    }
  }
  // Single-word relatives
  for (const [word, offset] of Object.entries(RELATIVE_DAY_MAP)) {
    if (word.includes(' ')) continue; // already handled above
    const r = new RegExp(`\\b${escapeRegex(word)}\\b`, 'iu');
    if (r.test(lower)) {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return formatDate(d);
    }
  }

  // Weekday names alone (both English and Turkish)
  for (const [day, num] of Object.entries(WEEKDAY_MAP)) {
    const r = new RegExp(`\\b${escapeRegex(day)}\\b`, 'iu');
    if (r.test(lower)) {
      return formatDate(nextWeekday(num));
    }
  }

  // "in N days/weeks/months" / Turkish "N gün/hafta/ay sonra"
  const inMatch = lower.match(/\bin\s+(\d+)\s+(day|days|week|weeks|month|months)\b/i);
  if (inMatch) {
    const n = parseInt(inMatch[1]);
    const unit = inMatch[2].toLowerCase();
    const d = new Date();
    if (unit.startsWith('day')) d.setDate(d.getDate() + n);
    else if (unit.startsWith('week')) d.setDate(d.getDate() + n * 7);
    else if (unit.startsWith('month')) d.setMonth(d.getMonth() + n);
    return formatDate(d);
  }
  const trInMatch = lower.match(/(\d+)\s+(gün|hafta|ay)\s+sonra\b/i);
  if (trInMatch) {
    const n = parseInt(trInMatch[1]);
    const unit = trInMatch[2].toLowerCase();
    const d = new Date();
    if (unit === 'gün') d.setDate(d.getDate() + n);
    else if (unit === 'hafta') d.setDate(d.getDate() + n * 7);
    else if (unit === 'ay') d.setMonth(d.getMonth() + n);
    return formatDate(d);
  }

  // "on the 15th / on 15th"
  const ordinalMatch = lower.match(/\bon\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b/i);
  if (ordinalMatch) {
    const dayNum = parseInt(ordinalMatch[1]);
    const d = new Date();
    d.setDate(dayNum);
    if (d < new Date()) d.setMonth(d.getMonth() + 1);
    return formatDate(d);
  }

  // "January 15 / Jan 15 / 15 January" and Turkish equivalents
  for (const [name, monthIdx] of Object.entries(MONTH_MAP)) {
    const escaped = escapeRegex(name);
    const r1 = new RegExp(`\\b${escaped}\\s+(\\d{1,2})\\b`, 'iu');
    const r2 = new RegExp(`\\b(\\d{1,2})\\s+${escaped}\\b`, 'iu');
    const m1 = lower.match(r1);
    const m2 = lower.match(r2);
    const match = m1 || m2;
    if (match) {
      const dayNum = parseInt(match[1]);
      const d = new Date();
      d.setMonth(monthIdx);
      d.setDate(dayNum);
      if (d < new Date()) d.setFullYear(d.getFullYear() + 1);
      return formatDate(d);
    }
  }

  // "YYYY-MM-DD" or "MM/DD/YYYY" or "DD.MM.YYYY"
  const iso = lower.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const slashDate = lower.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashDate) {
    return `${slashDate[3]}-${slashDate[1].padStart(2,'0')}-${slashDate[2].padStart(2,'0')}`;
  }

  const dotDate = lower.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dotDate) {
    return `${dotDate[3]}-${dotDate[2].padStart(2,'0')}-${dotDate[1].padStart(2,'0')}`;
  }

  return null;
}

// ─── Parse time from text ─────────────────────────────────────────────────

function parseTime(text: string): string | null {
  const lower = text.toLowerCase();

  // Turkish "saat N" or "saat N:MM" — highest priority
  const saatMatch = lower.match(/\bsaat\s+(\d{1,2})(?::(\d{2}))?\b/i);
  if (saatMatch) {
    const hours = parseInt(saatMatch[1]);
    const mins = saatMatch[2] ? parseInt(saatMatch[2]) : 0;
    if (hours >= 0 && hours <= 23 && mins >= 0 && mins <= 59) {
      return `${String(hours).padStart(2,'0')}:${String(mins).padStart(2,'0')}`;
    }
  }

  // "at 3pm" / "at 3:30pm" / "at 15:30" / "at 3 pm"
  const timeMatch = lower.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const mins = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const meridiem = timeMatch[3]?.toLowerCase();
    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
    if (hours >= 0 && hours <= 23) {
      return `${String(hours).padStart(2,'0')}:${String(mins).padStart(2,'0')}`;
    }
  }

  // "3pm", "3:30pm"
  const shortTime = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (shortTime) {
    let hours = parseInt(shortTime[1]);
    const mins = shortTime[2] ? parseInt(shortTime[2]) : 0;
    const meridiem = shortTime[3].toLowerCase();
    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
    return `${String(hours).padStart(2,'0')}:${String(mins).padStart(2,'0')}`;
  }

  // "noon" / "midnight" / time-of-day words
  if (/\bnoon\b/.test(lower) || /\böğlen\b/.test(lower)) return '12:00';
  if (/\bmidnight\b/.test(lower) || /\bgece yarısı\b/.test(lower)) return '00:00';
  if (/\bevening\b/.test(lower) || /\bakşam\b/.test(lower)) return '18:00';
  if (/\bmorning\b/.test(lower) || /\bsabah\b/.test(lower)) return '09:00';
  if (/\bafternoon\b/.test(lower) || /\böğleden sonra\b/.test(lower)) return '14:00';
  if (/\bnight\b/.test(lower) || /\bgece\b/.test(lower)) return '21:00';

  // Bare "HH:mm" — only match valid clock values (not embedded in dates)
  // Negative lookbehind for digits to avoid matching dates
  const hhmm = lower.match(/(?<!\d)(\d{2}):(\d{2})(?!\d)/);
  if (hhmm) {
    const h = parseInt(hhmm[1]);
    const m = parseInt(hhmm[2]);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${hhmm[1]}:${hhmm[2]}`;
    }
  }

  return null;
}

// ─── Parse priority from text ────────────────────────────────────────────

function parsePriority(text: string): TaskPriority {
  for (const [priority, patterns] of Object.entries(PRIORITY_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) return priority as TaskPriority;
    }
  }
  return 'medium';
}

// ─── Parse tags from text ─────────────────────────────────────────────────

function parseTags(text: string): string[] {
  const tags: string[] = [];
  let match;
  while ((match = TAG_PATTERN.exec(text)) !== null) {
    tags.push(match[1].toLowerCase());
  }
  TAG_PATTERN.lastIndex = 0;
  return tags;
}

// ─── Helper: escape special regex chars ──────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Clean title: remove date/time/tag expressions ───────────────────────

function cleanTitle(text: string, _date: string | null, _time: string | null): string {
  let clean = text;

  // Remove tags
  TAG_PATTERN.lastIndex = 0;
  clean = clean.replace(TAG_PATTERN, '');
  TAG_PATTERN.lastIndex = 0;

  // Turkish suffix pattern used by all time removals:
  // apostrophe (straight ' or curly ’) + locative/ablative/dative suffix
  // e.g. 18:00'de, saat 6'da, 20:00'den, 9:00'a
  const TR_SFX = `['’]?(?:d[ae]n?|t[ae]n?|[ey]?[ae])?`;

  // Remove Turkish "saat N" or "saat N:MM" expressions (+ any suffix)
  clean = clean.replace(new RegExp(`\\bsaat\\s+\\d{1,2}(?::\\d{2})?${TR_SFX}`, 'gi'), '');

  // Remove time expressions
  clean = clean.replace(new RegExp(`\\bat\\s+\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?${TR_SFX}`, 'gi'), '');
  clean = clean.replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, '');
  clean = clean.replace(/\b(?:noon|midnight|evening|morning|afternoon|night)\b/gi, '');
  // Turkish time-of-day words
  clean = clean.replace(/\b(?:öğlen|gece yarısı|akşam|sabah|öğleden sonra|gece)\b/gi, '');

  // Remove bare HH:mm (+ any attached Turkish suffix) — guards against date numbers via lookbehind
  clean = clean.replace(new RegExp(`(?<!\\d)\\d{2}:\\d{2}${TR_SFX}(?!\\d)`, 'g'), '');

  // Remove English date expressions
  clean = clean.replace(/\b(today|tonight|tomorrow|yesterday|day after tomorrow)\b/gi, '');
  clean = clean.replace(/\bnext\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month)\b/gi, '');
  clean = clean.replace(/\bthis\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '');
  clean = clean.replace(/\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '');
  clean = clean.replace(/\bin\s+\d+\s+(?:day|days|week|weeks|month|months)\b/gi, '');
  clean = clean.replace(/\bon\s+(?:the\s+)?\d{1,2}(?:st|nd|rd|th)\b/gi, '');
  clean = clean.replace(/\b(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}\b/gi, '');
  clean = clean.replace(/\b\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b/gi, '');
  clean = clean.replace(/\d{4}-\d{2}-\d{2}/g, '');
  clean = clean.replace(/\d{1,2}\/\d{1,2}\/\d{4}/g, '');
  clean = clean.replace(/\d{1,2}\.\d{1,2}\.\d{4}/g, '');

  // Remove Turkish date expressions
  clean = clean.replace(/\b(?:bugün|bu gün|bu akşam|yarın|dün|öbür gün|öbür günü)\b/gi, '');
  clean = clean.replace(/\bgelecek\s+(?:pazartesi|salı|çarşamba|perşembe|cuma|cumartesi|pazar|hafta|ay)\b/gi, '');
  clean = clean.replace(/\bbu\s+(?:pazartesi|salı|çarşamba|perşembe|cuma|cumartesi|pazar)\b/gi, '');
  clean = clean.replace(/\b(?:pazartesi|salı|çarşamba|perşembe|cuma|cumartesi|pazar)\b/gi, '');
  clean = clean.replace(/\d+\s+(?:gün|hafta|ay)\s+sonra\b/gi, '');
  // Turkish months
  clean = clean.replace(/\b(?:ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)\b/gi, '');

  // Remove priority words (EN + TR)
  clean = clean.replace(/\b(urgent|asap|critical|high[- ]?priority|important|immediately|right now|medium[- ]?priority|low[- ]?priority|no rush|eventually|someday|when possible|soon|acil|önemli|kritik|orta|düşük|acil değil)\b/gi, '');
  clean = clean.replace(/!!+/g, '');

  // Remove connectors and leading/trailing noise
  clean = clean.replace(/\b(on|at|by|until|due|for|the|a|an)\b\s*/gi, ' ');
  clean = clean.replace(/\s{2,}/g, ' ').trim();
  clean = clean.replace(/^[-,.:'"]+|[-,.:'"]+$/g, '').trim();

  // Remove any remaining surrounding quotes (single or double)
  clean = clean.replace(/^["']+|["']+$/g, '').trim();

  return clean || text.trim().replace(/^["']+|["']+$/g, '');
}

// ─── Main exported parser ─────────────────────────────────────────────────

export function parseTaskInput(input: string): NLPParseResult {
  // Strip wrapping quotes from raw input before parsing
  const raw = input.trim().replace(/^["']+|["']+$/g, '').trim();
  const date = parseDate(raw);
  const time = parseTime(raw);
  const priority = parsePriority(raw);
  const tags = parseTags(raw);
  const title = cleanTitle(raw, date, time);

  return { title, date, time, priority, tags, raw };
}

// ─── Utility: generate a unique ID ───────────────────────────────────────

export function generateId(): string {
  return crypto.randomUUID();
}

