import pb from '@/lib/pocketbaseClient';

// Public site origin used to build shareable links.
export const SITE_ORIGIN =
  typeof window !== 'undefined' ? window.location.origin : 'https://wyzrdy.com';

/** Build a personal referral link for a given user id. */
export function referralLink(userId, source = '') {
  if (!userId) return SITE_ORIGIN;
  const base = `${SITE_ORIGIN}/?ref=${encodeURIComponent(userId)}`;
  return source ? `${base}&utm_source=${encodeURIComponent(source)}` : base;
}

/** QR image for a link (renders offline-shareable code without a bundled dep). */
export function qrImage(url, size = 220) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(url)}`;
}

/** Pre-populated share copy per platform. */
export function shareCopy(link) {
  return {
    twitter: `Founding Access: the first 20,000 verified purchasers can secure one year of access to the Wyzrdy Individual plan for one payment of $11.69. ${link}`,
    linkedin: `Founding Access: the first 20,000 verified purchasers can secure one year of access to the Wyzrdy Individual plan for one payment of $11.69. ${link}`,
    facebook: `Founding Access: the first 20,000 verified purchasers can secure one year of access to the Wyzrdy Individual plan for one payment of $11.69. ${link}`,
    instagram: `Founding Access: the first 20,000 verified purchasers can secure one year of access to the Wyzrdy Individual plan for one payment of $11.69. ${link}`,
    tiktok: `Founding Access: the first 20,000 verified purchasers can secure one year of access to the Wyzrdy Individual plan for one payment of $11.69. ${link}`,
    reddit: `Founding Access: the first 20,000 verified purchasers can secure one year of access to the Wyzrdy Individual plan for one payment of $11.69. ${link}`,
    whatsapp: `Founding Access: the first 20,000 verified purchasers can secure one year of access to the Wyzrdy Individual plan for one payment of $11.69. ${link}`,
    email: `Founding Access: the first 20,000 verified purchasers can secure one year of access to the Wyzrdy Individual plan for one payment of $11.69. One year of access applies to the Individual plan; metered third-party usage, premium add-ons, implementation services and future enterprise services are excluded. Standard subscription pricing applies after the first 12 months. ${link}`,
  };
}

/** Platform intent URLs for the native share sheets. */
export function shareUrls(link, copy) {
  const l = encodeURIComponent(link);
  return {
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(copy.twitter)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${l}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${l}&quote=${encodeURIComponent(copy.facebook)}`,
    reddit: `https://www.reddit.com/submit?url=${l}&title=${encodeURIComponent('Wyzrdy — AI business operating system')}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(copy.whatsapp)}`,
    email: `mailto:?subject=${encodeURIComponent('Wyzrdy — Founding Access for $11.69 (First Year)')}&body=${encodeURIComponent(copy.email)}`,
    // Instagram & TikTok have no web share intent — copy is provided for manual posting.
  };
}

/** Embed code for websites / blogs. */
export function embedCode(link) {
  return `<a href="${link}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:10px;background:#c9a24a;color:#12121a;font-family:sans-serif;font-weight:600;text-decoration:none;">Build your business with Wyzrdy →</a>`;
}

/** Read the current referral context from the URL. */
export function referralContext() {
  if (typeof window === 'undefined') return { ref: '', source: '' };
  const p = new URLSearchParams(window.location.search);
  return { ref: p.get('ref') || '', source: p.get('utm_source') || p.get('src') || '' };
}

/** Log a referral event to PocketBase (public create). Never throws. */
export async function logReferral(event) {
  try {
    const { ref, source } = referralContext();
    if (!ref) return;
    await pb.collection('referrals').create(
      { referrer_id: ref, source: source || 'direct', event, landing: (typeof window !== 'undefined' ? window.location.pathname : '') },
      { requestKey: `ref-${event}-${Date.now()}` },
    );
  } catch (_) { /* tracking is best-effort */ }
}

export const PLATFORMS = ['twitter', 'linkedin', 'facebook', 'reddit', 'whatsapp', 'email'];
