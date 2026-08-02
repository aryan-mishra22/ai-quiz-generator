from transformers import T5ForConditionalGeneration, T5Tokenizer

print("Loading model... (this downloads ~850MB the first time, be patient)")

model_name = "valhalla/t5-base-qg-hl"
tokenizer = T5Tokenizer.from_pretrained(model_name)
model = T5ForConditionalGeneration.from_pretrained(model_name)

print("Model loaded!\n")

def generate_question(sentence, answer):
    # Highlight the answer in the sentence using <hl> tags — this tells the model what to ask about
    highlighted = sentence.replace(answer, f"<hl> {answer} <hl>")
    input_text = f"generate question: {highlighted}"

    inputs = tokenizer.encode(input_text, return_tensors="pt")
    outputs = model.generate(inputs, max_length=64)
    question = tokenizer.decode(outputs[0], skip_special_tokens=True)
    return question

# Test it with one of our known sentence/answer pairs
sentence = "Albert Einstein developed the theory of relativity in 1905."
answer = "1905"

question = generate_question(sentence, answer)

print(f"Sentence: {sentence}")
print(f"Answer: {answer}")
print(f"Generated Question: {question}")    