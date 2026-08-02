import spacy

nlp = spacy.load("en_core_web_sm")

text = """
Albert Einstein developed the theory of relativity in 1905. 
He was born in Ulm, Germany, in 1879. 
Einstein won the Nobel Prize in Physics in 1921. 
He is widely regarded as one of the greatest physicists of all time. 
In 1933, Einstein moved to the United States to escape Nazi persecution.
"""

doc = nlp(text)

print("=== Sentences with entities (quiz candidates) ===\n")

for sent in doc.sents:
    ents = [(ent.text, ent.label_) for ent in sent.ents]
    if ents:  # only keep sentences that have at least one entity
        print(f"Sentence: {sent.text.strip()}")
        print(f"Entities: {ents}")
        print("-" * 50)