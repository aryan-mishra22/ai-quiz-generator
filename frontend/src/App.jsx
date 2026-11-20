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
import {
  addActivity,
  createMockDocument,
  createMockQuestions,
  loadDemoState,
  saveDemoState,
} from './services/demoService.js';

function RoutedApp({ state, setState, theme, setTheme, onCreateQuiz, onUploadFile, onCompleteQuiz }) {
  const navigate = useNavigate();

  return (
    <Routes>
      <Route element={<AppShell theme={theme} />}>
        <Route
          index
          element={
            <Dashboard
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
              onDelete={(id) => setState((current) => ({ ...current, documents: current.documents.filter((doc) => doc.id !== id) }))}
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

  useEffect(() => {
    saveDemoState(state);
  }, [state]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('quizai-theme', theme);
  }, [theme]);

  const setTheme = (nextTheme) => setThemeState(nextTheme);

  const onUploadFile = (file) => {
    if (!file) return;
    const document = createMockDocument(file);
    setState((current) => ({
      ...current,
      documents: [document, ...current.documents],
      activities: addActivity(current.activities, {
        type: 'uploaded',
        title: `Uploaded ${file.name}`,
        detail: `${document.pages} pages · ${document.size}`,
      }),
    }));
    return document;
  };

  const onCreateQuiz = async (config) => {
    await new Promise((resolve) => window.setTimeout(resolve, 1100));
    const quiz = {
      id: `quiz-${Date.now()}`,
      title: config.title.trim(),
      sourceTitle: config.sourceTitle,
      sourceType: config.sourceType,
      topic: config.topic || config.title.trim(),
      questionCount: Number(config.questionCount),
      difficulty: config.difficulty,
      createdAt: new Date().toISOString(),
      score: null,
      lastAttemptAt: null,
      includeExplanations: config.includeExplanations,
      questions: createMockQuestions(
        Number(config.questionCount),
        config.difficulty,
        config.questionTypes,
        Number(config.optionCount),
      ),
    };
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

  return (
    <RoutedApp
      state={state}
      setState={setState}
      theme={theme}
      setTheme={setTheme}
      onCreateQuiz={onCreateQuiz}
      onUploadFile={onUploadFile}
      onCompleteQuiz={onCompleteQuiz}
    />
  );
}
