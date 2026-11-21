import { ArrowRight, BookOpenCheck, Brain, FileText, Plus, Sparkles, Target, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DifficultyBadge, PageHeading, SectionHeader, StatCard } from '../components/common.jsx';
import { formatDate, formatRelativeTime } from '../services/demoService.js';

function ActivityIcon({ type }) {
  const Icon = type === 'uploaded' ? FileText : type === 'completed' ? BookOpenCheck : Sparkles;
  return <span className={`activity-icon ${type}`}><Icon size={16} /></span>;
}

export default function Dashboard({ userName, quizzes, documents, activities, onStartQuiz }) {
  const firstName = userName?.trim().split(/\s+/)[0] || 'Jamie';
  const completed = quizzes.filter((quiz) => quiz.score !== null && quiz.score !== undefined);
  const average = completed.length
    ? Math.round(completed.reduce((total, quiz) => total + quiz.score, 0) / completed.length)
    : 0;
  const questionCount = quizzes.reduce((total, quiz) => total + quiz.questionCount, 0);

  return (
    <>
      <PageHeading
        eyebrow="YOUR LEARNING SPACE"
        title={<>Welcome back, {firstName} <span className="wave">✦</span></>}
        description="Turn your learning materials into interactive quizzes."
        action={<Link className="button primary" to="/create-quiz"><Plus size={17} /> Create new quiz</Link>}
      />

      <section className="stats-grid" aria-label="Learning statistics">
        <StatCard label="Total quizzes" value={quizzes.length} change="+2" changeLabel="vs. last month" icon={Brain} tone="violet" />
        <StatCard label="Questions generated" value={questionCount} change="+18" changeLabel="across all quizzes" icon={Sparkles} tone="blue" />
        <StatCard label="Documents uploaded" value={documents.length} change="+1" changeLabel="ready to study" icon={FileText} tone="amber" />
        <StatCard label="Average quiz score" value={`${average}%`} change={completed.length ? '+6%' : undefined} changeLabel="keep up the great work" icon={Target} tone="green" />
      </section>

      <section className="dashboard-hero">
        <div className="hero-copy">
          <span className="hero-kicker"><Sparkles size={14} /> YOUR LEARNING SPACE</span>
          <h2>Small steps.<br /><span>Big progress.</span></h2>
          <p>Pick up where you left off or turn something new into a quiz.</p>
          <Link className="button hero-button" to="/create-quiz">Create a quiz <ArrowRight size={16} /></Link>
        </div>
        <div className="hero-illustration" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="hero-orb"><Brain size={54} strokeWidth={1.35} /></div>
          <span className="float-card float-card-one"><BookOpenCheck size={17} /><span><b>Learn</b><small>at your pace</small></span></span>
          <span className="float-card float-card-two"><TrendingUp size={17} /><span><b>+12%</b><small>this week</small></span></span>
          <span className="sparkle sparkle-a">✦</span><span className="sparkle sparkle-b">✧</span>
        </div>
      </section>

      <div className="dashboard-columns">
        <section className="panel recent-panel">
          <SectionHeader
            title="Recent quizzes"
            subtitle="Jump back into your learning"
            action={<Link className="text-link" to="/quizzes">View all <ArrowRight size={15} /></Link>}
          />
          <div className="recent-quiz-list">
            {quizzes.slice(0, 4).map((quiz) => (
              <article className="recent-quiz-row" key={quiz.id}>
                <span className={`quiz-icon ${quiz.topic === 'Astronomy' ? 'sky' : quiz.topic === 'Economics' ? 'peach' : 'lilac'}`}>
                  <BookOpenCheck size={19} />
                </span>
                <div className="recent-quiz-info">
                  <strong>{quiz.title}</strong>
                  <span>{quiz.sourceTitle}</span>
                </div>
                <div className="recent-quiz-meta">
                  <span>{quiz.questionCount} questions</span>
                  <DifficultyBadge difficulty={quiz.difficulty} />
                </div>
                <div className="recent-quiz-date">{formatDate(quiz.createdAt)}</div>
                <button className="button small-button secondary" onClick={() => onStartQuiz(quiz)}>Start quiz</button>
              </article>
            ))}
            {!quizzes.length && <div className="inline-empty">Your first quiz is just a few clicks away.</div>}
          </div>
        </section>

        <section className="panel activity-panel">
          <SectionHeader title="Recent activity" action={<Link className="icon-link" to="/history" aria-label="View all activity"><ArrowRight size={17} /></Link>} />
          <div className="activity-list">
            {activities.slice(0, 4).map((activity, index) => (
              <div className="activity-row" key={activity.id}>
                <ActivityIcon type={activity.type} />
                <div className="activity-copy">
                  <strong>{activity.title}</strong>
                  <span>{activity.detail}</span>
                  <small>{formatRelativeTime(activity.createdAt)}</small>
                </div>
                {index < Math.min(activities.length, 4) - 1 && <span className="activity-line" />}
              </div>
            ))}
            {!activities.length && <div className="inline-empty">Your learning activity will appear here.</div>}
          </div>
        </section>
      </div>

      <section className="quick-actions">
        <div><span className="eyebrow">KEEP THE MOMENTUM</span><strong>What would you like to do?</strong></div>
        <Link to="/create-quiz" className="quick-action-card"><span className="quick-action-icon purple"><Sparkles size={18} /></span><span><b>Generate a quiz</b><small>From a PDF or topic</small></span><ArrowRight size={16} /></Link>
        <Link to="/documents" className="quick-action-card"><span className="quick-action-icon blue"><FileText size={18} /></span><span><b>Upload a PDF</b><small>Add study materials</small></span><ArrowRight size={16} /></Link>
        <Link to="/quizzes" className="quick-action-card"><span className="quick-action-icon green"><BookOpenCheck size={18} /></span><span><b>Practice a quiz</b><small>Keep your skills sharp</small></span><ArrowRight size={16} /></Link>
      </section>
    </>
  );
}
