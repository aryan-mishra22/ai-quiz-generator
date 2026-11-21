import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import AppShell from './components/layout/AppShell.jsx';
import Dashboard from './pages/Dashboard.jsx';
import CreateQuiz from './pages/CreateQuiz.jsx';
import MyQuizzes from './pages/MyQuizzes.jsx';
import QuizPreview from './pages/QuizPreview.jsx';
import PDFLibrary from './pages/PDFLibrary.jsx';
import History from './pages/History.jsx';
import Settings from './pages/Settings.jsx';
import AuthPage from './pages/AuthPage.jsx';
import {
  addActivity,
  formatFileSize,
  loadDemoState,
  saveDemoState,
} from './services/demoService.js';
import {
  deleteDocumentApi,
  generateQuizApi,
  listDocumentsApi,
  uploadDocumentApi,
  signupApi,
  loginApi,
  logoutApi,
  currentUserApi,
} from './services/apiService.js';

function mapServerDocument(document) {
  return {
    id: `server-doc-${document.id}`,
    serverId: document.id,
    name: document.name || 'Untitled document',
    size: document.size ? formatFileSize(document.size) : '0 KB',
    pages: document.page_count || 0,
    uploadedAt: document.created_at,
  };
}

function mapServerQuiz(document, config = {}) {
  const questions = (document.questions || []).map((question, index) => {
    const correctAnswer = question.correct_answer;
    const allOptions = question.options.map((option) => option.option_text);
    const optionCount = config.optionCount ? Number(config.optionCount) : allOptions.length;
    const distractors = allOptions.filter((option) => option !== correctAnswer);
    const options = [correctAnswer, ...distractors].slice(0, optionCount);
    if (!options.includes(correctAnswer)) options[0] = correctAnswer;
    return {
      id: `server-question-${question.id}`,
      question: question.question_text,
      options: options.slice(0, config.optionCount ? Number(config.optionCount) : options.length),
      correctAnswers: [correctAnswer],
      correctIndex: Math.max(0, options.indexOf(correctAnswer)),
      difficulty: config.difficulty || 'Medium',
      type: 'Multiple Choice',
      explanation: 'Generated from the source document.',
      source: document.name || 'Uploaded study material',
      topic: config.topic || 'Study topic',
    };
  });

  return {
    id: `server-quiz-${document.id}`,
    serverDocumentId: document.id,
    title: config.title || document.name || 'Generated quiz',
    sourceTitle: config.sourceTitle || document.name || 'Study document',
    sourceType: config.sourceType || 'document',
    topic: config.topic || 'Study topic',
    questionCount: questions.length,
    difficulty: config.difficulty || 'Medium',
    createdAt: document.created_at,
    score: null,
    lastAttemptAt: null,
    includeExplanations: config.includeExplanations !== false,
    questions,
  };
}

