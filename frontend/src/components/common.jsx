import { ArrowDownRight, ArrowUpRight, FileQuestion, FileText } from 'lucide-react';

export function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="page-heading-action">{action}</div>}
    </div>
  );
}

export function StatCard({ label, value, change, changeLabel, icon: Icon, tone = 'violet' }) {
  const isPositive = !String(change).startsWith('-');
  return (
    <article className="stat-card">
      <div className="stat-top">
        <span className={`icon-tile ${tone}`}><Icon size={19} /></span>
        {change && (
          <span className={`stat-change ${isPositive ? 'positive' : 'negative'}`}>
            {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {change}
          </span>
        )}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {changeLabel && <div className="stat-footnote">{changeLabel}</div>}
    </article>
  );
}

export function DifficultyBadge({ difficulty }) {
  return <span className={`difficulty-badge ${(difficulty || 'medium').toLowerCase()}`}>{difficulty || 'Medium'}</span>;
}

export function EmptyState({ icon: Icon = FileQuestion, title, description, action }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon size={25} /></span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function LoadingState({ label = 'Preparing your quiz…' }) {
  return (
    <div className="loading-state" role="status">
      <span className="spinner" />
      <strong>{label}</strong>
      <span>Gathering your learning material and building a practice set.</span>
    </div>
  );
}

export function SectionHeader({ title, action, subtitle }) {
  return (
    <div className="section-header">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function FileName({ name }) {
  return (
    <span className="file-name">
      <span className="file-icon"><FileText size={16} /></span>
      <span>{name}</span>
    </span>
  );
}
