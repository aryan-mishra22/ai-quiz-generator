# QuizAI

QuizAI is a responsive learning dashboard for turning study materials into interactive quizzes. The current frontend is a **React + Vite** application with local mock data; it demonstrates the complete user experience without connecting to backend services.

The Django and Django REST Framework application remains in `backend/`. The React frontend does not call it yet. PDF handling, quiz generation, scoring history, and preferences are simulated in the browser and persisted locally for the demo.

## Frontend features

- Dashboard with learning statistics, recent quizzes, and activity
- Quiz creation from a selected PDF file or a topic
- Configurable question count, difficulty, question types, answer count, and explanations
- Interactive quiz practice, navigation, scoring, answer review, and retry
- Quiz search, difficulty/date filters, grid/list views, and delete confirmation
- PDF library with simulated file metadata and delete confirmation
- Activity history and profile, appearance, and notification settings
- Responsive sidebar with collapse and mobile navigation

## Technology

| Layer | Technology |
|---|---|
| Frontend | React, JavaScript, Vite |
| Styling | Tailwind CSS v4 with responsive application styles |
| Routing | React Router DOM |
| Icons | Lucide React |
| Demo persistence | Browser localStorage |
| Existing backend | Django, Django REST Framework, MySQL |
| Existing NLP pipeline | spaCy, Transformers, Sentence-Transformers |

## Frontend demo behavior

Run the frontend independently at `http://localhost:5173`. Its mock service boundary is in `frontend/src/services/demoService.js`; demo quizzes, questions, and documents are in `frontend/src/data/mockData.js`. This keeps mock behavior separate from the UI so it can later be replaced with API calls.

PDF selection currently checks the filename/type and size, then creates sample file metadata. It does **not** upload or read PDF contents. Quiz generation uses bundled mock questions, not AI or RAG. Demo quizzes, documents, and activity are saved in browser localStorage.

## Existing backend quiz-generation flow

```
Text input from an external client
        │
        ▼
Django URL routing (backend/quizproject/urls.py → backend/quiz/urls.py)
        │
        ▼
DRF API view (backend/quiz/views.py → generate_quiz_api)
        │
        ▼
Text preprocessing & sentence segmentation (spaCy)
        │
        ▼
Answer candidate extraction (backend/quiz/full_pipeline.py)
   ├── Named entities (PERSON, DATE, GPE, ORG, NORP)   → used when present
   └── Noun phrases (fallback)                          → used when no entities found
        │
        ▼
Question generation (T5 transformer model)
        │
        ▼
Distractor generation (Sentence-Transformers embedding similarity)
        │
        ▼
Quiz assembled (question + 4 options, 1 correct)
        │
        ▼
Saved to MySQL via Django ORM
   Document.objects.create(...)
   Question.objects.create(...)
   Option.objects.create(...)
        │
        ▼
JSON response → API client (React integration is future work)
```

## Database Schema

Schema is defined via Django models (`backend/quiz/models.py`) and created through migrations — no manual SQL required.

```python
class Document(models.Model):
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

class Question(models.Model):
    QUESTION_TYPES = [
        ('MCQ', 'Multiple Choice'),
        ('TRUE_FALSE', 'True/False'),
        ('SHORT_ANSWER', 'Short Answer'),
    ]
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='questions')
    question_text = models.TextField()
    question_type = models.CharField(max_length=20, choices=QUESTION_TYPES)
    correct_answer = models.TextField()

class Option(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='options')
    option_text = models.TextField()
    is_correct = models.BooleanField(default=False)
```

Resulting tables: `quiz_document`, `quiz_question`, `quiz_option`.

## Run the React frontend

Requirements: Node.js 20.19+ or 22.12+.

```bash
cd frontend
npm install
npm run dev
```

Create a production build with `npm run build`; preview it locally with `npm run preview`.

## Run the existing Django backend

### 1. Clone and create a virtual environment
```bash
git clone <your-repo-url>
cd ai-quiz-generator
python -m venv venv
source venv/Scripts/activate   # Windows (Git Bash)
```

### 2. Install dependencies
```bash
pip install -r backend/requirements.txt
python -m spacy download en_core_web_sm
```

### 3. Set up MySQL
```sql
CREATE DATABASE quiz_generator;
```

