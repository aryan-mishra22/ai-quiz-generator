import spacy
import random

nlp = spacy.load("en_core_web_sm")

text = """
Albert Einstein developed the theory of relativity in 1905. 
He was born in Ulm, Germany, in 1879. 
Einstein won the Nobel Prize in Physics in 1921. 
In 1933, Einstein moved to the United States to escape Nazi persecution.
"""

doc = nlp(text)

# We'll only use these entity types as "good answers"
GOOD_LABELS = {"PERSON", "DATE", "GPE", "ORG", "NORP"}

questions = []

for sent in doc.sents:
    sent_text = sent.text.strip()
    candidate_ents = [ent for ent in sent.ents if ent.label_ in GOOD_LABELS]

    if not candidate_ents:
        continue

    # pick one entity from this sentence as the answer
    answer_ent = random.choice(candidate_ents)
    answer_text = answer_ent.text

    # blank it out to form a short-answer / fill-in-the-blank question
    question_text = sent_text.replace(answer_text, "______", 1)

    questions.append({
        "question": question_text,
        "answer": answer_text,
        "type": "SHORT_ANSWER"
    })

print("=== Generated Questions ===\n")
for i, q in enumerate(questions, 1):
    print(f"Q{i}: {q['question']}")
    print(f"Answer: {q['answer']}")
    print("-" * 50)