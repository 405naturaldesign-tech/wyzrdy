import React from 'react';
import { Twitter, Linkedin, Facebook, MessageCircle, Mail, Copy, Check, Code2, QrCode } from 'lucide-react';
import { referralLink, shareCopy, shareUrls, embedCode, qrImage } from '@/lib/social';

const ICONS = {
  twitter: Twitter, linkedin: Linkedin, facebook: Facebook,
  reddit: MessageCircle, whatsapp: MessageCircle, email: Mail,
};
const LABELS = {
  twitter: 'Twitter / X', linkedin: 'LinkedIn', facebook: 'Facebook',
  reddit: 'Reddit', whatsapp: 'WhatsApp', email: 'Email',
};

export default function ShareButtons({ userId = '', title = 'Share Wyzrdy', context = '' }) {
  const link = referralLink(userId, context);
  const copy = shareCopy(link);
  const urls = shareUrls(link, copy);
  const [copied, setCopied] = React.useState('');
  const [showQr, setShowQr] = React.useState(false);
  const [showEmbed, setShowEmbed] = React.useState(false);

  const doCopy = (key, text) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key); setTimeout(() => setCopied(''), 1600);
    }).catch(() => {});
  };

  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-3 text-xs tracking-widest text-muted-foreground">{title.toUpperCase()}</div>

      <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{link}</span>
        <button onClick={() => doCopy('link', link)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
          {copied === 'link' ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy link</>}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {Object.keys(urls).map((k) => {
          const Icon = ICONS[k] || Mail;
          return (
            <a key={k} href={urls[k]} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm hover:bg-secondary">
              <Icon className="h-4 w-4 text-gold" /> {LABELS[k]}
            </a>
          );
        })}
      </div>

      {/* Copy-only platforms (no web share intent) */}
      <div className="mt-2 flex flex-wrap gap-2">
        {['instagram', 'tiktok'].map((k) => (
          <button key={k} onClick={() => doCopy(k, copy[k])}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-secondary">
            {copied === k ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />} Copy {k} caption
          </button>
        ))}
        <button onClick={() => setShowQr((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-secondary">
          <QrCode className="h-3.5 w-3.5" /> QR code
        </button>
        <button onClick={() => setShowEmbed((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-secondary">
          <Code2 className="h-3.5 w-3.5" /> Embed
        </button>
      </div>

      {showQr && (
        <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-border bg-secondary/30 p-4">
          <img src={qrImage(link)} alt="Referral QR code" width={180} height={180} className="rounded-lg bg-white p-2" />
          <p className="text-xs text-muted-foreground">Print on cards, stickers or posters for offline sharing.</p>
        </div>
      )}

      {showEmbed && (
        <div className="mt-3">
          <textarea readOnly value={embedCode(link)} rows={3}
            className="w-full resize-none rounded-xl border border-border bg-secondary/40 px-3 py-2.5 font-mono-lux text-xs outline-none" />
          <button onClick={() => doCopy('embed', embedCode(link))} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-secondary">
            {copied === 'embed' ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />} Copy embed code
          </button>
        </div>
      )}
    </div>
  );
}
