import { useMemo, useState } from 'react';
import { BookOpenCheck, CalendarDays, FileText, Sparkles } from 'lucide-react';
import { EmptyState, PageHeading } from '../components/common.jsx';
import { formatDate, formatRelativeTime } from '../services/formatters.js';

const iconByType = {
  completed: BookOpenCheck,
  created: Sparkles,
  uploaded: FileText,
};

export default function History({ activities }) {
  const [filter, setFilter] = useState('All activity');
  const filtered = useMemo(
    () => activities.filter((activity) => filter === 'All activity' || activity.type === filter.toLowerCase()),
    [activities, filter],
  );
  const grouped = filtered.reduce((groups, activity) => {
    const date = formatDate(activity.createdAt);
    groups[date] = [...(groups[date] || []), activity];
    return groups;
  }, {});

  return (
    <>
      <PageHeading
        eyebrow="YOUR LEARNING JOURNAL"
        title="Activity history"
        description="A little progress, day by day."
        action={<span className="history-range"><CalendarDays size={16} /> All time</span>}
      />
      <section className="panel history-panel">
        <div className="history-toolbar">
          <div><h2>Recent activity</h2><p>Keep track of your quizzes and study materials.</p></div>
          <select className="filter-select" value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter activity">
            <option>All activity</option><option>Completed</option><option>Created</option><option>Uploaded</option>
          </select>
        </div>
        {filtered.length ? Object.entries(grouped).map(([date, items]) => (
          <div className="history-day" key={date}>
            <div className="history-date"><span>{date}</span><i /></div>
            {items.map((activity) => {
              const Icon = iconByType[activity.type] || Sparkles;
              return (
                <article className="history-entry" key={activity.id}>
                  <span className={`history-entry-icon ${activity.type}`}><Icon size={17} /></span>
                  <div className="history-entry-content"><strong>{activity.title}</strong><span>{activity.detail}</span></div>
                  <time>{formatRelativeTime(activity.createdAt)}</time>
                </article>
              );
            })}
          </div>
        )) : (
          <EmptyState icon={CalendarDays} title="Nothing to show yet" description="Your activity will appear here as you create and practice quizzes." />
        )}
      </section>
    </>
  );
}
