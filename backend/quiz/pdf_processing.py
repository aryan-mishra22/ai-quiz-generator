import logging
import re
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass
from functools import lru_cache

from pypdf import PdfReader
from wordfreq import zipf_frequency

logger = logging.getLogger(__name__)

NO_TEXT_ERROR = "No readable text found. This looks like a scanned PDF."
MIN_EXTRACTED_WORDS = 20
EDGE_LINE_COUNT = 3

_NUMBER_RE = re.compile(r'\d+')
_SENTENCE_END_RE = re.compile(r'[.!?][\u2019\u201d"\'\)\]]*$')
_HYPHEN_END_RE = re.compile(r'(?P<prefix>.*?)(?P<word>[^\W\d_]+)[\-\u00ad\u2010\u2011\u2012\u2013\u2014]\s*$', re.UNICODE)
_WORD_START_RE = re.compile(r'^(?P<indent>\s*)(?P<word>[^\W\d_]+)(?P<suffix>.*)$', re.UNICODE)


@dataclass(frozen=True)
class ExtractedPage:
    page_number: int
    original_text: str
    cleaned_text: str


@dataclass(frozen=True)
class PDFExtraction:
    pages: list[ExtractedPage]
    removal_report: list[dict]
    error: str = ''

    @property
    def page_count(self):
        return len(self.pages)

    @property
    def original_text(self):
        return '\n\n'.join(page.original_text for page in self.pages)

    @property
    def cleaned_text(self):
        return '\n\n'.join(page.cleaned_text for page in self.pages)

    def page_data(self):
        return [
            {
                'page_number': page.page_number,
                'original_text': page.original_text,
                'cleaned_text': page.cleaned_text,
            }
            for page in self.pages
        ]


def _line_fingerprint(line):
    normalized = unicodedata.normalize('NFKC', line)
    normalized = re.sub(r'\s+', ' ', normalized).strip().casefold()
    return _NUMBER_RE.sub('<number>', normalized)


def _is_complete_sentence(line):
    return bool(_SENTENCE_END_RE.search(line.strip()))


def _is_prose_continuation(line):
    stripped = line.strip()
    return stripped[:1].islower() or stripped.endswith(
        ('-', '\u00ad', '\u2010', '\u2011', '\u2012', '\u2013', '\u2014')
    )


@lru_cache(maxsize=8192)
def _is_ordinary_word(word):
    return zipf_frequency(word.casefold(), 'en') > 0


def _edge_lines(lines):
    nonempty = [index for index, line in enumerate(lines) if line.strip()]
    if not nonempty:
        return {}
    edge = {}
    for index in nonempty[:EDGE_LINE_COUNT]:
        edge[index] = 'top'
    for index in nonempty[-EDGE_LINE_COUNT:]:
        edge[index] = 'bottom' if index not in edge else 'top and bottom'
    return edge


def _repeated_edge_lines(raw_pages):
    if len(raw_pages) < 2:
        return {}, []

    page_edges = []
    template_pages = defaultdict(dict)

    for page_number, text in enumerate(raw_pages, start=1):
        lines = text.splitlines()
        edges = _edge_lines(lines)
        edge_entries = []
        for line_index, position in edges.items():
            line = lines[line_index].strip()
            if (
                not line
                or len(line) > 240
                or _is_complete_sentence(line)
                or _is_prose_continuation(line)
            ):
                continue
            fingerprint = _line_fingerprint(line)
            edge_entries.append((line_index, line, fingerprint, position))
            template_pages[fingerprint].setdefault(page_number, []).append(
                (line_index, line, position)
            )
        page_edges.append(edge_entries)

    threshold = len(raw_pages) / 2
    repeated = {
        fingerprint: page_entries
        for fingerprint, page_entries in template_pages.items()
        if len(page_entries) > threshold
    }

    removed_indices = defaultdict(set)
    report = []
    for fingerprint, page_entries in repeated.items():
        removed_lines = defaultdict(list)
        positions = set()
        pages = []
        for page_number, entries in page_entries.items():
            pages.append(page_number)
            for line_index, line, position in entries:
                removed_indices[page_number].add(line_index)
                removed_lines[line].append(page_number)
                positions.add(position)

        report.append({
            'pattern': fingerprint,
            'occurrences': sum(len(page_numbers) for page_numbers in removed_lines.values()),
            'page_count': len(pages),
            'pages': sorted(pages),
            'positions': sorted(positions),
            'lines': [
                {'line': line, 'occurrences': len(page_numbers), 'pages': sorted(page_numbers)}
                for line, page_numbers in sorted(removed_lines.items())
            ],
        })

    report.sort(key=lambda item: (item['pages'][0], item['pattern']))
    return removed_indices, report


def _clean_page(text, removed_line_indices):
    cleaned_lines = []
    for line_index, raw_line in enumerate(text.splitlines()):
        if line_index in removed_line_indices:
            continue
        line = raw_line.rstrip()
        if not line.strip():
            if cleaned_lines and cleaned_lines[-1]:
                cleaned_lines.append('')
            continue

        if cleaned_lines and cleaned_lines[-1]:
            previous = cleaned_lines[-1]
            hyphen = _HYPHEN_END_RE.match(previous)
            next_word = _WORD_START_RE.match(line)
            if hyphen and next_word:
                joined_word = hyphen.group('word') + next_word.group('word')
                if _is_ordinary_word(joined_word):
                    cleaned_lines[-1] = (
                        hyphen.group('prefix')
                        + joined_word
                        + next_word.group('suffix')
                    )
                    continue
                if hyphen.group('word') and next_word.group('word'):
                    cleaned_lines.append(line)
                    continue

            if (
                previous[-1] not in '.!?;:'
                and line.lstrip()[:1].islower()
                and not previous.rstrip().endswith(('-', '\u2010', '\u2011', '\u2012', '\u2013', '\u2014'))
            ):
                cleaned_lines[-1] = f'{previous.rstrip()} {line.lstrip()}'
                continue

        cleaned_lines.append(line)

    return '\n'.join(cleaned_lines).strip()


def clean_extracted_pages(raw_pages):
    removed_indices, report = _repeated_edge_lines(raw_pages)
    pages = [
        ExtractedPage(
            page_number=page_number,
            original_text=original_text,
            cleaned_text=_clean_page(original_text, removed_indices.get(page_number, set())),
        )
        for page_number, original_text in enumerate(raw_pages, start=1)
    ]
    return pages, report


def extract_pdf(uploaded_file):
    try:
        uploaded_file.seek(0)
        reader = PdfReader(uploaded_file)
        if reader.is_encrypted:
            return PDFExtraction([], [], 'This PDF is password-protected. Upload an unlocked PDF.')
        raw_pages = [page.extract_text() or '' for page in reader.pages]
    except Exception:
        logger.exception('Could not extract text from PDF %s', getattr(uploaded_file, 'name', ''))
        return PDFExtraction([], [], 'The PDF could not be read. Check the file and try again.')

    pages, removal_report = clean_extracted_pages(raw_pages)
    word_count = sum(len(page.cleaned_text.split()) for page in pages)
    text_page_count = sum(bool(page.cleaned_text.strip()) for page in pages)
    too_few_text_pages = pages and text_page_count / len(pages) < 0.1
    error = NO_TEXT_ERROR if word_count < MIN_EXTRACTED_WORDS or too_few_text_pages else ''
    return PDFExtraction(pages, removal_report, error)
