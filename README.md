# AI Quiz Generator

An AI-powered platform that automatically generates multiple-choice quiz questions from any text input, using NLP entity extraction, transformer-based question generation, and semantic similarity for distractor generation.

Built with **Django** and **Django REST Framework (DRF)** on the backend, with a lightweight **vanilla JavaScript** frontend that talks to the API via `fetch()` — no page reloads, no frontend framework required.

## Features

- Paste a paragraph (or a few sentences on a topic) and get back a full multiple-choice quiz
- Fully asynchronous UI — the page never reloads; JavaScript calls the API and renders results in place
- Works on both **named-entity-rich text** (biographies, history, current events) and **conceptual/technical text** (via noun-phrase fallback extraction)
- Wrong answer choices ("distractors") are chosen using semantic similarity, not random selection — so they're plausible rather than obviously wrong
- All generated quizzes are persisted to a relational database via Django's ORM
- Loading spinner while the quiz is generating
- "Download as PDF" button (browser print-to-PDF, styled to hide everything but the quiz)

## Tech Stack

| Layer | Technology |
|---|---|
| Language | Python 3.11 |
| Web framework | Django |
| API layer | Django REST Framework (DRF) |
| Frontend | HTML, CSS, vanilla JavaScript (`fetch` API) |
| NLP / entity extraction | spaCy (`en_core_web_sm`) |
| Question generation | Hugging Face Transformers — `valhalla/t5-base-qg-hl` (T5) |
| Distractor generation | Sentence-Transformers — `all-MiniLM-L6-v2` |
| Database | MySQL (via Django ORM) |

## How the frontend talks to the backend

The page (`quiz/templates/quiz/index.html`) is a single form with no server-rendered quiz logic. On submit, JavaScript:

1. Reads the pasted text from the textarea
2. Sends a `POST` request to `/api/generate-quiz/` (a DRF endpoint) with the text as JSON, including Django's CSRF token as a header
3. Receives a JSON response containing the generated questions, options, and correct answers
4. Renders the quiz directly into the page via DOM manipulation — no reload, no server-rendered HTML for the results

This means the same `/api/generate-quiz/` endpoint could equally be consumed by a React app, a mobile app, or any other client — the JavaScript in this project is just one example consumer of the API.

## Architecture

```
User pastes text (browser)
        │
        ▼
JavaScript (fetch) → POST /api/generate-quiz/
        │
        ▼
Django URL routing (quizproject/urls.py → quiz/urls.py)
        │
        ▼
DRF API view (quiz/views.py → generate_quiz_api)
        │
        ▼
Text preprocessing & sentence segmentation (spaCy)
        │
        ▼
Answer candidate extraction (quiz/full_pipeline.py)
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
JSON response → JavaScript renders quiz in the page
```

## Database Schema

Schema is defined via Django models (`quiz/models.py`) and created through migrations — no manual SQL required.

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

## Setup

### 1. Clone and create a virtual environment
```bash
git clone <your-repo-url>
cd ai-quiz-generator
python -m venv venv
source venv/Scripts/activate   # Windows (Git Bash)
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

### 3. Set up MySQL
```sql
CREATE DATABASE quiz_generator;
```

### 4. Configure the database in Django settings
In `quizproject/settings.py`:
```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'quiz_generator',
        'USER': 'root',
        'PASSWORD': 'YOUR_PASSWORD',
        'HOST': '127.0.0.1',
        'PORT': '3306',
    }
}
```

> **Note (Windows + MySQL 8):** if you hit `Access denied for user 'root'@'localhost'` even with the correct password, it's usually a `mysqlclient` / `caching_sha2_password` authentication mismatch, not a wrong credential. Fix by switching the auth plugin:
> ```sql
> ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'YOUR_PASSWORD';
> FLUSH PRIVILEGES;
> ```

### 5. Run migrations
```bash
python manage.py makemigrations quiz
python manage.py migrate
```

### 6. Run the server
```bash
python manage.py runserver
```
Visit `http://127.0.0.1:8000` — paste a paragraph and click **Generate Quiz**.

## API Endpoints (DRF)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | The quiz generator page (HTML + JS frontend) |
| POST | `/api/generate-quiz/` | Accepts `{"text": "..."}`, returns generated quiz as JSON, saves to DB. This is what the frontend JavaScript calls. |
| GET | `/api/documents/` | Returns all previously generated documents + their questions/options as JSON |

Example request (independent of the frontend):
```bash
curl -X POST http://127.0.0.1:8000/api/generate-quiz/ \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"Albert Einstein developed the theory of relativity in 1905.\"}"
```

## Known Limitations

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
- Swap the vanilla JS frontend for a React app consuming the same `/api/generate-quiz/` endpoint, with no backend changes required

## Project Structure

```
ai-quiz-generator/
├── manage.py                    # Django entry point
├── quizproject/
│   ├── settings.py              # Project settings, incl. DATABASES
│   ├── urls.py                  # Root URL routing
│   ├── asgi.py
│   └── wsgi.py
├── quiz/
│   ├── models.py                # Document, Question, Option models
│   ├── serializers.py           # DRF serializers
│   ├── views.py                 # HTML view + DRF API views
│   ├── urls.py                  # App-level URL routing
│   ├── admin.py
│   ├── full_pipeline.py         # Core NLP + AI pipeline (extraction, QG, distractors)
│   ├── migrations/              # Auto-generated schema migrations
│   └── templates/quiz/
│       └── index.html           # Frontend: HTML/CSS/JS, calls the DRF API via fetch()
├── requirements.txt             # Python dependencies
└── README.md
```
