/**
 * Production-grade resilience layer for PocketBase calls from the browser.
 *
 * Provides:
 *  - retryWithBackoff: exponential backoff with jitter for transient failures
 *    (network errors, 429 rate limits, 5xx, deadlock/timeout signals).
 *  - resilientCall: wraps a PB operation, classifies the error, and returns a
 *    friendly message on permanent failure.
 *  - validate: lightweight schema/type/format validation before writes.
 *  - checksum: stable content hash for data-integrity verification.
 *  - classifyError: turn a raw error into a user-facing category + message.
 */

import pb from '@/lib/pocketbaseClient';

const TRANSIENT_STATUS = new Set([0, 429, 500, 502, 503, 504]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Is this error worth retrying (transient infra/network/deadlock)? */
export function isTransient(err) {
  if (!err) return false;
  const status = err.status ?? err.response?.status;
  if (TRANSIENT_STATUS.has(status)) return true;
  const msg = String(err.message || '').toLowerCase();
  return /network|timeout|deadlock|econn|fetch|temporarily|unavailable|failed to fetch/.test(msg);
}

/** Classify any error into a stable category + friendly message. */
export function classifyError(err) {
  const status = err?.status ?? err?.response?.status ?? 0;
  const data = err?.response?.data || err?.data || {};
  if (status === 400) {
    const fields = Object.keys(data || {});
    return {
      category: 'validation',
      status,
      message: fields.length
        ? `Please check these fields: ${fields.join(', ')}.`
        : 'Some of the information provided is invalid.',
      fields: data,
    };
  }
  if (status === 401) return { category: 'auth', status, message: 'Your session expired. Please sign in again.' };
  if (status === 403) return { category: 'permission', status, message: 'You do not have permission to do that.' };
  if (status === 404) return { category: 'not_found', status, message: 'That record could not be found.' };
  if (status === 409) return { category: 'conflict', status, message: 'That change conflicts with an existing record.' };
  if (status === 429) return { category: 'rate_limit', status, message: 'Too many requests — please slow down and try again.' };
  if (status >= 500) return { category: 'server', status, message: 'The server had a problem. We retried automatically — please try again.' };
  if (status === 0) return { category: 'network', status, message: 'Network problem. Check your connection and retry.' };
  return { category: 'unknown', status, message: err?.message || 'Something went wrong.' };
}

/**
 * Retry an async fn with exponential backoff + jitter.
 * @param {() => Promise<any>} fn
 * @param {object} opts { retries, baseMs, maxMs, onRetry }
 */
export async function retryWithBackoff(fn, opts = {}) {
  const { retries = 4, baseMs = 300, maxMs = 6000, onRetry } = opts;
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (err) {
      // Auto-cancellation (status 0 from a superseded duplicate) is not a real failure.
      if (err?.isAbort) throw err;
      attempt += 1;
      if (attempt > retries || !isTransient(err)) throw err;
      const delay = Math.min(maxMs, baseMs * 2 ** (attempt - 1)) + Math.random() * 200;
      if (onRetry) onRetry({ attempt, delay, err });
      await sleep(delay);
    }
  }
}

/**
 * Run a PB operation resiliently. Returns { ok, data } or { ok:false, error }.
 * `error` is the classified, user-friendly object.
 */
export async function resilientCall(fn, opts = {}) {
  try {
    const data = await retryWithBackoff(fn, opts);
    return { ok: true, data };
  } catch (err) {
    if (err?.isAbort) return { ok: false, aborted: true, error: { category: 'aborted', message: 'Request superseded.' } };
    return { ok: false, error: classifyError(err) };
  }
}

/* ---------------- validation ---------------- */

const FORMATS = {
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  url: (v) => /^https?:\/\/[^\s]+$/i.test(v),
};

/**
 * Validate an object against a compact schema.
 * schema: { field: { type, required, min, max, format, values } }
 * Returns { valid, errors: { field: message } }.
 */
export function validate(obj, schema) {
  const errors = {};
  for (const [key, rule] of Object.entries(schema)) {
    const val = obj[key];
    const present = val !== undefined && val !== null && val !== '';
    if (rule.required && !present) {
      errors[key] = `${rule.label || key} is required.`;
      continue;
    }
    if (!present) continue;
    if (rule.type === 'string' && typeof val !== 'string') errors[key] = `${key} must be text.`;
    if (rule.type === 'number' && typeof val !== 'number') errors[key] = `${key} must be a number.`;
    if (rule.type === 'array' && !Array.isArray(val)) errors[key] = `${key} must be a list.`;
    if (rule.min != null && typeof val === 'string' && val.length < rule.min) errors[key] = `${key} is too short (min ${rule.min}).`;
    if (rule.max != null && typeof val === 'string' && val.length > rule.max) errors[key] = `${key} is too long (max ${rule.max}).`;
    if (rule.min != null && typeof val === 'number' && val < rule.min) errors[key] = `${key} must be ≥ ${rule.min}.`;
    if (rule.max != null && typeof val === 'number' && val > rule.max) errors[key] = `${key} must be ≤ ${rule.max}.`;
    if (rule.format && FORMATS[rule.format] && !FORMATS[rule.format](val)) errors[key] = `${key} is not a valid ${rule.format}.`;
    if (rule.values && !rule.values.includes(val)) errors[key] = `${key} must be one of: ${rule.values.join(', ')}.`;
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

/** Basic HTML escaping to prevent stored XSS in rendered text. */
export function sanitizeText(s) {
  if (typeof s !== 'string') return s;
  return s.replace(/[<>]/g, (c) => ({ '<': '&lt;', '>': '&gt;' }[c]));
}

/** Stable FNV-1a checksum of any JSON-serialisable value (data integrity). */
export function checksum(value) {
  const str = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Fire-and-forget audit log to activity_log; never throws. */
export async function audit(action, resourceType, resourceId, meta = {}) {
  const owner = pb.authStore.record?.id;
  if (!owner) return;
  try {
    await pb.collection('activity_log').create(
      { owner, action, resource_type: resourceType, resource_id: resourceId || '', meta },
      { requestKey: `audit-${Date.now()}-${Math.random().toString(36).slice(2)}` },
    );
  } catch (_) {
    /* audit is best-effort */
  }
}

export default { retryWithBackoff, resilientCall, validate, checksum, classifyError, isTransient, audit, sanitizeText };
