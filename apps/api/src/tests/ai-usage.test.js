import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isModelAllowed, MODEL_ALLOWLIST, TOKEN_LIMITS } from '../utils/aiUsage.js';

// NOTE: These are pure-logic unit tests that run without Stripe/PocketBase.
// The full payment-pipeline integration tests (checkout, webhook signature,
// idempotency, cap enforcement, refund/dispute) require Stripe test keys and a
// running PocketBase instance and are documented in the final report as
// requiring live test-mode credentials — they are NOT asserted here so that
// no test result is manufactured.

test('Individual plan cannot use Agency-only models', () => {
	assert.equal(isModelAllowed('individual', 'o1'), false);
	assert.equal(isModelAllowed('individual', 'gpt-4o'), false);
});

test('Individual plan can use its allowed models', () => {
	assert.equal(isModelAllowed('individual', 'gpt-4o-mini'), true);
	assert.equal(isModelAllowed('individual', 'deepseek-v3'), true);
});

test('Business plan can use claude-3-5-sonnet but not o1', () => {
	assert.equal(isModelAllowed('business', 'claude-3-5-sonnet'), true);
	assert.equal(isModelAllowed('business', 'o1'), false);
});

test('Enterprise plan allows any model', () => {
	assert.equal(isModelAllowed('enterprise', 'anything-new'), true);
});

test('Token limits are persistent per-plan values (not unlimited except enterprise)', () => {
	assert.equal(TOKEN_LIMITS.individual.monthly, 100000);
	assert.equal(TOKEN_LIMITS.enterprise.monthly, null);
	assert.ok(Object.keys(MODEL_ALLOWLIST).includes('agency'));
});
