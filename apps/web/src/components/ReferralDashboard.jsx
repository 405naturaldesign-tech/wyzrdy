import React from 'react';
import { Loader2, Users, MousePointerClick, UserPlus, TrendingUp } from 'lucide-react';
import ShareButtons from '@/components/ShareButtons';
import portal from '@/lib/portal';

export default function ReferralDashboard({ userId }) {
  const [stats, setStats] = React.useState(null);
  React.useEffect(() => {
    let on = true;
    portal.referralStats().then((s) => { if (on) setStats(s); }).catch(() => on && setStats({ total: 0, clicks: 0, signups: 0, conversions: 0, recent: [] }));
    return () => { on = false; };
  }, []);

  const cards = [
    { label: 'Total referrals', value: stats?.total ?? 0, icon: Users },
    { label: 'Link clicks', value: stats?.clicks ?? 0, icon: MousePointerClick },
    { label: 'Signups', value: stats?.signups ?? 0, icon: UserPlus },
    { label: 'Conversions', value: stats?.conversions ?? 0, icon: TrendingUp },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {cards.map((c) => (
            <div key={c.label} className="glass rounded-2xl p-5">
              <div className="mb-2 grid h-9 w-9 place-items-center rounded-xl bg-secondary text-gold"><c.icon className="h-4 w-4" /></div>
              <div className="font-serif-lux text-3xl font-semibold">{stats === null ? <Loader2 className="h-5 w-5 animate-spin" /> : c.value}</div>
              <div className="text-xs text-muted-foreground">{c.label}</div>
            </div>
          ))}
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="mb-3 text-xs tracking-widest text-muted-foreground">RECENT REFERRAL ACTIVITY</div>
          {stats === null ? (
            <div className="py-8 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
          ) : (stats.recent || []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No referral activity yet. Share your link to start tracking.</p>
          ) : (
            <div className="divide-y divide-border">
              {stats.recent.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="capitalize">{r.event || 'click'}<span className="ml-2 text-xs text-muted-foreground">via {r.source || 'direct'}</span></span>
                  <span className="text-xs text-muted-foreground">{new Date(r.created).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <ShareButtons userId={userId} title="Your referral link" context="dashboard" />
    </div>
  );
}
