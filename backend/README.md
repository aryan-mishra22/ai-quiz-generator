# QuizAI Backend

Django REST API for QuizAI. It handles authentication, PDF text extraction, document storage, and quiz generation.

## Requirements

- Python 3.12
- PostgreSQL

## Local setup (Windows PowerShell)

From the repository root:

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r .\requirements.txt
Copy-Item .\.env.example .\.env
```

Generate a secret key:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(50))"
```

Set the generated value as `DJANGO_SECRET_KEY` in `backend/.env`.
`DJANGO_CSRF_TRUSTED_ORIGINS` is already set in the example for both local Vite URLs. In deployment, set it to the frontend's HTTPS origin.

Create a PostgreSQL role and database (for example, in `psql` as a database administrator):

```postgresql
CREATE ROLE quiz_app WITH LOGIN PASSWORD 'YOUR_LOCAL_POSTGRES_PASSWORD';
CREATE DATABASE quiz_generator OWNER quiz_app;
```

Set the database password in the same PowerShell window; it must not be stored in `.env`:

```powershell
$env:DB_PASSWORD = 'YOUR_LOCAL_POSTGRES_PASSWORD'
python .\manage.py migrate
python .\manage.py runserver
```

The API runs at `http://127.0.0.1:8000`. Configure `DB_NAME`, `DB_USER`, `DB_HOST`, and `DB_PORT` in `.env` if your PostgreSQL settings differ (the default port is `5432`).

Switching the database configuration does not copy existing records from MySQL. The old database is left untouched; export/import its data separately if you need to preserve it.

## Main endpoints

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/auth/signup/` | Create account |
| POST | `/api/auth/login/` | Sign in |
| POST | `/api/auth/logout/` | Sign out |
| GET | `/api/auth/me/` | Current user |
| POST | `/api/generate-quiz/` | Generate a quiz from text or PDF |
| POST | `/api/upload-document/` | Upload a PDF and extract text |
| GET | `/api/documents/` | List documents and questions |
| DELETE | `/api/documents/<id>/` | Delete a document |
| GET, POST | `/api/attempts/` | List your attempts or start an attempt |
| GET | `/api/attempts/<id>/` | Fetch your attempt/results |
| POST | `/api/attempts/<id>/submit/` | Submit answers and receive server grading |

## PDF extraction and chunks

PDF uploads are extracted page by page. The document stores each page's original and cleaned text, a report of repeated header/footer lines removed, and its processing status or failure reason. PDFs with almost no readable text fail with a scanned-PDF message instead of creating empty chunks.

Readable uploads are sentence-chunked during upload. `DocumentChunk` stores the document, start/end page, position, text, and an empty topic label for later use. Chunks target 300 words, overlap by up to 50 words at sentence boundaries, and span no more than three pages. Embeddings and a vector index are not implemented yet.

## Check configuration

With `DJANGO_SECRET_KEY` and `DB_PASSWORD` configured:

```powershell
python .\manage.py check
```
