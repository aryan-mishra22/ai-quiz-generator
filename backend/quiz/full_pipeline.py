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

def generate_question(sentence, answer):
    highlighted = sentence.replace(answer, f"<hl> {answer} <hl>")
    input_text = f"generate question: {highlighted}"
    inputs = qg_tokenizer.encode(input_text, return_tensors="pt")
    outputs = qg_model.generate(inputs, max_length=64)
    return qg_tokenizer.decode(outputs[0], skip_special_tokens=True)

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

def get_noun_phrase_candidates(sent):
    candidates = []
    for chunk in sent.noun_chunks:
        text = chunk.text.strip()
        if chunk.root.pos_ == "PRON":
            continue
        if len(text.split()) < 2:
            continue
        candidates.append(text)
    return candidates

def build_quiz(text):
    doc = nlp(text)

    entities_by_label = {}
    for ent in doc.ents:
        if ent.label_ in GOOD_LABELS:
            entities_by_label.setdefault(ent.label_, set()).add(ent.text)

    all_noun_phrases = set()
    for sent in doc.sents:
        all_noun_phrases.update(get_noun_phrase_candidates(sent))

    mcqs = []

    for sent in doc.sents:
        sent_text = sent.text.strip()
        candidate_ents = [ent for ent in sent.ents if ent.label_ in GOOD_LABELS]

        if candidate_ents:
            answer_ent = random.choice(candidate_ents)
            answer_text = answer_ent.text
            pool = list(entities_by_label.get(answer_ent.label_, set()))
        else:
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
