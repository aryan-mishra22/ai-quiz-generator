import { useEffect, useMemo, useState } from 'react';
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
import { formatFileSize } from './services/formatters.js';
import {
  currentUserApi,
  deleteDocumentApi,
  generateQuizApi,
  listAttemptsApi,
  listDocumentsApi,
  loginApi,
  logoutApi,
  signupApi,
  startAttemptApi,
  uploadDocumentApi,
} from './services/apiService.js';

function readTheme() {
  try {
    return localStorage.getItem('quizai-theme') === 'dark' ? 'dark' : 'light';
  } catch (error) {
    console.error('Could not read the saved appearance preference.', error);
    return 'light';
  }
}

function clearLegacyBrowserData() {
  const legacyKeys = new Set([
    'quizai-demo-v1',
    'quizai-user',
    'quizai-demo-account',
    'quizai-profile',
  ]);
  for (const key of Object.keys(localStorage)) {
    if (legacyKeys.has(key) || key.startsWith('quizai-password-')) {
      localStorage.removeItem(key);
    }
  }
}

function mapServerDocument(document) {
  return {
    id: document.id,
    serverId: document.id,
    name: document.name || 'Untitled document',
    size: document.size ? formatFileSize(document.size) : '0 KB',
    pages: document.page_count || 0,
    uploadedAt: document.created_at,
    processingStatus: document.processing_status || 'ready',
    processingError: document.processing_error || '',
  };
}

function mapServerQuiz(document, attempts) {
  const questions = document.questions || [];
  const latestAttempt = attempts.find(
    (attempt) => attempt.document_id === document.id && attempt.completed_at,
  );
  return {
    id: `server-quiz-${document.id}`,
    serverDocumentId: document.id,
    title: document.name || 'Generated quiz',
    sourceTitle: document.name || 'Study document',
    sourceType: document.size ? 'document' : 'topic',
    topic: questions.find((question) => question.topic)?.topic || 'Study topic',
    questionCount: questions.length,
    difficulty: 'Medium',
    createdAt: document.created_at,
    score: latestAttempt?.score ?? null,
    lastAttemptAt: latestAttempt?.completed_at ?? null,
    lastAttemptId: latestAttempt?.id ?? null,
    includeExplanations: true,
    questions: questions.map((question) => ({
      id: question.id,
      question: question.question_text,
      topic: question.topic,
      options: question.options.map((option) => option.option_text),
    })),
  };
}

function mapActivities(documents, attempts) {
  const documentActivities = documents.map((document) => {
    const hasQuiz = document.questions?.length > 0;
    return {
      id: `document-${document.id}`,
      type: hasQuiz ? 'created' : 'uploaded',
      title: hasQuiz
        ? `Created ${document.name || 'a quiz'}`
        : `Uploaded ${document.name || 'a document'}`,
      detail: hasQuiz
        ? `${document.questions.length} questions`
        : `${document.page_count || 0} pages · ${formatFileSize(document.size || 0)}`,
      createdAt: document.created_at,
    };
  });
  const attemptActivities = attempts
    .filter((attempt) => attempt.completed_at)
    .map((attempt) => ({
      id: `attempt-${attempt.id}`,
      type: 'completed',
      title: `Completed ${attempt.title}`,
      detail: `${attempt.score}% score`,
      createdAt: attempt.completed_at,
    }));

  return [...documentActivities, ...attemptActivities]
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
}

function attemptSummary(attempt) {
  return {
    id: attempt.id,
    document_id: attempt.document_id,
    title: attempt.title,
    started_at: attempt.started_at,
    completed_at: attempt.completed_at,
    score: attempt.score,
    question_count: attempt.questions.length,
  };
}

