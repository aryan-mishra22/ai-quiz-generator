# QuizAI

QuizAI is a study tool that turns learning materials into practice quizzes. Upload a PDF or enter text, generate multiple-choice questions, and use the quiz to check your understanding.

## What it does

- Provides account sign-up, login, and logout
- Extracts text from uploaded PDFs
- Generates multiple-choice quizzes from supplied text
- Lets users practice, review answers, and view scores
- Organizes uploaded documents and generated questions
- Offers light and dark appearance settings

## How it works

QuizAI is organized as one repository with two applications:

- [Frontend](frontend/README.md) — the React interface for accounts, documents, and quizzes
- [Backend](backend/README.md) — the Django API, MySQL data store, PDF extraction, and question-generation pipeline

The frontend communicates with the backend through its REST API.

## Current limitations

- Quiz generation currently supports multiple-choice questions only.
- PDFs are text-extracted; scanned-document OCR is not supported.
- Quiz scores and appearance preferences are stored in the browser, not in account history.
- Uploaded documents and questions are not yet isolated per user.
