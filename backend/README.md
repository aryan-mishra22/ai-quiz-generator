# QuizAI Backend

Django REST API for QuizAI. It handles authentication, PDF text extraction, document storage, and quiz generation.

## Requirements

- Python 3.12
- MySQL

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

Create a MySQL database and user:

```sql
CREATE DATABASE quiz_generator;
CREATE USER 'quiz_app'@'127.0.0.1' IDENTIFIED BY 'YOUR_LOCAL_MYSQL_PASSWORD';
GRANT ALL PRIVILEGES ON quiz_generator.* TO 'quiz_app'@'127.0.0.1';
```

Set the database password in the same PowerShell window; it must not be stored in `.env`:

```powershell
$env:DB_PASSWORD = 'YOUR_LOCAL_MYSQL_PASSWORD'
python .\manage.py migrate
python .\manage.py runserver
```

The API runs at `http://127.0.0.1:8000`. Configure `DB_NAME`, `DB_USER`, `DB_HOST`, and `DB_PORT` in `.env` if your MySQL settings differ.

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

## Check configuration

With `DJANGO_SECRET_KEY` and `DB_PASSWORD` configured:

```powershell
python .\manage.py check
```
