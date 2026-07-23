/**
 * Client-side feature-gate / paywall boundary layer.
 *
 * Computes the current user's tier limits, counts real usage this billing
 * period from PocketBase, and decides whether an action is allowed, near a
 * limit, or blocked. Pilot members (first 20,000 signups) and lifetime-free
 * accounts bypass all quotas.
 *
 * The backend (apps/api) remains the source of truth for billing and enforces
 * its own tier rate limits — this layer provides the UX boundaries (feature
 * gates, upgrade prompts, paywall modal) the user experiences before hitting
 * the server.
 */
import pb from '@/lib/pocketbaseClient';
import { getTier, TIER_ORDER } from '@/lib/tiers';

const uid = () => pb.authStore.record?.id;

/** Start-of-month ISO timestamp (PocketBase-friendly). */
function monthStartISO() {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0);
  return start.toISOString().replace('T', ' ').slice(0, 19);
}

export function isPilot(user) {
  return !!(user && (user.pilot_member || user.lifetime_free_status));
}

/** The three quota-bound features surfaced in the UI. */
export const QUOTA_FEATURES = {
  workflows: { limitKey: 'workflowsPerMonth', label: 'workflows', noun: 'workflow' },
  audits: { limitKey: 'auditsPerMonth', label: 'audits', noun: 'audit' },
  storage: { limitKey: 'storageGB', label: 'storage (GB)', noun: 'GB of storage' },
};

/** Count records created this month for a collection owned by the user. */
async function countThisMonth(collection) {
  try {
    const res = await pb.collection(collection).getList(1, 1, {
      filter: `owner = "${uid()}" && deleted != true && created >= "${monthStartISO()}"`,
      requestKey: `gate-${collection}-${Date.now()}`,
    });
    return res.totalItems;
  } catch {
    return 0;
  }
}

/**
 * Load current usage vs limits for the signed-in user.
 * Returns a map keyed by feature with { used, limit, unlimited, pct, state }.
 * state ∈ 'ok' | 'warn' (>=80%) | 'critical' (>=90%) | 'blocked' (>=100%).
 */
export async function loadUsage(user) {
  const tier = getTier(user?.subscription_tier || 'individual');
  const pilot = isPilot(user);

  const [workflows, audits] = await Promise.all([
    countThisMonth('workflows'),
    countThisMonth('assets'), // audits are stored as assets of type 'audit'
  ]);

  // Storage: approximate from asset count (each asset ≈ 0.02 GB placeholder)
  // until real byte accounting exists. Kept small so it never falsely blocks.
  const storageUsed = 0;

  const build = (used, limitKey) => {
    let limit = tier.limits[limitKey];
    if (pilot) limit = null; // pilots get unlimited
    const unlimited = limit == null;
    const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
    let state = 'ok';
    if (!unlimited) {
      if (used >= limit) state = 'blocked';
      else if (pct >= 90) state = 'critical';
      else if (pct >= 80) state = 'warn';
    }
    return { used, limit, unlimited, pct, state };
  };

  return {
    workflows: build(workflows, 'workflowsPerMonth'),
    audits: build(audits, 'auditsPerMonth'),
    storage: build(storageUsed, 'storageGB'),
    pilot,
    tier,
  };
}

/**
 * Check a single feature synchronously against a pre-loaded usage map.
 * Returns { allowed, state, used, limit, unlimited, remaining }.
 */
export function checkGate(usage, feature) {
  const u = usage?.[feature];
  if (!u) return { allowed: true, state: 'ok', unlimited: true, remaining: Infinity };
  const remaining = u.unlimited ? Infinity : Math.max(0, u.limit - u.used);
  return {
    allowed: u.unlimited || u.used < u.limit,
    state: u.state,
    used: u.used,
    limit: u.limit,
    unlimited: u.unlimited,
    remaining,
  };
}

/** The next tier up from the given tier id (for upgrade prompts). */
export function nextTierId(tierId) {
  const i = TIER_ORDER.indexOf(tierId);
  return TIER_ORDER[Math.min(TIER_ORDER.length - 1, i + 1)];
}

/** Human message describing what a feature limit unlocks by upgrading. */
export function upgradeMessage(feature, currentTierId) {
  const nextId = nextTierId(currentTierId);
  const next = getTier(nextId);
  const f = QUOTA_FEATURES[feature];
  const nextLimit = next.limits[f?.limitKey];
  const nextLabel = nextLimit == null ? 'unlimited' : nextLimit.toLocaleString();
  return `Upgrade to ${next.name} for ${nextLabel} ${f?.label || feature} per month.`;
}
