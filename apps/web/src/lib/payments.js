import apiServerClient from '@/lib/apiServerClient';
import pb from '@/lib/pocketbaseClient';

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${pb.authStore.token}` };
}

export const PROVIDERS = [
  { id: 'stripe', label: 'Card · Apple Pay · Google Pay', hint: 'Stripe' },
  { id: 'paypal', label: 'PayPal', hint: 'Balance or linked bank' },
  { id: 'cashapp', label: 'Cash App', hint: 'Peer-to-peer' },
  { id: 'whatsapp', label: 'WhatsApp Pay', hint: 'Confirm via WhatsApp' },
  { id: 'crypto', label: 'Crypto', hint: 'BTC · ETH · SOL · USDC' },
];

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];

export async function cryptoQuote(amount) {
  const r = await apiServerClient.fetch(`/payments/crypto-quote?amount=${encodeURIComponent(amount)}`);
  if (!r.ok) throw new Error('Could not load crypto quote');
  return r.json();
}

export async function startCheckout({ provider, tier, cycle, currency, crypto_asset }) {
  const r = await apiServerClient.fetch('/payments/checkout', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ provider, tier, cycle, currency, crypto_asset }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data.error || 'Checkout failed');
    err.data = data;
    throw err;
  }
  return data;
}

export async function listInvoices() {
  const r = await apiServerClient.fetch('/invoices', { headers: authHeaders() });
  if (!r.ok) return { items: [] };
  return r.json();
}

export async function cancelSubscription() {
  const r = await apiServerClient.fetch('/subscriptions/cancel', { method: 'POST', headers: authHeaders() });
  return r.json();
}
