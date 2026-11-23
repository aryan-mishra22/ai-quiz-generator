from dataclasses import dataclass
from functools import lru_cache

from django.db import transaction

from .models import DocumentChunk

CHUNK_WORD_LIMIT = 300
CHUNK_OVERLAP_WORDS = 50
CHUNK_MAX_PAGE_SPAN = 3


@dataclass(frozen=True)
class Sentence:
    page_number: int
    text: str
    word_count: int


@lru_cache(maxsize=1)
def _load_sentence_model():
    import spacy

    return spacy.load('en_core_web_sm')


def extract_sentences(page_data):
    pages = list(page_data)
    if not pages:
        return []

    sentence_model = _load_sentence_model()
    sentences = []
    texts = (page.get('cleaned_text', '') for page in pages)
    for page, parsed_page in zip(pages, sentence_model.pipe(texts, batch_size=8)):
        for parsed_sentence in parsed_page.sents:
            text = parsed_sentence.text.strip()
            if text:
                sentences.append(Sentence(
                    page_number=int(page['page_number']),
                    text=text,
                    word_count=len(text.split()),
                ))
    return sentences


def _overlap_tail(sentences, word_limit):
    selected = []
    total_words = 0
    for sentence in reversed(sentences):
        if total_words + sentence.word_count > word_limit:
            break
        selected.append(sentence)
        total_words += sentence.word_count
    return list(reversed(selected))


def chunk_sentences(
    sentences,
    word_limit=CHUNK_WORD_LIMIT,
    overlap_words=CHUNK_OVERLAP_WORDS,
    max_page_span=CHUNK_MAX_PAGE_SPAN,
):
    chunks = []
    current = []
    current_words = 0

    for sentence in sentences:
        page_span_exceeded = (
            current
            and sentence.page_number - current[0].page_number + 1 > max_page_span
        )
        word_limit_exceeded = current and current_words + sentence.word_count > word_limit

        if page_span_exceeded or word_limit_exceeded:
            chunks.append(current)
            current = _overlap_tail(current, overlap_words)
            while current and (
                sentence.page_number - current[0].page_number + 1 > max_page_span
                or sum(item.word_count for item in current) + sentence.word_count > word_limit
            ):
                current.pop(0)
            current_words = sum(item.word_count for item in current)

        current.append(sentence)
        current_words += sentence.word_count

    if current:
        chunks.append(current)

    return [
        {
            'position': position,
            'start_page': chunk[0].page_number,
            'end_page': chunk[-1].page_number,
            'text': '\n'.join(sentence.text for sentence in chunk),
        }
        for position, chunk in enumerate(chunks, start=1)
    ]


def rebuild_document_chunks(document):
    sentences = extract_sentences(document.extracted_pages)
    chunks = chunk_sentences(sentences)
    with transaction.atomic():
        DocumentChunk.objects.filter(document=document).delete()
        DocumentChunk.objects.bulk_create([
            DocumentChunk(document=document, **chunk)
            for chunk in chunks
        ])
    return len(chunks)
