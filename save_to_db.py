import mysql.connector
from db_config import DB_CONFIG

def get_connection():
    return mysql.connector.connect(**DB_CONFIG)

def save_document(content):
    """Insert the source text into documents table, return its ID."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO documents (content) VALUES (%s)", (content,))
    conn.commit()
    doc_id = cursor.lastrowid
    cursor.close()
    conn.close()
    return doc_id

def save_question(document_id, question_text, question_type, correct_answer, options=None):
    """Insert a question, and its options if it's an MCQ."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "INSERT INTO questions (document_id, question_text, question_type, correct_answer) VALUES (%s, %s, %s, %s)",
        (document_id, question_text, question_type, correct_answer)
    )
    question_id = cursor.lastrowid

    if question_type == "MCQ" and options:
        for opt in options:
            is_correct = (opt == correct_answer)
            cursor.execute(
                "INSERT INTO options (question_id, option_text, is_correct) VALUES (%s, %s, %s)",
                (question_id, opt, is_correct)
            )

    conn.commit()
    cursor.close()
    conn.close()
    return question_id


if __name__ == "__main__":
    print("Testing database connection...")

    doc_id = save_document("Albert Einstein developed the theory of relativity in 1905.")
    print(f"Inserted document with ID: {doc_id}")

    q_id = save_question(
        document_id=doc_id,
        question_text="Who developed the theory of relativity?",
        question_type="MCQ",
        correct_answer="Albert Einstein",
        options=["Albert Einstein", "Isaac Newton", "Nikola Tesla", "Marie Curie"]
    )
    print(f"Inserted question with ID: {q_id}")
    print("Success! Check MySQL Workbench to see the new rows.")