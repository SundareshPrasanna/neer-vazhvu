import assert from 'node:assert/strict';
import test from 'node:test';

import { isoToNasaDate, nasaDateToISO, parseDMY, subtractDays, todayIST } from './date';

test('parseDMY parses slash, dash, and dot-separated inputs', () => {
  assert.equal(parseDMY('7/3/2026'), '2026-03-07');
  assert.equal(parseDMY('07-03-2026'), '2026-03-07');
  assert.equal(parseDMY('7.3.2026'), '2026-03-07');
});

test('parseDMY throws on unsupported format', () => {
  assert.throws(() => parseDMY('2026/03/07'), /Cannot parse date/);
});

test('NASA date conversions are reversible', () => {
  const nasa = '20260307';
  const iso = nasaDateToISO(nasa);
  assert.equal(iso, '2026-03-07');
  assert.equal(isoToNasaDate(iso), nasa);
});

test('subtractDays returns IST business date string', () => {
  const base = new Date('2026-03-10T12:00:00Z');
  assert.equal(subtractDays(base, 5), '2026-03-05');
});

test('todayIST emits YYYY-MM-DD shape', () => {
  assert.match(todayIST(), /^\d{4}-\d{2}-\d{2}$/);
});
