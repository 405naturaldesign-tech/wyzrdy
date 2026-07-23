import pb from '@/lib/pocketbaseClient';
import apiServerClient from '@/lib/apiServerClient';

/** Authenticated fetch helper — attaches the PocketBase JWT. */
async function authedFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (pb.authStore.isValid && pb.authStore.token) {
    headers.Authorization = `Bearer ${pb.authStore.token}`;
  }
  const res = await apiServerClient.fetch(path, { ...options, headers });
  let data = null;
  try { data = await res.json(); } catch (_) { /* no body */ }
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed: ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/** Create the $11.69 founding checkout session and return the Stripe URL. */
export async function startFoundingCheckout() {
  return authedFetch('/checkout/founding', { method: 'POST' });
}

/** Create a monthly/annual subscription checkout session. */
export async function startSubscriptionCheckout(cycle = 'monthly') {
  return authedFetch(`/checkout/subscription?cycle=${encodeURIComponent(cycle)}`, { method: 'POST' });
}

/** Open the Stripe Customer Portal. */
export async function openBillingPortal() {
  return authedFetch('/checkout/portal', { method: 'POST' });
}

/** Get the current user's entitlement. */
export async function getEntitlement() {
  return authedFetch('/entitlement', { method: 'GET' });
}

/** Public founding purchase counter. */
export async function getFoundingCount() {
  const res = await apiServerClient.fetch('/founding/count');
  if (!res.ok) throw new Error(`founding count failed: ${res.status}`);
  return res.json();
}