### 4. Configure environment variables
Set a Django secret key and your MySQL connection details in the environment. For Git Bash:
```bash
export DJANGO_SECRET_KEY="$(python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())')"
export DB_NAME=quiz_generator
export DB_USER=root
export DB_PASSWORD=YOUR_PASSWORD
export DB_HOST=127.0.0.1
export DB_PORT=3306
```

> **Note (Windows + MySQL 8):** if you hit `Access denied for user 'root'@'localhost'` even with the correct password, it's usually a `mysqlclient` / `caching_sha2_password` authentication mismatch, not a wrong credential. Fix by switching the auth plugin:
> ```sql
> ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'YOUR_PASSWORD';
> FLUSH PRIVILEGES;
> ```

### 5. Run migrations
```bash
python backend/manage.py makemigrations quiz
python backend/manage.py migrate
```

### 6. Run the server
```bash
python backend/manage.py runserver
```
The Django backend and its existing API endpoints are not currently connected to the React app.

## API Endpoints (DRF)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Existing Django-rendered page (separate from the React app) |
| POST | `/api/generate-quiz/` | Accepts `{"text": "..."}`, returns generated quiz as JSON, saves to DB |
| GET | `/api/documents/` | Returns all previously generated documents + their questions/options as JSON |

Example request (independent of the frontend):
```bash
curl -X POST http://127.0.0.1:8000/api/generate-quiz/ \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"Albert Einstein developed the theory of relativity in 1905.\"}"
```

## Existing backend pipeline limitations

These are real, current limitations of the pipeline — not bugs, but honest constraints worth being aware of:

- **Single words or bare topics don't work well as input**: the pipeline needs actual sentences to extract entities or noun phrases from. A one-word topic like "photosynthesis" won't generate questions — a few descriptive sentences about it will.
- **Pronoun ambiguity**: Since questions are generated one sentence at a time, pronouns like "he," "she," or "it" aren't resolved back to their original subject. A sentence like *"He was born in 1879"* can produce the question *"When was he born?"* — technically correct, but ambiguous outside the source paragraph's context.
- **List-heavy or multi-clause sentences produce less fluent questions**: The T5 model performs best on simple, single-fact sentences.
- **Distractor pool depends on document size**: Wrong-answer options are drawn from entities/phrases found elsewhere in the same document. Very short input text may not yield enough distractors, in which case that question is skipped.
- **Named Entity Recognition isn't domain-specific**: spaCy's general-purpose model can occasionally mislabel domain-specific terms (e.g., tagging "AC" as an organization rather than a technical term).
- **No coreference resolution across sentences**: Each sentence is processed independently.

## Possible Future Improvements

- True/False and Short Answer question type generation (schema already supports this)
- Pronoun/coreference resolution before question generation
- PDF/DOCX upload support instead of paste-only input
- Difficulty levels based on distractor similarity scores
- User accounts and quiz history (Django auth already scaffolded in)
- "Take the quiz" interactive mode with scoring, graded server-side
- Live deployment (Render/Railway) with a cloud-hosted database
- DRF authentication (token/session) for the API endpoints
- Connect the React frontend to the Django API and add document Q&A and RAG-based quiz generation

## Project Structure

```
ai-quiz-generator/
├── backend/
│   ├── manage.py                # Django entry point
│   ├── requirements.txt         # Python dependencies
│   ├── full_pipeline.py         # Standalone pipeline copy
│   ├── quizproject/
│   │   ├── settings.py          # Project settings, incl. DATABASES
│   │   ├── urls.py              # Root URL routing
│   │   ├── asgi.py
│   │   └── wsgi.py
│   └── quiz/
│       ├── models.py            # Document, Question, Option models
│       ├── serializers.py       # DRF serializers
│       ├── views.py             # HTML view + DRF API views
│       ├── urls.py              # App-level URL routing
│       ├── admin.py
│       ├── full_pipeline.py     # Core NLP + AI pipeline
│       └── migrations/          # Auto-generated schema migrations
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
│       ├── components/          # Layout, upload, and shared UI
│       ├── data/                # Demo quizzes, questions, and documents
│       ├── pages/               # Dashboard, quiz, library, history, settings
│       ├── services/            # Local demo data and scoring helpers
│       └── styles.css
└── README.md
```