function RoutedApp({
  documents,
  attempts,
  theme,
  setTheme,
  onCreateQuiz,
  onUploadFile,
  onDeleteDocument,
  onStartQuiz,
  onAttemptComplete,
  onLogout,
  onDismissApiError,
  apiError,
  dataLoading,
  startingQuizId,
  user,
}) {
  const navigate = useNavigate();
  const quizzes = useMemo(
    () => documents
      .filter((document) => document.questions?.length)
      .map((document) => mapServerQuiz(document, attempts)),
    [documents, attempts],
  );
  const visibleDocuments = useMemo(() => documents.map(mapServerDocument), [documents]);
  const activities = useMemo(() => mapActivities(documents, attempts), [documents, attempts]);

  return (
    <Routes>
      <Route
        element={(
          <AppShell
            theme={theme}
            onLogout={onLogout}
            user={user}
            documentCount={documents.length}
            loading={dataLoading}
            apiError={apiError}
            onDismissApiError={onDismissApiError}
          />
        )}
      >
        <Route
          index
          element={(
            <Dashboard
              userName={user?.name}
              quizzes={quizzes}
              documents={visibleDocuments}
              activities={activities}
              attempts={attempts}
              onStartQuiz={onStartQuiz}
              startingQuizId={startingQuizId}
            />
          )}
        />
        <Route path="create-quiz" element={<CreateQuiz onCreateQuiz={onCreateQuiz} onStartQuiz={onStartQuiz} />} />
        <Route
          path="quizzes"
          element={(
            <MyQuizzes
              quizzes={quizzes}
              onDelete={(quiz) => onDeleteDocument(quiz.serverDocumentId)}
              onStart={onStartQuiz}
              onViewResults={(quiz) => {
                if (quiz.lastAttemptId) navigate(`/attempt/${quiz.lastAttemptId}`);
              }}
              startingQuizId={startingQuizId}
            />
          )}
        />
        <Route
          path="attempt/:attemptId"
          element={(
            <QuizPreview
              onStartNew={onStartQuiz}
              onAttemptComplete={(attempt) => {
                const summary = attemptSummary(attempt);
                onAttemptComplete(summary);
              }}
            />
          )}
        />
        <Route
          path="documents"
          element={(
            <PDFLibrary
              documents={visibleDocuments}
              onUpload={onUploadFile}
              onDelete={onDeleteDocument}
            />
          )}
        />
        <Route path="history" element={<History activities={activities} />} />
        <Route path="settings" element={<Settings theme={theme} setTheme={setTheme} user={user} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [theme, setThemeState] = useState(readTheme);
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authLoading, setAuthLoading] = useState(true);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authNotice, setAuthNotice] = useState('');
  const [dataLoading, setDataLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [startingQuizId, setStartingQuizId] = useState(null);

  useEffect(() => {
    clearLegacyBrowserData();
  }, []);

  useEffect(() => {
    let active = true;
    currentUserApi()
      .then((serverUser) => {
        if (active) setUser(serverUser);
      })
      .catch((error) => {
        if (!active) return;
        if (error.status !== 401 && error.status !== 403) {
          setAuthNotice('Could not connect to QuizAI. Check that the backend is running, then try again.');
        }
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const handleExpiredSession = () => {
      setDocuments([]);
      setAttempts([]);
      setUser(null);
      setAuthMode('login');
      setAuthNotice('Your session expired. Sign in again to continue.');
    };
    window.addEventListener('quizai:session-expired', handleExpiredSession);
    return () => window.removeEventListener('quizai:session-expired', handleExpiredSession);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('quizai-theme', theme);
    } catch (error) {
      console.error('Could not save the appearance preference.', error);
    }
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!user) {
      setDocuments([]);
      setAttempts([]);
      setDataLoading(false);
      return undefined;
    }

    let active = true;
    setDataLoading(true);
    setApiError('');
    Promise.all([listDocumentsApi(), listAttemptsApi()])
      .then(([serverDocuments, serverAttempts]) => {
        if (!active) return;
        setDocuments(serverDocuments);
        setAttempts(serverAttempts);
      })
      .catch((error) => {
        if (active) setApiError(error.message || 'Could not load your learning data.');
      })
      .finally(() => {
        if (active) setDataLoading(false);
      });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!user || !documents.some((document) => document.processing_status === 'processing')) {
      return undefined;
    }

    let active = true;
    const pollDocuments = async () => {
      try {
        const serverDocuments = await listDocumentsApi();
        if (active) setDocuments(serverDocuments);
      } catch (error) {
        if (active) setApiError(error.message || 'Could not refresh document status.');
      }
    };
    const timer = window.setInterval(pollDocuments, 1500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [user, documents]);

  const setTheme = (nextTheme) => setThemeState(nextTheme);

  const onUploadFile = async (file) => {
    if (!file) return;
    const uploaded = await uploadDocumentApi(file);
    setDocuments((current) => [
      uploaded,
      ...current.filter((document) => document.id !== uploaded.id),
    ]);
    return mapServerDocument(uploaded);
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
    if (!document.questions?.length) {
      throw new Error('The server could not generate questions from this source.');
    }
    setDocuments((current) => [
      document,
      ...current.filter((item) => item.id !== document.id),
    ]);
    return mapServerQuiz(document, attempts);
  };

  const onDeleteDocument = async (documentId) => {
    setApiError('');
    try {
      await deleteDocumentApi(documentId);
      setDocuments((current) => current.filter((document) => document.id !== documentId));
    } catch (error) {
      setApiError(error.message || 'The document could not be deleted.');
    }
  };

  const onStartQuiz = async (quizOrDocumentId) => {
    const documentId = typeof quizOrDocumentId === 'number'
      ? quizOrDocumentId
      : quizOrDocumentId.serverDocumentId;
    if (!documentId) {
      setApiError('This quiz is not available on the server. Create it again to start an attempt.');
      return;
    }

    setStartingQuizId(documentId);
    setApiError('');
    try {
      const attempt = await startAttemptApi(documentId);
      navigate(`/attempt/${attempt.id}`);
    } catch (error) {
      setApiError(error.message || 'Could not start this quiz attempt.');
    } finally {
      setStartingQuizId(null);
    }
  };

  const onAttemptComplete = (summary) => {
    setAttempts((current) => [
      summary,
      ...current.filter((attempt) => attempt.id !== summary.id),
    ]);
  };

  const onAuthSubmit = async ({ name, email, password }) => {
    setAuthSubmitting(true);
    setAuthNotice('');
    try {
      const serverUser = authMode === 'signup'
        ? await signupApi(name, email, password)
        : await loginApi(email, password);
      setUser(serverUser);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const onLogout = async () => {
    setApiError('');
    try {
      await logoutApi();
      setUser(null);
      setAuthMode('login');
      setAuthNotice('');
    } catch (error) {
      setApiError(error.message || 'Could not sign out. Please try again.');
    }
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
        notice={authNotice}
      />
    );
  }

  return (
    <RoutedApp
      documents={documents}
      attempts={attempts}
      theme={theme}
      setTheme={setTheme}
      onCreateQuiz={onCreateQuiz}
      onUploadFile={onUploadFile}
      onDeleteDocument={onDeleteDocument}
      onStartQuiz={onStartQuiz}
      onAttemptComplete={onAttemptComplete}
      onLogout={onLogout}
      onDismissApiError={() => setApiError('')}
      apiError={apiError}
      dataLoading={dataLoading}
      startingQuizId={startingQuizId}
      user={user}
    />
  );
}
