const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

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

async function apiRequest(path, options) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
  });
  if (!response.ok) {
    let message = `The server returned ${response.status}`;
    try {
      const body = await response.json();
      message = body.error || body.detail || message;
    } catch {
      // Keep the status-based message when the server does not return JSON.
    }
    throw new Error(message);
  }
  if (response.status === 204) return null;
  return response.json();
}

export function generateQuizApi({ text, title, topic, questionCount, file }) {
  if (file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('topic', topic || title);
    formData.append('question_count', String(questionCount));
    return apiRequest('/api/generate-quiz/', { method: 'POST', body: formData });
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
  });
}

export function uploadDocumentApi(file) {
  const formData = new FormData();
  formData.append('file', file);
  return apiRequest('/api/upload-document/', { method: 'POST', body: formData });
}

export function listDocumentsApi() {
  return apiRequest('/api/documents/');
}

export function deleteDocumentApi(documentId) {
  return apiRequest(`/api/documents/${documentId}/`, { method: 'DELETE' });
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
