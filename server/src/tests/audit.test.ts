import test from 'node:test';
import assert from 'node:assert/strict';
import { auditValue } from '../services/audit';

test('audit values recursively omit credentials and tokens', () => {
  const value = auditValue({ name: 'Safe', password: 'hidden', nested: { refreshToken: 'hidden', amount: 12 }, items: [{ secretKey: 'hidden', status: 'ok' }] });
  assert.equal(value, '{"name":"Safe","nested":{"amount":12},"items":[{"status":"ok"}]}');
  assert.doesNotMatch(value!, /hidden|password|token|secret/i);
});
