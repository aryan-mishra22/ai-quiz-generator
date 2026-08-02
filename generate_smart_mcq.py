from sentence_transformers import SentenceTransformer, util

print("Loading embedding model...")
model = SentenceTransformer('all-MiniLM-L6-v2')
print("Model loaded!\n")

def get_smart_distractors(answer, candidate_pool, n=3):
    """
    Given the correct answer and a pool of candidate words,
    return the n most semantically SIMILAR (but not identical) ones.
    """
    # Remove the correct answer itself from the pool
    candidates = [c for c in candidate_pool if c.lower() != answer.lower()]

    if not candidates:
        return []

    # Encode everything into embeddings (numeric meaning-vectors)
    answer_embedding = model.encode(answer, convert_to_tensor=True)
    candidate_embeddings = model.encode(candidates, convert_to_tensor=True)

    # Compute similarity scores between answer and each candidate
    similarities = util.cos_sim(answer_embedding, candidate_embeddings)[0]

    # Pair each candidate with its similarity score, sort by most similar
    scored = list(zip(candidates, similarities.tolist()))
    scored.sort(key=lambda x: x[1], reverse=True)

    return [c for c, score in scored[:n]]


# --- Test it ---
answer = "Albert Einstein"

# A pool of candidate names — imagine this came from a bigger document or a predefined list
candidate_pool = [
    "Isaac Newton", "Niels Bohr", "Max Planck", "Marie Curie",
    "Nikola Tesla", "Charles Darwin", "Leonardo da Vinci", "banana", "Paris"
]

distractors = get_smart_distractors(answer, candidate_pool)

print(f"Correct answer: {answer}")
print(f"Smart distractors: {distractors}")