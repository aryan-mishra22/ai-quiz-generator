import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronLeft, ChevronRight, RotateCcw, X, XCircle } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { DifficultyBadge, EmptyState, LoadingState } from '../components/common.jsx';
import { getAttemptApi, submitAttemptApi } from '../services/apiService.js';

export default function QuizPreview({ onStartNew, onAttemptComplete }) {
  const { attemptId } = useParams();
  const [attempt, setAttempt] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const questions = attempt?.questions || [];
  const submitted = Boolean(attempt?.completed_at);
  const question = questions[activeIndex];

  useEffect(() => {
    let active = true;
    setAttempt(null);
    setLoading(true);
    setError('');
    getAttemptApi(attemptId)
      .then((result) => {
        if (!active) return;
        setAttempt(result);
        setAnswers(Object.fromEntries(
          result.questions.map((item) => [item.id, item.selected_option_ids || []]),
        ));
        setActiveIndex(0);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Could not load this quiz attempt.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [attemptId]);

  const toggleAnswer = (optionId) => {
    if (submitted || !question) return;
    setAnswers((current) => ({ ...current, [question.id]: [optionId] }));
  };

  const finishQuiz = async () => {
    if (!attempt || submitting) return;
    setSubmitting(true);
    setError('');
    const submittedAnswers = questions.map((item) => ({
      question_id: item.id,
      selected_option_ids: answers[item.id] || [],
    }));
    try {
      const result = await submitAttemptApi(attempt.id, submittedAnswers);
      setAttempt(result);
      setAnswers(Object.fromEntries(
        result.questions.map((item) => [item.id, item.selected_option_ids || []]),
      ));
      onAttemptComplete(result);
    } catch (requestError) {
      setError(requestError.message || 'Your answers could not be submitted. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingState label="Loading your quiz…" description="Retrieving your saved attempt from QuizAI." />;
  }

  if (error && !attempt) {
    return (
      <div className="panel">
        <div className="form-error" role="alert">{error}</div>
        <Link className="button primary" to="/quizzes">Back to my quizzes</Link>
      </div>
    );
  }

  if (!attempt || !questions.length) {
    return (
      <div className="panel">
        <EmptyState
          title="Quiz attempt not found"
          description="It may have been removed or is no longer available."
          action={<Link className="button primary" to="/quizzes">Go to my quizzes</Link>}
        />
      </div>
    );
  }

  const optionState = (optionId) => {
    const selected = (answers[question.id] || []).includes(optionId);
    if (!submitted) return selected ? 'selected' : '';
    if ((question.correct_option_ids || []).includes(optionId)) return 'answer-correct';
    return selected ? 'answer-wrong' : '';
  };

  return (
    <div className="quiz-practice">
      <div className="quiz-topline">
        <Link to="/quizzes" className="button ghost"><ArrowLeft size={16} /> All quizzes</Link>
        <div className="quiz-title-block">
          <div><h1>{attempt.title}</h1><p>{attempt.title}</p></div>
          <DifficultyBadge difficulty="Medium" />
        </div>
      </div>
      {submitted ? (
        <section className="panel result-panel">
          <div className={`result-medallion ${attempt.score >= 70 ? 'good' : 'needs-work'}`}>
            {attempt.score >= 70 ? <CheckCircle2 size={32} /> : <TargetIcon />}
          </div>
          <span className="eyebrow">{attempt.score >= 70 ? 'NICE WORK' : 'KEEP PRACTICING'}</span>
          <h2>{attempt.score >= 70 ? 'You’re making great progress.' : 'Every try makes you stronger.'}</h2>
          <p className="result-subtitle">Here’s how you did on <strong>{attempt.title}</strong></p>
          <div className="result-score-row">
            <div><strong>{attempt.score}%</strong><span>Overall score</span></div>
            <div><strong>{attempt.correct_count}<small>/{questions.length}</small></strong><span>Correct answers</span></div>
            <div><strong>{questions.length}</strong><span>Questions</span></div>
          </div>
          <div className="result-review">
            <div className="section-header"><div><h3>Answer review</h3><p>Review the answer and explanation for each question.</p></div></div>
            {questions.map((item, index) => {
              const selectedIds = item.selected_option_ids || [];
              return (
                <article className="review-question" key={item.id}>
                  <div className="review-question-title">
                    <span className={`review-status ${item.is_correct ? 'correct' : 'wrong'}`}>{item.is_correct ? <Check size={14} /> : <X size={14} />}</span>
                    <strong><span>Q{index + 1}.</span> {item.question_text}</strong>
                  </div>
                  <div className="review-answer-list">
                    {item.options.map((option) => {
                      const correct = (item.correct_option_ids || []).includes(option.id);
                      const selected = selectedIds.includes(option.id);
                      return (
                        <div key={option.id} className={`review-option ${correct ? 'correct' : selected ? 'wrong' : ''}`}>
                          <span>{correct ? <Check size={13} /> : selected ? <X size={13} /> : null}</span>{option.option_text}
                        </div>
                      );
                    })}
                  </div>
                  <p className="explanation"><strong>Why:</strong> {item.explanation}</p>
                  {item.topic && <small className="source-citation">{item.topic}</small>}
                </article>
              );
            })}
          </div>
          <div className="result-actions">
            <button className="button secondary" onClick={() => onStartNew(attempt.document_id)}><RotateCcw size={16} /> Retry quiz</button>
            <Link className="button primary" to="/">Back to dashboard <ArrowRight size={16} /></Link>
          </div>
        </section>
      ) : (
        <div className="practice-layout">
          <section className="panel practice-panel">
            <div className="practice-progress-top">
              <div><span>QUESTION {activeIndex + 1}</span><strong> of {questions.length}</strong></div>
              <span>{Object.keys(answers).filter((key) => answers[key]?.length).length} answered</span>
            </div>
            <div className="progress-track"><span style={{ width: `${((activeIndex + 1) / questions.length) * 100}%` }} /></div>
            <div className="practice-question">
              <div className="question-label"><span>CHOOSE ONE ANSWER</span></div>
              <h2>{question.question_text}</h2>
              <div className="answer-options">
                {question.options.map((option, index) => {
                  const selected = (answers[question.id] || []).includes(option.id);
                  return (
                    <button className={`answer-option ${optionState(option.id)}`} key={option.id} onClick={() => toggleAnswer(option.id)}>
                      <span className="answer-letter">{String.fromCharCode(65 + index)}</span>
                      <span>{option.option_text}</span>
                      {selected && !submitted && <Check size={17} className="selected-check" />}
                      {submitted && (question.correct_option_ids || []).includes(option.id) && <CheckCircle2 size={18} className="success-icon" />}
                      {submitted && selected && !(question.correct_option_ids || []).includes(option.id) && <XCircle size={18} className="error-icon" />}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="practice-footer">
              <button className="button ghost" disabled={activeIndex === 0 || submitting} onClick={() => setActiveIndex((index) => index - 1)}><ChevronLeft size={17} /> Previous</button>
              {activeIndex < questions.length - 1 ? (
                <button className="button primary" disabled={submitting} onClick={() => setActiveIndex((index) => index + 1)}>Next question <ChevronRight size={17} /></button>
              ) : (
                <button className="button primary" disabled={submitting} onClick={finishQuiz}>{submitting ? 'Submitting…' : 'Submit quiz'} <Check size={16} /></button>
              )}
            </div>
            {error && <div className="form-error" role="alert">{error}</div>}
          </section>
          <aside className="panel question-nav-panel">
            <div className="section-header"><div><h3>Questions</h3><p>Move around your quiz</p></div></div>
            <div className="question-number-grid">
              {questions.map((item, index) => (
                <button
                  key={item.id}
                  className={`question-number ${activeIndex === index ? 'current' : ''} ${answers[item.id]?.length ? 'answered' : ''}`}
                  onClick={() => setActiveIndex(index)}
                  aria-label={`Go to question ${index + 1}`}
                >
                  {index + 1}
                  {answers[item.id]?.length > 0 && <span />}
                </button>
              ))}
            </div>
            <div className="question-nav-legend"><span><i className="legend-current" /> Current</span><span><i className="legend-answered" /> Answered</span></div>
            <div className="source-note"><span className="source-note-icon"><CheckCircle2 size={16} /></span><span><strong>Study source</strong><small>{attempt.title}</small></span></div>
          </aside>
        </div>
      )}
    </div>
  );
}

function TargetIcon() {
  return <XCircle size={32} />;
}
