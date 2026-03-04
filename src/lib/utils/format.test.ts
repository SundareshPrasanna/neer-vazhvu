import assert from 'node:assert/strict';
import test from 'node:test';

import { formatMcft, formatNumber, formatPct, formatRelativeDate } from './format';

test('formatNumber uses en-IN grouping and decimal precision', () => {
  assert.equal(formatNumber(1234567.891, 2), '12,34,567.89');
  assert.equal(formatNumber(1234567.891), '12,34,568');
});

test('formatMcft switches precision around 1000 mcft', () => {
  assert.equal(formatMcft(950.34), '950.3 mcft');
  assert.equal(formatMcft(1500.9), '1,501 mcft');
});

test('formatPct formats to one decimal place', () => {
  assert.equal(formatPct(56.789), '56.8%');
});

test('formatRelativeDate shows just now for sub-hour dates', () => {
  const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  assert.equal(formatRelativeDate(thirtyMinsAgo), 'just now');
});

test('formatRelativeDate shows hours and days correctly', () => {
  const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
  const twentySixHoursAgo = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();
  const seventyFourHoursAgo = new Date(Date.now() - 74 * 60 * 60 * 1000).toISOString();

  assert.equal(formatRelativeDate(fiveHoursAgo), '5h ago');
  assert.equal(formatRelativeDate(twentySixHoursAgo), 'yesterday');
  assert.equal(formatRelativeDate(seventyFourHoursAgo), '3 days ago');
});
