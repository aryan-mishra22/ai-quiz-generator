import { useMemo, useState } from 'react';
import { BookOpenCheck, Check, Clock3, Grid2X2, List, Play, Search, Trash2, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DifficultyBadge, EmptyState, PageHeading } from '../components/common.jsx';
import { formatDate } from '../services/formatters.js';

function QuizTile({ quiz, view, onStart, onViewResults, onDelete, startingQuizId }) {
  const completed = quiz.score !== null && quiz.score !== undefined;
  const starting = startingQuizId === quiz.serverDocumentId;
  return (
    <article className={`quiz-tile ${view === 'list' ? 'list-view' : ''}`}>
      <div className={`quiz-tile-art ${quiz.topic === 'Astronomy' ? 'sky' : quiz.topic === 'Economics' ? 'peach' : 'lilac'}`}>
        <span className="quiz-tile-symbol"><BookOpenCheck size={23} /></span>
        <span className="quiz-tile-topic">{quiz.topic || 'Study set'}</span>
        <button className="tile-delete" aria-label={`Delete ${quiz.title}`} onClick={() => onDelete(quiz)}><Trash2 size={16} /></button>
      </div>
      <div className="quiz-tile-content">
        <div className="quiz-tile-heading"><h3>{quiz.title}</h3><DifficultyBadge difficulty={quiz.difficulty} /></div>
        <p className="quiz-tile-source">{quiz.sourceTitle}</p>
        <div className="quiz-tile-meta">
          <span><BookOpenCheck size={14} /> {quiz.questionCount} questions</span>
          <span><Clock3 size={14} /> {formatDate(quiz.createdAt)}</span>
        </div>
        {completed && <div className="quiz-score-line"><span><Trophy size={14} /> Last score</span><strong>{quiz.score}%</strong><span className="mini-progress"><i style={{ width: `${quiz.score}%` }} /></span></div>}
        <div className="quiz-tile-actions">
          <button className="button primary small-button" disabled={starting} onClick={() => onStart(quiz)}><Play size={14} fill="currentColor" /> {starting ? 'Starting…' : 'Start quiz'}</button>
          {completed && <button className="button secondary small-button" onClick={() => onViewResults(quiz)}><Check size={14} /> Results</button>}
        </div>
      </div>
    </article>
  );
}

export default function MyQuizzes({ quizzes, onDelete, onStart, onViewResults, startingQuizId }) {
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState('All difficulties');
  const [dateRange, setDateRange] = useState('Any time');
  const [view, setView] = useState('grid');

  const filtered = useMemo(() => quizzes.filter((quiz) => {
    const matchesText = `${quiz.title} ${quiz.sourceTitle} ${quiz.topic}`.toLowerCase().includes(query.toLowerCase());
    const matchesDifficulty = difficulty === 'All difficulties' || quiz.difficulty === difficulty;
    const ageDays = (Date.now() - new Date(quiz.createdAt).getTime()) / 86_400_000;
    const matchesDate = dateRange === 'Any time' || (dateRange === 'Last 7 days' ? ageDays <= 7 : ageDays <= 30);
    return matchesText && matchesDifficulty && matchesDate;
  }), [quizzes, query, difficulty, dateRange]);

  const confirmDelete = (quiz) => {
    if (window.confirm(`Delete “${quiz.title}” from your quiz library?`)) onDelete(quiz);
  };

  return (
    <>
      <PageHeading
        eyebrow="YOUR LEARNING LIBRARY"
        title="My quizzes"
        description="All your study sets, ready whenever you are."
        action={<Link className="button primary" to="/create-quiz"><span className="plus-symbol">+</span> Create quiz</Link>}
      />
      <section className="panel library-panel">
        <div className="library-toolbar">
          <label className="search-field">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search quizzes…" aria-label="Search quizzes" />
            {query && <button aria-label="Clear search" onClick={() => setQuery('')}>×</button>}
          </label>
          <div className="toolbar-filters">
            <select className="filter-select" value={difficulty} onChange={(event) => setDifficulty(event.target.value)} aria-label="Filter by difficulty">
              {['All difficulties', 'Easy', 'Medium', 'Hard'].map((value) => <option key={value}>{value}</option>)}
            </select>
            <select className="filter-select date-select" value={dateRange} onChange={(event) => setDateRange(event.target.value)} aria-label="Filter by date">
              {['Any time', 'Last 7 days', 'Last 30 days'].map((value) => <option key={value}>{value}</option>)}
            </select>
            <div className="view-toggle" aria-label="Quiz view">
              <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-label="Grid view"><Grid2X2 size={17} /></button>
              <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label="List view"><List size={18} /></button>
            </div>
          </div>
        </div>
        <div className="library-result-count">{filtered.length} {filtered.length === 1 ? 'quiz' : 'quizzes'} <span>in your library</span></div>
        {filtered.length ? (
          <div className={`quiz-grid ${view === 'list' ? 'as-list' : ''}`}>
            {filtered.map((quiz) => (
              <QuizTile key={quiz.id} quiz={quiz} view={view} onStart={onStart} onViewResults={onViewResults} onDelete={confirmDelete} startingQuizId={startingQuizId} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Search}
            title={quizzes.length ? 'No quizzes match those filters' : 'Your quiz library is waiting'}
            description={quizzes.length ? 'Try another search or clear your filters.' : 'Create your first quiz and it will show up here.'}
            action={quizzes.length ? <button className="button secondary" onClick={() => { setQuery(''); setDifficulty('All difficulties'); setDateRange('Any time'); }}>Clear filters</button> : <Link className="button primary" to="/create-quiz">Create a quiz</Link>}
          />
        )}
      </section>
    </>
  );
}
