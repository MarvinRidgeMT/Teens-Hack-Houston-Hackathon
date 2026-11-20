// Pickup dashboard: CSV export (pure, tested in Node). Owner: Abhinav (pages).
// One row per event, every event (debug ones too, with debug = true, so a spreadsheet
// can filter them). Fields an older event lacks are empty cells.

import { secondsToFirst, awayMsOf } from '../shared/stats.js';

export const CSV_COLUMNS = Object.freeze([
  'id', 'participant', 'threadId', 'task', 'signal',
  'leftAt', 'returnedAt', 'returnedAtUtc', 'firstInteractionAt', 'secondsToFirstInteraction',
  'condition', 'awayBucket', 'awayMs', 'taskType', 'debug', 'cardShown',
  'distractionHost', 'distractionHosts', 'returnVia', 'plannedBreakMin', 'nextStepSource', 'nextActionDoneAt',
]);

// One cell. Text that a spreadsheet would run as a formula gets a leading apostrophe.
export function csvCell(v) {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return csvCell(v.join(';'));
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function rowFor(e, taskNames) {
  const secs = secondsToFirst(e);
  const away = awayMsOf(e);
  const value = {
    ...e,
    task: (taskNames && taskNames[e.threadId]) || '',
    returnedAtUtc: Number.isFinite(e.returnedAt) ? new Date(e.returnedAt).toISOString() : '',
    secondsToFirstInteraction: secs === null ? '' : Math.round(secs * 1000) / 1000,
    awayMs: away === null ? '' : away,
  };
  return CSV_COLUMNS.map((c) => csvCell(value[c])).join(',');
}

export function toCsv(events, taskNames = {}) {
  const rows = (Array.isArray(events) ? events : []).filter((e) => e && typeof e === 'object').map((e) => rowFor(e, taskNames));
  return [CSV_COLUMNS.join(','), ...rows].join('\r\n') + '\r\n';
}