function RoutedApp({ state, setState, theme, setTheme, onCreateQuiz, onUploadFile, onDeleteDocument, onCompleteQuiz, onLogout, user }) {
  const navigate = useNavigate();

  return (
    <Routes>
      <Route element={<AppShell theme={theme} onLogout={onLogout} user={user} />}>
        <Route
          index
          element={
            <Dashboard
              userName={user?.name}
              quizzes={state.quizzes}
              documents={state.documents}
              activities={state.activities}
              onStartQuiz={(quiz) => navigate(`/quiz/${quiz.id}`)}
            />
          }
        />
        <Route
          path="create-quiz"
          element={<CreateQuiz onCreateQuiz={onCreateQuiz} onUploadFile={onUploadFile} />}
        />
        <Route
          path="quizzes"
          element={
            <MyQuizzes
              quizzes={state.quizzes}
              onDelete={(id) => setState((current) => ({ ...current, quizzes: current.quizzes.filter((quiz) => quiz.id !== id) }))}
              onStart={(quiz) => navigate(`/quiz/${quiz.id}`)}
              onViewResults={(quiz) => navigate(`/quiz/${quiz.id}`, { state: { showResults: true } })}
            />
          }
        />
        <Route
          path="quiz/:quizId"
          element={<QuizPreview quizzes={state.quizzes} onComplete={onCompleteQuiz} />}
        />
        <Route
          path="documents"
          element={
            <PDFLibrary
              documents={state.documents}
              onUpload={onUploadFile}
              onDelete={onDeleteDocument}
            />
          }
        />
        <Route path="history" element={<History activities={state.activities} />} />
        <Route path="settings" element={<Settings theme={theme} setTheme={setTheme} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  const [state, setState] = useState(loadDemoState);
  const [theme, setThemeState] = useState(() => localStorage.getItem('quizai-theme') || 'light');
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authLoading, setAuthLoading] = useState(true);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    currentUserApi()
      .then((serverUser) => {
        if (active) setUser(serverUser);
      })
      .catch(() => {
        if (!active) return;
        const savedUser = localStorage.getItem('quizai-user');
        setUser(savedUser ? JSON.parse(savedUser) : null);
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    saveDemoState(state);
  }, [state]);

  useEffect(() => {
    let active = true;
    listDocumentsApi()
      .then((documents) => {
        if (!active) return;
        const serverDocuments = documents.map(mapServerDocument);
        const serverQuizzes = documents
          .filter((document) => document.questions?.length)
          .map((document) => mapServerQuiz(document));
        setState((current) => ({
          ...current,
          documents: [...serverDocuments, ...current.documents.filter((document) => !document.serverId)],
          quizzes: [...serverQuizzes, ...current.quizzes],
        }));
      })
      .catch(() => {
        // Demo state remains available when Django is not running.
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('quizai-theme', theme);
  }, [theme]);

  const setTheme = (nextTheme) => setThemeState(nextTheme);

  const onUploadFile = async (file) => {
    if (!file) return;
    const uploaded = await uploadDocumentApi(file);
    const document = mapServerDocument(uploaded);
    setState((current) => ({
      ...current,
      documents: [document, ...current.documents.filter((item) => item.serverId !== document.serverId)],
      activities: addActivity(current.activities, {
        type: 'uploaded',
        title: `Uploaded ${file.name}`,
        detail: `${document.pages} pages · ${document.size}`,
      }),
    }));
    return document;
  };

  const onCreateQuiz = async (config) => {
    const text = [config.topic, config.objectives].filter(Boolean).join('\n\n');
    const document = await generateQuizApi({
      text,
      title: config.title.trim(),
      topic: config.topic || config.title.trim(),
      questionCount: Number(config.questionCount),
      file: config.sourceType === 'document' ? config.file : null,
    });
    const quiz = mapServerQuiz(document, config);
    if (!quiz.questions.length) {
      throw new Error('The server could not generate questions from this source.');
    }
    setState((current) => ({
      ...current,
      quizzes: [quiz, ...current.quizzes],
      activities: addActivity(current.activities, {
        type: 'created',
        title: `Created ${quiz.title}`,
        detail: `${quiz.questionCount} questions · ${quiz.difficulty} difficulty`,
      }),
    }));
    return quiz;
  };

  const onDeleteDocument = async (id) => {
    const document = state.documents.find((item) => item.id === id);
    if (document?.serverId) {
      await deleteDocumentApi(document.serverId);
    }
    setState((current) => ({
      ...current,
      documents: current.documents.filter((item) => item.id !== id),
    }));
  };

  const onAuthSubmit = async ({ name, email, password }) => {
    setAuthSubmitting(true);
    try {
      if (authMode === 'signup') {
        try {
          const serverUser = await signupApi(name, email, password);
          setUser(serverUser);
          localStorage.setItem('quizai-user', JSON.stringify(serverUser));
        } catch (serverError) {
          if (serverError.message.includes('server returned') || serverError.message.includes('Failed to fetch')) {
            const demoUser = { id: 'demo-user', name, email };
            localStorage.setItem('quizai-user', JSON.stringify(demoUser));
            localStorage.setItem('quizai-demo-account', JSON.stringify(demoUser));
            localStorage.setItem(`quizai-password-${email}`, password);
            setUser(demoUser);
          } else {
            throw serverError;
          }
        }
      } else {
        try {
          const serverUser = await loginApi(email, password);
          setUser(serverUser);
          localStorage.setItem('quizai-user', JSON.stringify(serverUser));
        } catch (serverError) {
          if (serverError.message.includes('server returned') || serverError.message.includes('Failed to fetch')) {
            const savedUser = JSON.parse(localStorage.getItem('quizai-demo-account') || 'null');
            const savedPassword = localStorage.getItem(`quizai-password-${email}`);
            if (savedUser?.email?.toLowerCase() !== email.toLowerCase() || savedPassword !== password) {
              throw new Error('Invalid email or password.');
            }
            setUser(savedUser);
          } else {
            throw serverError;
          }
        }
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  const onLogout = async () => {
    try {
      await logoutApi();
    } catch {
      // Clear the local session even if Django is unavailable.
    }
    localStorage.removeItem('quizai-user');
    setUser(null);
    setAuthMode('login');
  };

  const onCompleteQuiz = (quizId, score, answers) => {
    setState((current) => {
      const quiz = current.quizzes.find((item) => item.id === quizId);
      if (!quiz) return current;
      return {
        ...current,
        quizzes: current.quizzes.map((item) => (
          item.id === quizId
            ? { ...item, score, lastAttemptAt: new Date().toISOString(), lastAnswers: answers }
            : item
        )),
        activities: addActivity(current.activities, {
          type: 'completed',
          title: `Completed ${quiz.title}`,
          detail: `${Math.round((score / 100) * quiz.questions.length)} of ${quiz.questions.length} questions correct`,
        }),
      };
    });
  };

  if (authLoading) {
    return <main className="auth-loading"><span className="auth-loading-mark">Quiz<span>AI</span></span></main>;
  }

  if (!user) {
    return (
      <AuthPage
        mode={authMode}
        onModeChange={setAuthMode}
        onSubmit={onAuthSubmit}
        loading={authSubmitting}
      />
    );
  }

  return (
    <RoutedApp
      state={state}
      setState={setState}
      theme={theme}
      setTheme={setTheme}
      onCreateQuiz={onCreateQuiz}
      onUploadFile={onUploadFile}
      onDeleteDocument={onDeleteDocument}
      onCompleteQuiz={onCompleteQuiz}
      onLogout={onLogout}
      user={user}
    />
  );
}
