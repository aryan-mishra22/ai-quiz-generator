import spacy

nlp = spacy.load("en_core_web_sm")
doc = nlp("Albert Einstein developed the theory of relativity in 1905.")

for ent in doc.ents:
    print(ent.text, "-", ent.label_)