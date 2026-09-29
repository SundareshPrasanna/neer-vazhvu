import assert from 'node:assert/strict';
import test from 'node:test';

import { formatNumber, formatPct } from './format';

test('formatNumber uses en-IN grouping and decimal precision', () => {
  assert.equal(formatNumber(1234567.891, 2), '12,34,567.89');
  assert.equal(formatNumber(1234567.891), '12,34,568');
});

test('formatPct formats to one decimal place', () => {
  assert.equal(formatPct(56.789), '56.8%');
});
