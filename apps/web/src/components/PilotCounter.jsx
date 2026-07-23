import React from 'react';
import { Sparkles, Users, RefreshCw } from 'lucide-react';
import { FOUNDING, remainingLabel } from '@/lib/founding';

// Module-level cache so we don't refetch on every mount/re-render across the app.
let cache = null;
let cacheTime = 0;
const CACHE_TTL_MS = 60_000;

export default function PilotCounter({ compact = false }) {
  const [s, setS] = React.useState(cache);
  const [loading, setLoading] = React.useState(!cache);
  const [error, setError] = React.useState(false);

  const load = React.useCallback(async (force = false) => {
    if (!force && cache && Date.now() - cacheTime < CACHE_TTL_MS) {
      setS(cache);
      setLoading(false);
      setError(false);
      return;
    }
    setLoading(true);
    try {
      // Prefer the verified-purchase counter (Sprint 100); fall back to the
      // legacy pilot-status endpoint if the API server is unavailable.
      let data;
      const res = await fetch('/hcgi/api/founding/count');
      if (res.ok) {
        const c = await res.json();
        data = {
          cap: c.total_cap,
          enrolled: c.completed_purchases,
          remaining: c.remaining,
          sold_out: c.sold_out,
        };
      } else {
        const legacy = await fetch('/hcgi/platform/pilot-status');
        if (!legacy.ok) {
          throw new Error(`founding count failed: ${res.status} ${res.statusText}`);
        }
        data = await legacy.json();
      }
      cache = data;
      cacheTime = Date.now();
      setS(data);
      setError(false);
    } catch (err) {
      console.error('Failed to load founding access pilot status:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cap = s?.cap ?? FOUNDING.cap;
  const enrolled = s?.enrolled ?? 0;
  const remaining = s?.remaining ?? cap;
  const pct = Math.min(100, (enrolled / cap) * 100);

  if (compact) {
    if (error && !s) {
      return (
        <button
          type="button"
          onClick={() => load(true)}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground hover:text-gold"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      );
    }
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs text-gold">
        <Sparkles className="h-3.5 w-3.5" />
        {loading && !s ? 'Loading…' : remainingLabel(remaining, cap)}
      </div>
    );
  }

  if (error && !s) {
    return (
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-xs tracking-widest text-muted-foreground">
            <Users className="h-4 w-4 text-gold" /> FOUNDING ACCESS · FIRST YEAR · $11.69
          </span>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Couldn't load the live founding access counter right now.
        </p>
        <button
          type="button"
          onClick={() => load(true)}
          className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-xs text-foreground hover:text-gold"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-xs tracking-widest text-muted-foreground">
          <Users className="h-4 w-4 text-gold" /> FOUNDING ACCESS · FIRST YEAR · $11.69
        </span>
        <span className="text-xs text-accent">
          {loading && !s ? '…' : `${enrolled.toLocaleString()} claimed`}
        </span>
      </div>
      {loading && !s ? (
        <div className="mt-3 h-9 w-2/3 animate-pulse rounded-md bg-secondary" />
      ) : (
        <div className="mt-3 font-serif-lux text-3xl font-semibold">
          {remaining.toLocaleString()}<span className="text-base text-muted-foreground"> of {cap.toLocaleString()} passes remaining</span>
        </div>
      )}
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-gradient-to-r from-accent to-gold transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {FOUNDING.headline}
      </p>
      <p className="mt-2 text-[11px] text-muted-foreground/80">
        {FOUNDING.clarification}
      </p>
    </div>
  );
}
