import os
from flask import Flask, render_template, request, session
from full_pipeline import build_quiz
from save_to_db import save_document, save_question

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "dev-secret-key")


def grade_quiz(form, quiz):
    score = 0
    results = []

    for idx, q in enumerate(quiz):
        selected_answer = form.get(f"q{idx}")
        is_correct = selected_answer == q["answer"]
        results.append({
            "selected": selected_answer,
            "is_correct": is_correct,
        })
        if is_correct:
            score += 1

    return score, results


@app.route("/", methods=["GET", "POST"])
def index():
    quiz = None
    error = None
    score = None
    results = None

    if request.method == "POST":
        action = request.form.get("action", "generate")

        if action == "grade":
            quiz = session.get("quiz")
            text = request.form.get("text", session.get("text", ""))

            if not quiz:
                error = "Quiz data is missing. Please regenerate the quiz."
            else:
                unanswered = [idx for idx in range(len(quiz)) if f"q{idx}" not in request.form]
                if unanswered:
                    error = "Please answer every question before checking your score."
                    session["text"] = text
                    session["quiz"] = quiz
                else:
                    score, results = grade_quiz(request.form, quiz)
                    session["text"] = text
                    session["quiz"] = quiz
        else:
            text = request.form.get("text", "").strip()

            if not text:
                error = "Please paste some text first."
            else:
                try:
                    quiz = build_quiz(text)

                    if not quiz:
                        error = "Couldn't generate questions from this text — try a longer or more detailed paragraph."
                    else:
                        # Save to database
                        doc_id = save_document(text)
                        for q in quiz:
                            save_question(
                                document_id=doc_id,
                                question_text=q["question"],
                                question_type="MCQ",
                                correct_answer=q["answer"],
                                options=q["options"]
                            )
                        session["quiz"] = quiz
                        session["text"] = text
                except Exception as e:
                    error = f"Something went wrong: {e}"

    return render_template("index.html", quiz=quiz, error=error, score=score, results=results)

if __name__ == "__main__":
    app.run(debug=True)