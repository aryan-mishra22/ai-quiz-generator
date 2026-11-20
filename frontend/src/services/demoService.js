import { initialActivities, initialDocuments, initialQuizzes, questionBank } from '../data/mockData.js';

const STORAGE_KEY = 'quizai-demo-v1';

export function loadDemoState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return {
      quizzes: initialQuizzes,
      documents: initialDocuments,
      activities: initialActivities,
    };
  }
  return JSON.parse(saved);
}

export function saveDemoState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function createMockQuestions(count, difficulty, questionTypes, optionCount) {
  return Array.from({ length: count }, (_, index) => {
    const base = questionBank[index % questionBank.length];
    const type = questionTypes[index % questionTypes.length] || 'Multiple Choice';
    const options = type === 'True / False'
      ? ['True', 'False']
      : base.options.slice(0, optionCount);
    let correctAnswers = type === 'True / False'
      ? [index % 2 === 0 ? 'True' : 'False']
      : [options[base.correctIndex % options.length]];

    if (type === 'Multiple Select' && options.length > 1) {
      correctAnswers = [options[0], options[Math.min(2, options.length - 1)]];
    }

    return {
      ...base,
      id: `question-${Date.now()}-${index}`,
      question: count > questionBank.length
        ? `${base.question} (Review ${Math.floor(index / questionBank.length) + 1})`
        : base.question,
      options,
      correctAnswers: [...new Set(correctAnswers)],
      difficulty,
      type,
      source: base.source,
    };
  });
}

export function createMockDocument(file) {
  return {
    id: `doc-${Date.now()}`,
    name: file.name,
    size: formatFileSize(file.size),
    pages: Math.max(1, Math.ceil(file.size / 120_000)),
    uploadedAt: new Date().toISOString(),
  };
}

export function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function calculateScore(questions, answers) {
  const correctCount = questions.reduce((total, question) => {
    const selected = answers[question.id] || [];
    const expected = question.correctAnswers || [question.options[question.correctIndex]];
    const normalizedSelected = [...selected].sort();
    const normalizedExpected = [...expected].sort();
    const isCorrect = normalizedSelected.length === normalizedExpected.length
      && normalizedSelected.every((answer, index) => answer === normalizedExpected[index]);
    return total + Number(isCorrect);
  }, 0);

  return Math.round((correctCount / questions.length) * 100);
}

export function formatDate(dateString) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(dateString));
}

export function formatRelativeTime(dateString) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(dateString).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return formatDate(dateString);
}

export function addActivity(state, activity) {
  return [{ id: `activity-${Date.now()}`, createdAt: new Date().toISOString(), ...activity }, ...state].slice(0, 30);
}
