# AI Quiz Generator

An AI-powered platform that automatically generates multiple-choice quiz questions from any text input, using NLP entity extraction, transformer-based question generation, and semantic similarity for distractor generation.

## Features

- Paste any paragraph of text and get back a full multiple-choice quiz
- Answer the quiz directly in the browser with instant scoring and feedback
- Works on both **named-entity-rich text** (biographies, history, current events) and **conceptual/technical text** (works via noun-phrase fallback extraction)
- Wrong answer choices ("distractors") are chosen using semantic similarity, not random selection — so they're plausible rather than obviously wrong
- All generated quizzes are persisted to a relational database
- Simple web interface with loading feedback and a "Download as PDF" option

## Tech Stack

| Layer | Technology |
|---|---|
| Language | Python 3.11 |
| NLP / entity extraction | spaCy (`en_core_web_sm`) |
| Question generation | Hugging Face Transformers — `valhalla/t5-base-qg-hl` (T5) |
| Distractor generation | Sentence-Transformers — `all-MiniLM-L6-v2` |
| Database | MySQL |
| Backend / Web UI | Flask |

## Architecture

```
User pastes text (browser)
        │
        ▼
Flask route (app.py)
        │
        ▼
Text preprocessing & sentence segmentation (spaCy)
        │
        ▼
Answer candidate extraction
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
Saved to MySQL (documents → questions → options)
        │
        ▼
Rendered back to the user in the browser
```

## Database Schema

```sql
documents
├── id (PK)
├── content (TEXT)
└── created_at (TIMESTAMP)

questions
├── id (PK)
├── document_id (FK → documents.id)
├── question_text (TEXT)
├── question_type (ENUM: MCQ, TRUE_FALSE, SHORT_ANSWER)
└── correct_answer (TEXT)

options
├── id (PK)
├── question_id (FK → questions.id)
├── option_text (TEXT)
└── is_correct (BOOLEAN)
```

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
USE quiz_generator;

CREATE TABLE documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    document_id INT,
    question_text TEXT,
    question_type ENUM('MCQ','TRUE_FALSE','SHORT_ANSWER'),
    correct_answer TEXT,
    FOREIGN KEY (document_id) REFERENCES documents(id)
);

CREATE TABLE options (
    id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT,
    option_text TEXT,
    is_correct BOOLEAN,
    FOREIGN KEY (question_id) REFERENCES questions(id)
);
```

### 4. Configure database credentials
Create `db_config.py`:
```python
DB_CONFIG = {
    "host": "127.0.0.1",
    "user": "root",
    "password": "YOUR_PASSWORD",
    "database": "quiz_generator"
}
```

### 5. Run the app
```bash
python app.py
```
Visit `http://127.0.0.1:5000`.

## Known Limitations

These are real, current limitations of the pipeline — not bugs, but honest constraints worth being aware of:

- **Pronoun ambiguity**: Since questions are generated one sentence at a time, pronouns like "he," "she," or "it" aren't resolved back to their original subject. A sentence like *"He was born in 1879"* can produce the question *"When was he born?"* — technically correct, but ambiguous outside the source paragraph's context. A future improvement would resolve pronouns to their referent before generation.
- **List-heavy or multi-clause sentences produce less fluent questions**: The T5 model performs best on simple, single-fact sentences. Dense sentences with multiple clauses or lists can produce awkward or repetitive phrasing.
- **Distractor pool depends on document size**: Wrong-answer options are drawn from entities/phrases found elsewhere in the same document. Very short input text may not yield enough distractors, in which case that question is skipped rather than shown with a misleading or too-easy set of options.
- **Named Entity Recognition isn't domain-specific**: spaCy's general-purpose model can occasionally mislabel domain-specific terms (e.g., tagging "AC" as an organization rather than a technical term).
- **No coreference resolution across sentences**: Each sentence is processed independently, so context from prior sentences isn't used when generating a question.

## Possible Future Improvements

- True/False and Short Answer question type generation (schema already supports this)
- Pronoun/coreference resolution before question generation
- PDF/DOCX upload support instead of paste-only input
- Difficulty levels based on distractor similarity scores
- User accounts and quiz history
- "Take the quiz" interactive mode with scoring
- Live deployment (Render/Railway) with a cloud-hosted database

## Project Structure

```
ai-quiz-generator/
├── app.py                  # Flask web server
├── full_pipeline.py        # Core NLP + AI pipeline (extraction, QG, distractors)
├── save_to_db.py           # MySQL insert/query functions
├── db_config.py            # Database credentials (not committed to git)
├── requirements.txt        # Python dependencies
├── templates/
│   └── index.html          # Web UI
└── README.md
```
