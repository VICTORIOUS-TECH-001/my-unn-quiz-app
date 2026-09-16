/**
 * Universal West African Time (WAT = UTC+1, no daylight saving).
 * Windsor: all exam scheduling is stored + displayed in WAT so the admin's
 * time settings affect every user identically, in every timezone.
 */
export const WAT_TIME_ZONE = 'Africa/Lagos';
export const WAT_LABEL = 'WAT';

function toMs(input: number | string): number {
  if (typeof input === 'number') return Number.isNaN(input) ? 0 : input;
  const t = new Date(input).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function fmt(ms: number, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: WAT_TIME_ZONE,
    ...options,
  }).format(new Date(ms));
}

/** 'Mon, 16 Sep 2026' in WAT (falls back when ISO is invalid). */
export function formatWATDate(input: number | string, fallback = ''): string {
  const ms = toMs(input);
  if (!ms) return fallback;
  return fmt(ms, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** '13:05' (24h) in WAT. */
export function formatWATTime(input: number | string, fallback = ''): string {
  const ms = toMs(input);
  if (!ms) return fallback;
  return fmt(ms, { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** '13:05:09' ticking clock in WAT. */
export function formatWATClock(input: number | string): string {
  const ms = toMs(input);
  if (!ms) return '--:--:--';
  return fmt(ms, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/** 'Mon, 16 Sep 2026 • 13:05 WAT' — full stamp for slips & schedules. */
export function formatWATDateTime(
  input: number | string,
  fallback = ''
): string {
  const ms = toMs(input);
  if (!ms) return fallback;
  return `${formatWATDate(ms)} • ${formatWATTime(ms)} ${WAT_LABEL}`;
}

/** Canonical 'YYYY-MM-DD' calendar day in WAT (for date inputs). */
export function watDateString(input: number | string): string {
  const ms = toMs(input);
  if (!ms) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: WAT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

/**
 * Parse admin-picked date ('YYYY-MM-DD') + time ('HH:MM' 24h or 'h:MM AM/PM')
 * as a WAT wall-time and return the universal UTC ISO instant.
 * Returns null when the inputs are not a real calendar date/time.
 */
export function parseWATDateTime(
  dateStr: string,
  timeStr: string
): string | null {
  const dm = (dateStr || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dm) return null;
  const tm = (timeStr || '')
    .trim()
    .match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!tm) return null;
  let hours = Number(tm[1]);
  const minutes = Number(tm[2]);
  const meridiem = tm[3]?.toUpperCase();
  if (meridiem) {
    if (hours < 1 || hours > 12 || minutes > 59) return null;
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
  } else if (hours > 23 || minutes > 59) {
    return null;
  }
  // WAT = UTC+1, so subtract one hour to get the UTC instant.
  const utc = Date.UTC(
    Number(dm[1]),
    Number(dm[2]) - 1,
    Number(dm[3]),
    hours - 1,
    minutes,
    0
  );
  if (Number.isNaN(utc)) return null;
  return new Date(utc).toISOString();
}
