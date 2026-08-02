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

GOOD_LABELS = {"PERSON", "DATE", "GPE", "ORG", "NORP"}

# Step A: collect ALL entities in the doc, grouped by label
entities_by_label = {}
for ent in doc.ents:
    if ent.label_ in GOOD_LABELS:
        entities_by_label.setdefault(ent.label_, set()).add(ent.text)

print("Entities by label:", entities_by_label)
print()

def get_distractors(answer_text, label, n=3):
    """Pick up to n distractors of the same entity type, excluding the correct answer."""
    pool = entities_by_label.get(label, set()) - {answer_text}
    pool = list(pool)
    random.shuffle(pool)
    return pool[:n]

mcqs = []
skipped = []

for sent in doc.sents:
    sent_text = sent.text.strip()
    candidate_ents = [ent for ent in sent.ents if ent.label_ in GOOD_LABELS]

    if not candidate_ents:
        continue

    answer_ent = random.choice(candidate_ents)
    answer_text = answer_ent.text
    label = answer_ent.label_

    question_text = sent_text.replace(answer_text, "______", 1)
    distractors = get_distractors(answer_text, label)

    # Only keep as MCQ if we found enough distractors
    if len(distractors) < 2:
        skipped.append((sent_text, answer_text, label, len(distractors)))
        continue

    options = distractors + [answer_text]
    random.shuffle(options)

    mcqs.append({
        "question": question_text,
        "options": options,
        "answer": answer_text
    })

print("=== Generated MCQs ===\n")
for i, q in enumerate(mcqs, 1):
    print(f"Q{i}: {q['question']}")
    for idx, opt in enumerate(q['options'], 1):
        marker = " (correct)" if opt == q['answer'] else ""
        print(f"   {idx}. {opt}{marker}")
    print("-" * 50)

print("\n=== Skipped (not enough distractors) ===\n")
for sent_text, answer_text, label, count in skipped:
    print(f"Sentence: {sent_text}")
    print(f"Tried answer: '{answer_text}' ({label}) — only found {count} distractor(s)")
    print("-" * 50)