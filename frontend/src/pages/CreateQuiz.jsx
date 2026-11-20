import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, FileText, Lightbulb, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { LoadingState, PageHeading } from '../components/common.jsx';
import FileUpload from '../components/documents/FileUpload.jsx';

const questionTypeOptions = ['Multiple Choice', 'Multiple Select', 'True / False'];
const steps = ['Choose source', 'Configure quiz', 'Ready to generate'];

export default function CreateQuiz({ onCreateQuiz, onUploadFile }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [sourceType, setSourceType] = useState('document');
  const [file, setFile] = useState(null);
  const [topic, setTopic] = useState('');
  const [objectives, setObjectives] = useState('');
  const [title, setTitle] = useState('');
  const [questionCount, setQuestionCount] = useState('10');
  const [difficulty, setDifficulty] = useState('Medium');
  const [optionCount, setOptionCount] = useState('4');
  const [questionTypes, setQuestionTypes] = useState(['Multiple Choice']);
  const [includeExplanations, setIncludeExplanations] = useState(true);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);

  const validateSource = () => {
    if (sourceType === 'document' && !file) {
      setError('Choose a PDF to continue.');
      return false;
    }
    if (sourceType === 'topic' && !topic.trim()) {
      setError('Enter a topic to continue.');
      return false;
    }
    setError('');
    return true;
  };

  const continueToSetup = () => {
    if (validateSource()) {
      setTitle((current) => current || (sourceType === 'topic' ? `${topic.trim()} essentials` : file.name.replace(/\.pdf$/i, '')));
      setStep(1);
    }
  };

  const toggleQuestionType = (type) => {
    setQuestionTypes((current) => {
      if (current.includes(type)) {
        if (current.length === 1) return current;
        return current.filter((item) => item !== type);
      }
      return [...current, type];
    });
  };

  const generate = async () => {
    if (!title.trim()) {
      setError('Add a title for your quiz.');
      return;
    }
    if (!questionTypes.length) {
      setError('Choose at least one question type.');
      return;
    }
    setError('');
    setGenerating(true);
    try {
      const quiz = await onCreateQuiz({
        title,
        sourceTitle: sourceType === 'document' ? file.name : `Topic: ${topic.trim()}`,
        sourceType,
        topic: topic.trim() || title,
        objectives: objectives.trim(),
        questionCount,
        difficulty,
        optionCount,
        questionTypes,
        includeExplanations,
      });
      navigate(`/quiz/${quiz.id}`, { state: { startNew: true } });
    } finally {
      setGenerating(false);
    }
  };

  if (generating) {
    return <div className="create-loading-wrap"><LoadingState label="Creating your quiz…" /></div>;
  }

  return (
    <>
      <PageHeading
        eyebrow="BUILD YOUR NEXT STUDY SESSION"
        title="Create a quiz"
        description="Choose what to study, then make the quiz your own."
        action={<Link to="/" className="button ghost"><ArrowLeft size={16} /> Back to dashboard</Link>}
      />
      <div className="wizard-progress">
        {steps.map((label, index) => (
          <div className={`wizard-step ${step >= index ? 'active' : ''} ${step > index ? 'complete' : ''}`} key={label}>
            <span className="wizard-number">{step > index ? <Check size={14} /> : index + 1}</span>
            <span>{label}</span>
            {index < steps.length - 1 && <i />}
          </div>
        ))}
      </div>

      <div className="wizard-layout">
        <section className="panel wizard-panel">
          {step === 0 ? (
            <>
              <div className="wizard-title-row">
                <span className="step-icon"><FileText size={19} /></span>
                <div><h2>Choose your source</h2><p>Start with a document or a topic you want to explore.</p></div>
              </div>
              <div className="source-choice-grid">
                <button type="button" className={`source-choice ${sourceType === 'document' ? 'selected' : ''}`} onClick={() => { setSourceType('document'); setError(''); }}>
                  <span className="source-choice-icon lavender"><FileText size={20} /></span>
                  <strong>Upload a PDF</strong>
                  <small>Use your notes, textbook, or study guide</small>
                  <span className="radio-mark" />
                </button>
                <button type="button" className={`source-choice ${sourceType === 'topic' ? 'selected' : ''}`} onClick={() => { setSourceType('topic'); setError(''); }}>
                  <span className="source-choice-icon peach"><Lightbulb size={20} /></span>
                  <strong>Create from a topic</strong>
                  <small>Explore a subject from scratch</small>
                  <span className="radio-mark" />
                </button>
              </div>
              {sourceType === 'document' ? (
                <div className="source-content">
                  <label className="field-label">Your study material</label>
                  <FileUpload onFileSelected={(nextFile) => { setFile(nextFile); if (nextFile) onUploadFile(nextFile); setError(''); }} />
                </div>
              ) : (
                <div className="source-content field-stack">
                  <label className="field-label" htmlFor="topic">What would you like to learn about?</label>
                  <input id="topic" className="text-input" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="e.g. The fundamentals of cognitive science" />
                  <label className="field-label" htmlFor="objectives">Learning objectives <span className="optional">Optional</span></label>
                  <textarea id="objectives" className="text-input textarea" value={objectives} onChange={(event) => setObjectives(event.target.value)} placeholder="What should this quiz help you understand?" rows={4} />
                </div>
              )}
              {error && <div className="form-error" role="alert">{error}</div>}
              <div className="wizard-actions">
                <span className="subtle-note"><Sparkles size={14} /> Your content stays in this demo</span>
                <button className="button primary" onClick={continueToSetup}>Continue <ArrowRight size={16} /></button>
              </div>
            </>
          ) : (
            <>
              <div className="wizard-title-row">
                <span className="step-icon"><Sparkles size={19} /></span>
                <div><h2>Make it yours</h2><p>Choose the format and challenge level for your quiz.</p></div>
              </div>
              <div className="field-stack">
                <label className="field-label" htmlFor="quiz-title">Quiz title</label>
                <input id="quiz-title" className="text-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Cognitive Science Fundamentals" />
              </div>
              <div className="config-grid three">
                <div className="field-stack">
                  <label className="field-label" htmlFor="question-count">Number of questions</label>
                  <select id="question-count" className="text-input" value={questionCount} onChange={(event) => setQuestionCount(event.target.value)}>
                    {[5, 10, 15, 20].map((value) => <option key={value} value={value}>{value} questions</option>)}
                  </select>
                </div>
                <div className="field-stack">
                  <label className="field-label" htmlFor="difficulty">Difficulty</label>
                  <select id="difficulty" className="text-input" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
                    {['Easy', 'Medium', 'Hard'].map((value) => <option key={value}>{value}</option>)}
                  </select>
                </div>
                <div className="field-stack">
                  <label className="field-label" htmlFor="option-count">Answer options</label>
                  <select id="option-count" className="text-input" value={optionCount} onChange={(event) => setOptionCount(event.target.value)}>
                    {[2, 3, 4].map((value) => <option key={value} value={value}>{value} options</option>)}
                  </select>
                </div>
              </div>
              <div className="field-stack">
                <span className="field-label">Question types</span>
                <div className="type-options">
                  {questionTypeOptions.map((type) => (
                    <label className={`type-option ${questionTypes.includes(type) ? 'checked' : ''}`} key={type}>
                      <input type="checkbox" checked={questionTypes.includes(type)} onChange={() => toggleQuestionType(type)} />
                      <span className="custom-checkbox">{questionTypes.includes(type) && <Check size={12} />}</span>
                      {type}
                    </label>
                  ))}
                </div>
              </div>
              <div className="toggle-row">
                <div><strong>Include explanations</strong><small>Show why each answer is correct after practice.</small></div>
                <button
                  type="button"
                  className={`switch ${includeExplanations ? 'on' : ''}`}
                  role="switch"
                  aria-checked={includeExplanations}
                  aria-label="Include explanations"
                  onClick={() => setIncludeExplanations(!includeExplanations)}
                ><span /></button>
              </div>
              {error && <div className="form-error" role="alert">{error}</div>}
              <div className="wizard-actions">
                <button className="button ghost" onClick={() => setStep(0)}><ArrowLeft size={16} /> Back</button>
                <button className="button primary" onClick={generate}><Sparkles size={16} /> Generate quiz</button>
              </div>
            </>
          )}
        </section>
        <aside className="wizard-aside">
          <div className="panel source-summary">
            <span className="eyebrow">YOUR SOURCE</span>
            <div className="summary-icon"><FileText size={19} /></div>
            <strong>{sourceType === 'document' ? (file?.name || 'No PDF selected') : (topic.trim() || 'Choose a topic')}</strong>
            <span>{sourceType === 'document' ? (file ? 'PDF · ready to use' : 'Your file will appear here') : 'Topic-based practice'}</span>
            {sourceType === 'topic' && objectives && <p className="summary-objectives">{objectives}</p>}
          </div>
          <div className="tip-card">
            <span className="tip-card-icon"><Lightbulb size={17} /></span>
            <strong>A little tip</strong>
            <p>Short, focused quizzes make it easier to remember what you learn. You can always create another.</p>
          </div>
        </aside>
      </div>
    </>
  );
}
