import pb from '@/lib/pocketbaseClient';
import apiServerClient from '@/lib/apiServerClient';

/** Stable per-browser device id used for self-referral fingerprinting. */
function deviceId() {
  try {
    let id = localStorage.getItem('wyzrdy_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('wyzrdy_device_id', id);
    }
    return id;
  } catch (_) {
    return '';
  }
}

async function authedFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Device-Id': deviceId(),
    ...(options.headers || {}),
  };
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

/** Server-computed referral progress (zero client-side trust). */
export async function getReferralStatus() {
  return authedFetch('/referral/status', { method: 'GET' });
}

/** Mint / fetch the caller's unique referral link. */
export async function generateReferralLink() {
  return authedFetch('/referral/generate-link', { method: 'POST' });
}

/** Start the $7.77/mo Viral Entry Tier checkout with a referral code. */
export async function startViralEntryCheckout(referralCode) {
  return authedFetch(`/checkout/viral-entry?referral_code=${encodeURIComponent(referralCode)}`, { method: 'POST' });
}
