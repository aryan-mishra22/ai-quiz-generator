# QuizAI Frontend

React application for signing in, managing study documents, and practicing generated quizzes.

## Requirements

- Node.js 20.19+ or 22.12+
- QuizAI backend running locally for API features

## Local setup (Windows PowerShell)

From the repository root:

```powershell
cd frontend
Copy-Item .\.env.example .\.env
npm install
npm run dev
```

Open `http://localhost:5173`. In development, Vite proxies `/api` requests to `http://127.0.0.1:8000`; leave `VITE_API_BASE_URL` blank in `.env`.

## Tests and production build

```powershell
npm test
npm run build
```

For deployment, set `VITE_API_BASE_URL` to the Django API origin before building.
