from save_to_db import save_document, save_question
import spacy
import random
from transformers import T5ForConditionalGeneration, T5Tokenizer
from sentence_transformers import SentenceTransformer, util

print("Loading models... (this may take a moment)")

nlp = spacy.load("en_core_web_sm")

qg_model_name = "valhalla/t5-base-qg-hl"
qg_tokenizer = T5Tokenizer.from_pretrained(qg_model_name)
qg_model = T5ForConditionalGeneration.from_pretrained(qg_model_name)

embed_model = SentenceTransformer('all-MiniLM-L6-v2')

print("All models loaded!\n")

GOOD_LABELS = {"PERSON", "DATE", "GPE", "ORG", "NORP"}

# ---------- Question generation ----------
def generate_question(sentence, answer):
    highlighted = sentence.replace(answer, f"<hl> {answer} <hl>")
    input_text = f"generate question: {highlighted}"
    inputs = qg_tokenizer.encode(input_text, return_tensors="pt")
    outputs = qg_model.generate(inputs, max_length=64)
    return qg_tokenizer.decode(outputs[0], skip_special_tokens=True)

# ---------- Smart distractor generation ----------
def get_smart_distractors(answer, candidate_pool, n=3):
    candidates = [c for c in candidate_pool if c.lower() != answer.lower()]
    if not candidates:
        return []
    answer_embedding = embed_model.encode(answer, convert_to_tensor=True)
    candidate_embeddings = embed_model.encode(candidates, convert_to_tensor=True)
    similarities = util.cos_sim(answer_embedding, candidate_embeddings)[0]
    scored = list(zip(candidates, similarities.tolist()))
    scored.sort(key=lambda x: x[1], reverse=True)
    return [c for c, score in scored[:n]]

# ---------- Noun phrase fallback (for technical/conceptual text) ----------
def get_noun_phrase_candidates(sent):
    """Extract meaningful multi-word noun phrases from a sentence, skipping pronouns/junk."""
    candidates = []
    for chunk in sent.noun_chunks:
        text = chunk.text.strip()
        # Skip pronouns (he, it, this...) and single common words
        if chunk.root.pos_ == "PRON":
            continue
        if len(text.split()) < 2:
            continue
        candidates.append(text)
    return candidates

# ---------- Main pipeline ----------
def build_quiz(text):
    doc = nlp(text)

    # Collect all named entities by label
    entities_by_label = {}
    for ent in doc.ents:
        if ent.label_ in GOOD_LABELS:
            entities_by_label.setdefault(ent.label_, set()).add(ent.text)

    # Collect all noun phrases across the whole document (fallback pool)
    all_noun_phrases = set()
    for sent in doc.sents:
        all_noun_phrases.update(get_noun_phrase_candidates(sent))

    mcqs = []

    for sent in doc.sents:
        sent_text = sent.text.strip()
        candidate_ents = [ent for ent in sent.ents if ent.label_ in GOOD_LABELS]

        if candidate_ents:
            # Case 1: sentence has named entities (person/date/place/etc.)
            answer_ent = random.choice(candidate_ents)
            answer_text = answer_ent.text
            pool = list(entities_by_label.get(answer_ent.label_, set()))
        else:
            # Case 2: no named entities — fall back to noun phrases
            np_candidates = get_noun_phrase_candidates(sent)
            if not np_candidates:
                continue
            answer_text = random.choice(np_candidates)
            pool = list(all_noun_phrases)

        question_text = generate_question(sent_text, answer_text)
        distractors = get_smart_distractors(answer_text, pool)

        if len(distractors) < 2:
            continue

        options = distractors + [answer_text]
        random.shuffle(options)

        mcqs.append({
            "question": question_text,
            "options": options,
            "answer": answer_text
        })

    return mcqs


if __name__ == "__main__":
    text = """
    Albert Einstein developed the theory of relativity in 1905.
    He was born in Ulm, Germany, in 1879.
    Isaac Newton formulated the laws of motion in 1687.
    Marie Curie discovered radium in 1898.
    Charles Darwin published On the Origin of Species in 1859.
    Nikola Tesla invented the AC induction motor in 1887.
    """

    quiz = build_quiz(text)
    doc_id = save_document(text)
    print(f"Saved document with ID: {doc_id}\n")

    print("=== Final AI-Generated Quiz (saved to DB) ===\n")
    for i, q in enumerate(quiz, 1):
        q_id = save_question(
            document_id=doc_id,
            question_text=q["question"],
            question_type="MCQ",
            correct_answer=q["answer"],
            options=q["options"]
        )
        print(f"Q{i} (saved as ID {q_id}): {q['question']}")
        for idx, opt in enumerate(q['options'], 1):
            marker = " (correct)" if opt == q['answer'] else ""
            print(f"   {idx}. {opt}{marker}")
        print("-" * 50)

    print(f"\nAll {len(quiz)} questions saved to database successfully!")