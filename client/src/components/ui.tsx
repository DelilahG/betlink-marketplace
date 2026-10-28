import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, ShieldCheck, ShieldQuestion, type LucideIcon } from 'lucide-react';
import { label } from '../format';

/** Fades children up the first time they scroll into view. */
export function Reveal({ children, delay = 0, as: Tag = 'div', className = '' }: { children: ReactNode; delay?: number; as?: 'div' | 'section' | 'li'; className?: string }) {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setInView(true), io.disconnect()), { rootMargin: '0px 0px -8% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref as never} className={`reveal ${inView ? 'in' : ''} ${className}`} style={{ ['--delay' as string]: `${delay}ms` }}>
      {children}
    </Tag>
  );
}

export function Field({ label: text, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{text}</span>
      {children}
      {error ? <span className="err" role="alert">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </label>
  );
}

export function Alert({ kind = 'error', children }: { kind?: 'error' | 'success' | 'info'; children: ReactNode }) {
  const Icon = kind === 'success' ? CheckCircle2 : AlertCircle;
  return (
    <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <Icon size={18} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
      <div>{children}</div>
    </div>
  );
}

export const Spinner = () => <span className="spinner" aria-hidden />;

export function PageLoader() {
  return (
    <div className="center-page" role="status" aria-live="polite">
      <Spinner />
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon size={24} aria-hidden /></div>
      <h2 className="h2">{title}</h2>
      <div className="muted">{children}</div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div aria-hidden className="card">
      <div className="skeleton" style={{ aspectRatio: '4 / 3', borderRadius: 20 }} />
      <div className="skeleton" style={{ height: 26, width: '45%' }} />
      <div className="skeleton" style={{ height: 18, width: '80%' }} />
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  published: 'badge-green', draft: 'badge-line', unpublished: 'badge-amber', rented: 'badge-dark', sold: 'badge-dark',
  flagged: 'badge-amber', removed: 'badge-red', ok: 'badge-green', new: 'badge-amber', responded: 'badge-green',
  closed: 'badge-line', open: 'badge-amber', resolved: 'badge-green', dismissed: 'badge-line', verified: 'badge-green',
  pending: 'badge-amber', rejected: 'badge-red', unverified: 'badge-line',
};
export const StatusBadge = ({ status }: { status: string }) => <span className={`badge ${STATUS_TONE[status] ?? ''}`}>{label(status)}</span>;

export function VerificationBadge({ status, kind = 'listing' }: { status: string; kind?: 'listing' | 'person' }) {
  return status === 'verified' ? (
    <span className="badge badge-green"><ShieldCheck size={14} aria-hidden /> Verified {kind === 'person' ? '' : 'listing'}</span>
  ) : (
    <span className="badge badge-line" title="BetLink has not verified this yet"><ShieldQuestion size={14} aria-hidden /> Not verified</span>
  );
}
