import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Seo from '@/components/Seo';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { DecoLogo, reveal } from '@/components/Shell';
import { useAuth } from '@/lib/auth';
import SocialLogin from '@/components/SocialLogin';

export default function AuthPage() {
  const { isAuthed } = useAuth();
  const nav = useNavigate();
  const [err, setErr] = React.useState('');

  React.useEffect(() => { if (isAuthed) nav('/dashboard', { replace: true }); }, [isAuthed, nav]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <Seo title="Sign in — Wyzrdy" description="Sign in to Wyzrdy to save workflows, blueprints and SEO audits." path="/login" noindex />
      <div className="absolute inset-0 bg-grid opacity-[0.2]" />
      <div className="pointer-events-none absolute -left-40 top-10 h-96 w-96 rounded-full bg-primary/15 blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-accent/10 blur-[120px]" />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-16">
        <Link to="/" className="mb-8 inline-flex"><DecoLogo sub="AI OPERATING SYSTEM" /></Link>
        <motion.div {...reveal(0)} className="glass rounded-3xl p-7">
          {err && <p className="mb-4 flex items-center gap-1.5 text-sm text-destructive"><AlertCircle className="h-4 w-4" /> {err}</p>}
          <SocialLogin onError={setErr} />
        </motion.div>
      </div>
    </div>
  );
}