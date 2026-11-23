const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function getCookie(name) {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1];
}

async function ensureCsrf() {
  if (!getCookie('csrftoken')) {
    await apiRequest('/api/auth/csrf/', { method: 'GET' });
  }
  return getCookie('csrftoken');
}

async function authRequest(path, body) {
  const csrfToken = await ensureCsrf();
  return apiRequest(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken || '',
    },
    body: JSON.stringify(body),
  });
}

async function apiRequest(path, options = {}, { requiresAuth = false } = {}) {
  const method = (options.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const headers = new Headers(options.headers || {});
    if (!headers.has('X-CSRFToken')) {
      headers.set('X-CSRFToken', (await ensureCsrf()) || '');
    }
    options = { ...options, headers };
  }

  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
  });
  if (!response.ok) {
    let message = `The server returned ${response.status}`;
    let responseBody = {};
    try {
      responseBody = await response.json();
      message = responseBody.error || responseBody.detail || message;
    } catch {
      // Keep the status-based message when the server does not return JSON.
    }
    const unauthenticated = response.status === 401
      || (response.status === 403 && (
        responseBody.code === 'not_authenticated'
        || /authentication credentials were not provided/i.test(message)
      ));
    if (requiresAuth && unauthenticated) {
      window.dispatchEvent(new Event('quizai:session-expired'));
    }
    throw new ApiError(message, response.status, responseBody.code);
  }
  if (response.status === 204) return null;
  return response.json();
}

function protectedPost(path, body) {
  return ensureCsrf().then((csrfToken) => apiRequest(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken || '',
    },
    body: JSON.stringify(body),
  }, { requiresAuth: true }));
}

export function generateQuizApi({ text, title, topic, questionCount, file }) {
  if (file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('topic', topic || title);
    formData.append('question_count', String(questionCount));
    return apiRequest('/api/generate-quiz/', { method: 'POST', body: formData }, { requiresAuth: true });
  }

  return apiRequest('/api/generate-quiz/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      title,
      topic,
      question_count: questionCount,
    }),
  }, { requiresAuth: true });
}

export function uploadDocumentApi(file) {
  const formData = new FormData();
  formData.append('file', file);
  return apiRequest('/api/upload-document/', { method: 'POST', body: formData }, { requiresAuth: true });
}

export function listDocumentsApi() {
  return apiRequest('/api/documents/', {}, { requiresAuth: true });
}

export function deleteDocumentApi(documentId) {
  return apiRequest(`/api/documents/${documentId}/`, { method: 'DELETE' }, { requiresAuth: true });
}

export function signupApi(name, email, password) {
  return authRequest('/api/auth/signup/', { name, email, password });
}

export function loginApi(email, password) {
  return authRequest('/api/auth/login/', { email, password });
}

export function logoutApi() {
  return ensureCsrf().then((csrfToken) => apiRequest('/api/auth/logout/', {
    method: 'POST',
    headers: { 'X-CSRFToken': csrfToken || '' },
  }));
}

export function currentUserApi() {
  return apiRequest('/api/auth/me/', { method: 'GET' });
}

export function listAttemptsApi() {
  return apiRequest('/api/attempts/', {}, { requiresAuth: true });
}

export function startAttemptApi(documentId) {
  return protectedPost('/api/attempts/', { document_id: documentId });
}

export function getAttemptApi(attemptId) {
  return apiRequest(`/api/attempts/${attemptId}/`, {}, { requiresAuth: true });
}

export function submitAttemptApi(attemptId, answers) {
  return protectedPost(`/api/attempts/${attemptId}/submit/`, { answers });
}
