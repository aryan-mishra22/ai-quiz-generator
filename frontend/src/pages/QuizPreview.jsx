import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronLeft, ChevronRight, RotateCcw, X, XCircle } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { DifficultyBadge, EmptyState } from '../components/common.jsx';
import { calculateScore } from '../services/demoService.js';

function expectedAnswers(question) {
  return question.correctAnswers || [question.options[question.correctIndex]];
}

export default function QuizPreview({ quizzes, onComplete }) {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const quiz = quizzes.find((item) => item.id === quizId);
  const [activeIndex, setActiveIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(Boolean(location.state?.showResults));
  const questions = quiz?.questions || [];
  const question = questions[activeIndex];
  const score = useMemo(() => submitted && questions.length ? calculateScore(questions, answers) : 0, [submitted, questions, answers]);

  useEffect(() => {
    setActiveIndex(0);
    setAnswers(location.state?.showResults && quiz?.lastAnswers ? quiz.lastAnswers : {});
    setSubmitted(Boolean(location.state?.showResults));
  }, [quizId, location.state?.showResults]);

  if (!quiz || !questions.length) {
    return (
      <div className="panel">
        <EmptyState
          title="Quiz not found"
          description="It may have been removed from your quiz library."
          action={<Link className="button primary" to="/quizzes">Go to my quizzes</Link>}
        />
      </div>
    );
  }

  const toggleAnswer = (option) => {
    if (submitted) return;
    setAnswers((current) => {
      const selected = current[question.id] || [];
      if (question.type === 'Multiple Select') {
        return {
          ...current,
          [question.id]: selected.includes(option)
            ? selected.filter((item) => item !== option)
            : [...selected, option],
        };
      }
      return { ...current, [question.id]: [option] };
    });
  };

  const finishQuiz = () => {
    const finalScore = calculateScore(questions, answers);
    setSubmitted(true);
    onComplete(quiz.id, finalScore, answers);
  };

  const retryQuiz = () => {
    setAnswers({});
    setActiveIndex(0);
    setSubmitted(false);
    navigate(`/quiz/${quiz.id}`, { replace: true, state: { startNew: true } });
  };

  const optionState = (option) => {
    if (!submitted) return (answers[question.id] || []).includes(option) ? 'selected' : '';
    const expected = expectedAnswers(question);
    if (expected.includes(option)) return 'answer-correct';
    if ((answers[question.id] || []).includes(option)) return 'answer-wrong';
    return '';
  };

  return (
    <div className="quiz-practice">
      <div className="quiz-topline">
        <Link to="/quizzes" className="button ghost"><ArrowLeft size={16} /> All quizzes</Link>
        <div className="quiz-title-block">
          <div><h1>{quiz.title}</h1><p>{quiz.sourceTitle}</p></div>
          <DifficultyBadge difficulty={quiz.difficulty} />
        </div>
      </div>
      {submitted ? (
        <section className="panel result-panel">
          <div className={`result-medallion ${score >= 70 ? 'good' : 'needs-work'}`}>
            {score >= 70 ? <CheckCircle2 size={32} /> : <TargetIcon />}
          </div>
          <span className="eyebrow">{score >= 70 ? 'NICE WORK' : 'KEEP PRACTICING'}</span>
          <h2>{score >= 70 ? 'You’re making great progress.' : 'Every try makes you stronger.'}</h2>
          <p className="result-subtitle">Here’s how you did on <strong>{quiz.title}</strong></p>
          <div className="result-score-row">
            <div><strong>{score}%</strong><span>Overall score</span></div>
            <div><strong>{Math.round(score / 100 * questions.length)}<small>/{questions.length}</small></strong><span>Correct answers</span></div>
            <div><strong>{questions.length}</strong><span>Questions</span></div>
          </div>
          <div className="result-review">
            <div className="section-header"><div><h3>Answer review</h3><p>Review the answer and explanation for each question.</p></div></div>
            {questions.map((item, index) => {
              const expected = expectedAnswers(item);
              const chosen = answers[item.id] || [];
              const correct = expected.length === chosen.length && expected.every((answer) => chosen.includes(answer));
              return (
                <article className="review-question" key={item.id}>
                  <div className="review-question-title">
                    <span className={`review-status ${correct ? 'correct' : 'wrong'}`}>{correct ? <Check size={14} /> : <X size={14} />}</span>
                    <strong><span>Q{index + 1}.</span> {item.question}</strong>
                  </div>
                  <div className="review-answer-list">
                    {item.options.map((option) => (
                      <div key={option} className={`review-option ${expected.includes(option) ? 'correct' : chosen.includes(option) ? 'wrong' : ''}`}>
                        <span>{expected.includes(option) ? <Check size={13} /> : chosen.includes(option) ? <X size={13} /> : null}</span>{option}
                      </div>
                    ))}
                  </div>
                  {quiz.includeExplanations !== false && <p className="explanation"><strong>Why:</strong> {item.explanation}</p>}
                  <small className="source-citation">{item.source}</small>
                </article>
              );
            })}
          </div>
          <div className="result-actions">
            <button className="button secondary" onClick={retryQuiz}><RotateCcw size={16} /> Retry quiz</button>
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
              <div className="question-label">
                <span>{question.type === 'Multiple Select' ? 'SELECT ALL THAT APPLY' : question.type === 'True / False' ? 'TRUE OR FALSE' : 'CHOOSE ONE ANSWER'}</span>
                {question.type === 'Multiple Select' && <small>More than one answer</small>}
              </div>
              <h2>{question.question}</h2>
              <div className="answer-options">
                {question.options.map((option, index) => {
                  const selected = (answers[question.id] || []).includes(option);
                  return (
                    <button className={`answer-option ${optionState(option)}`} key={option} onClick={() => toggleAnswer(option)}>
                      <span className={`answer-letter ${question.type === 'Multiple Select' ? 'checkbox-letter' : ''}`}>
                        {submitted && expectedAnswers(question).includes(option) ? <Check size={15} /> : String.fromCharCode(65 + index)}
                      </span>
                      <span>{option}</span>
                      {selected && !submitted && <Check size={17} className="selected-check" />}
                      {submitted && expectedAnswers(question).includes(option) && <CheckCircle2 size={18} className="success-icon" />}
                      {submitted && selected && !expectedAnswers(question).includes(option) && <XCircle size={18} className="error-icon" />}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="practice-footer">
              <button className="button ghost" disabled={activeIndex === 0} onClick={() => setActiveIndex((index) => index - 1)}><ChevronLeft size={17} /> Previous</button>
              {activeIndex < questions.length - 1 ? (
                <button className="button primary" onClick={() => setActiveIndex((index) => index + 1)}>Next question <ChevronRight size={17} /></button>
              ) : (
                <button className="button primary" onClick={finishQuiz}>Submit quiz <Check size={16} /></button>
              )}
            </div>
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
            <div className="source-note"><span className="source-note-icon"><CheckCircle2 size={16} /></span><span><strong>Study source</strong><small>{quiz.sourceTitle}</small></span></div>
          </aside>
        </div>
      )}
    </div>
  );
}

function TargetIcon() {
  return <XCircle size={32} />;
}
