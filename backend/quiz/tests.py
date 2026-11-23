from io import BytesIO
from importlib import import_module
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from pypdf import PdfWriter
from rest_framework.test import APIClient

from .chunking import Sentence, chunk_sentences
from .models import AttemptAnswer, Document, DocumentChunk, Option, Question, QuizAttempt
from .pdf_processing import (
    NO_TEXT_ERROR,
    ExtractedPage,
    PDFExtraction,
    clean_extracted_pages,
    extract_pdf,
)


class QuizAttemptApiTests(TestCase):
    def test_ai_models_are_initialized_lazily(self):
        pipeline = import_module('quiz.full_pipeline')

        self.assertEqual(pipeline._load_models.cache_info().currsize, 0)

    def setUp(self):
        self.user = User.objects.create_user(username='learner@example.com', password='password123')
        self.other_user = User.objects.create_user(username='other@example.com', password='password123')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.document = Document.objects.create(
            owner=self.user,
            name='Study notes',
            content='Source material',
        )
        self.question = Question.objects.create(
            document=self.document,
            question_text='Which answer is correct?',
            question_type='MCQ',
            correct_answer='Correct',
            topic='Biology',
            explanation='The source identifies the correct option.',
        )
        self.correct_option = Option.objects.create(
            question=self.question,
            option_text='Correct',
            is_correct=True,
        )
        Option.objects.create(
            question=self.question,
            option_text='Incorrect',
            is_correct=False,
        )

    def test_attempt_endpoints_require_login(self):
        client = APIClient()
        for method, url, data in (
            (client.get, '/api/attempts/', None),
            (client.post, '/api/attempts/', {'document_id': self.document.id}),
            (client.get, '/api/attempts/1/', None),
            (client.post, '/api/attempts/1/submit/', {'answers': []}),
            (client.get, '/api/documents/', None),
            (client.post, '/api/generate-quiz/', {},),
            (client.post, '/api/upload-document/', {},),
            (client.delete, f'/api/documents/{self.document.id}/', None),
        ):
            response = method(url, data, format='json') if data is not None else method(url)
            self.assertIn(response.status_code, (401, 403))

    def test_documents_and_document_actions_are_scoped_to_the_owner(self):
        other_document = Document.objects.create(
            owner=self.other_user,
            name='Other learner notes',
            content='Private source material',
        )
        legacy_document = Document.objects.create(
            name='Unassigned legacy notes',
            content='Legacy source material',
        )
        self.assertEqual(
            [document['id'] for document in self.client.get('/api/documents/').data],
            [self.document.id],
        )

        other_client = APIClient()
        other_client.force_authenticate(user=self.other_user)
        self.assertEqual(
            [document['id'] for document in other_client.get('/api/documents/').data],
            [other_document.id],
        )
        self.assertEqual(
            other_client.post(
                '/api/attempts/',
                {'document_id': self.document.id},
                format='json',
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.post(
                '/api/attempts/',
                {'document_id': legacy_document.id},
                format='json',
            ).status_code,
            404,
        )
        self.assertEqual(
            other_client.delete(f'/api/documents/{self.document.id}/').status_code,
            404,
        )

    def test_start_and_submit_attempt_persist_answers_and_server_score(self):
        start = self.client.post(
            '/api/attempts/',
            {'document_id': self.document.id},
            format='json',
        )

        self.assertEqual(start.status_code, 201)
        self.assertEqual(start.data['questions'][0]['topic'], 'Biology')
        self.assertNotIn('correct_option_ids', start.data['questions'][0])
        self.assertNotIn('correct_answer', start.data['questions'][0])
        self.assertNotIn('is_correct', start.data['questions'][0]['options'][0])

        attempt_id = start.data['id']
        submit = self.client.post(
            f'/api/attempts/{attempt_id}/submit/',
            {
                'answers': [{
                    'question_id': self.question.id,
                    'selected_option_ids': [self.correct_option.id],
                }],
            },
            format='json',
        )

        self.assertEqual(submit.status_code, 200)
        self.assertEqual(submit.data['score'], 100)
        result = submit.data['questions'][0]
        self.assertTrue(result['is_correct'])
        self.assertEqual(result['correct_option_ids'], [self.correct_option.id])
        self.assertEqual(result['explanation'], 'The source identifies the correct option.')
        self.assertEqual(AttemptAnswer.objects.filter(attempt_id=attempt_id).count(), 1)
        self.assertEqual(
            list(AttemptAnswer.objects.get(attempt_id=attempt_id).selected_options.all()),
            [self.correct_option],
        )

    def test_another_user_cannot_list_or_read_attempt(self):
        attempt = QuizAttempt.objects.create(user=self.user, document=self.document)
        other_client = APIClient()
        other_client.force_authenticate(user=self.other_user)

        self.assertEqual(other_client.get('/api/attempts/').data, [])
        self.assertEqual(other_client.get(f'/api/attempts/{attempt.id}/').status_code, 404)
        self.assertEqual(
            other_client.post(
                f'/api/attempts/{attempt.id}/submit/',
                {'answers': []},
                format='json',
            ).status_code,
            404,
        )

    def test_invalid_option_is_rejected_without_completing_attempt(self):
        other_question = Question.objects.create(
            document=self.document,
            question_text='Another question?',
            question_type='MCQ',
            correct_answer='Answer',
        )
        other_option = Option.objects.create(
            question=other_question,
            option_text='Answer',
            is_correct=True,
        )
        attempt = QuizAttempt.objects.create(user=self.user, document=self.document)

        response = self.client.post(
            f'/api/attempts/{attempt.id}/submit/',
            {
                'answers': [{
                    'question_id': self.question.id,
                    'selected_option_ids': [other_option.id],
                }],
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        attempt.refresh_from_db()
        self.assertIsNone(attempt.completed_at)

    def test_generated_quiz_responses_do_not_include_correct_answers(self):
        with patch(
            'quiz.views.build_quiz',
            return_value=[{
                'question': 'Which answer is correct?',
                'options': ['Correct', 'Incorrect'],
                'answer': 'Correct',
                'explanation': 'Source context.',
            }],
        ) as generate_quiz:
            response = self.client.post(
                '/api/generate-quiz/',
                {
                    'text': 'Source material.',
                    'title': 'Generated quiz',
                    'topic': 'Biology',
                    'question_count': 1,
                },
                format='json',
            )

        generate_quiz.assert_called_once_with('Source material.', max_questions=1)
        self.assertEqual(response.status_code, 200)
        question = response.data['questions'][0]
        self.assertEqual(question['topic'], 'Biology')
        self.assertNotIn('correct_answer', question)
        self.assertNotIn('is_correct', question['options'][0])

        listed = self.client.get('/api/documents/')
        listed_question = listed.data[0]['questions'][0]
        self.assertNotIn('correct_answer', listed_question)
        self.assertNotIn('is_correct', listed_question['options'][0])

    def test_quiz_generation_stops_after_requested_question_count(self):
        from . import full_pipeline

        class FakeSentence:
            def __init__(self, text):
                self.text = text
                self.ents = []

        class FakeDocument:
            ents = []
            sents = [FakeSentence('First topic'), FakeSentence('Second topic'), FakeSentence('Third topic')]

        with (
            patch.object(full_pipeline, '_load_models', return_value=(lambda text: FakeDocument(), None, None, None)),
            patch.object(full_pipeline, 'get_noun_phrase_candidates', side_effect=lambda sentence: [sentence.text]),
            patch.object(full_pipeline, 'generate_question', return_value='Generated question?') as generate_question,
            patch.object(full_pipeline, 'get_smart_distractors', return_value=['Distractor A', 'Distractor B']),
        ):
            quiz = full_pipeline.build_quiz('Study material', max_questions=2)

        self.assertEqual(len(quiz), 2)
        self.assertEqual(generate_question.call_count, 2)

    def test_generation_failure_returns_a_friendly_error(self):
        with patch('quiz.views.build_quiz', side_effect=RuntimeError('model details')):
            with self.assertLogs('quiz.views', level='ERROR'):
                response = self.client.post(
                    '/api/generate-quiz/',
                    {'text': 'Source material.'},
                    format='json',
                )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            response.data['error'],
            'Quiz generation is temporarily unavailable. Please try again later.',
        )
        self.assertNotIn('model details', response.data['error'])

    def test_pdf_upload_returns_before_background_processing(self):
        pdf = SimpleUploadedFile('notes.pdf', b'PDF test bytes', content_type='application/pdf')
        with patch('quiz.views.start_document_processing') as start_processing:
            response = self.client.post(
                '/api/upload-document/',
                {'file': pdf},
                format='multipart',
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['processing_status'], Document.ProcessingStatus.PROCESSING)
        start_processing.assert_called_once()
        document_id, pdf_bytes = start_processing.call_args.args
        self.assertEqual(Document.objects.get(id=document_id).processing_status, Document.ProcessingStatus.PROCESSING)
        self.assertEqual(pdf_bytes, b'PDF test bytes')

    def test_bad_pdf_returns_a_friendly_error(self):
        pdf = SimpleUploadedFile('broken.pdf', b'not a PDF', content_type='application/pdf')
        response = self.client.post(
            '/api/upload-document/',
            {'file': pdf},
            format='multipart',
        )

        self.assertEqual(response.status_code, 201)
        document = Document.objects.get(id=response.data['id'])
        document.refresh_from_db()
        self.assertEqual(document.processing_status, Document.ProcessingStatus.FAILED)
        self.assertIn('could not be read', document.processing_error)
        self.assertEqual(DocumentChunk.objects.filter(document=document).count(), 0)

    def test_scanned_pdf_is_saved_as_failed_with_a_clear_message(self):
        writer = PdfWriter()
        writer.add_blank_page(width=612, height=792)
        output = BytesIO()
        writer.write(output)
        pdf = SimpleUploadedFile('scanned.pdf', output.getvalue(), content_type='application/pdf')

        response = self.client.post(
            '/api/upload-document/',
            {'file': pdf},
            format='multipart',
        )

        self.assertEqual(response.status_code, 201)
        document = Document.objects.get(id=response.data['id'])
        self.assertEqual(document.processing_status, Document.ProcessingStatus.FAILED)
        self.assertEqual(document.processing_error, NO_TEXT_ERROR)
        self.assertEqual(document.extracted_pages[0]['page_number'], 1)
        self.assertEqual(document.extracted_pages[0]['original_text'], '')
        self.assertFalse(document.content)
        self.assertEqual(DocumentChunk.objects.filter(document=document).count(), 0)

    def test_pdf_upload_saves_original_page_text_and_removal_report(self):
        removal_report = [{
            'pattern': 'repeated header',
            'occurrences': 3,
            'page_count': 3,
            'pages': [1, 2, 3],
            'positions': ['top'],
            'lines': [{'line': 'Repeated header', 'occurrences': 3, 'pages': [1, 2, 3]}],
        }]
        extraction = PDFExtraction(
            pages=[ExtractedPage(1, 'Repeated header\nSource sentence.', 'Source sentence.')],
            removal_report=removal_report,
        )
        pdf = SimpleUploadedFile('notes.pdf', b'PDF test bytes', content_type='application/pdf')
        with patch('quiz.views.extract_pdf', return_value=extraction), patch(
            'quiz.views.rebuild_document_chunks',
            return_value=1,
        ) as rebuild_chunks:
            response = self.client.post(
                '/api/upload-document/',
                {'file': pdf},
                format='multipart',
            )

        self.assertEqual(response.status_code, 201)
        document = Document.objects.get(id=response.data['id'])
        self.assertEqual(document.processing_status, Document.ProcessingStatus.READY)
        self.assertEqual(document.content, 'Source sentence.')
        self.assertEqual(document.extracted_pages[0]['page_number'], 1)
        self.assertEqual(document.extracted_pages[0]['original_text'], 'Repeated header\nSource sentence.')
        self.assertEqual(document.extraction_report, removal_report)
        rebuild_chunks.assert_called_once_with(document)

    def test_repeated_edge_lines_are_removed_and_known_hyphenated_words_join(self):
        raw_pages = [
            'COMMON HEADER\n1 / 4\nThis complete sentence remains.\nA trans-\nnational paragraph continues.\n\nA second paragraph.',
            'COMMON HEADER\n2 / 4\nThis complete sentence remains.\nA trans-\nnational paragraph continues.\n\nA second paragraph.',
            'COMMON HEADER\n3 / 4\nThis complete sentence remains.\nA trans-\nnational paragraph continues.\n\nA second paragraph.',
            'Unique heading\n4 / 4\nThis complete sentence remains.\nA trans-\nnational paragraph continues.\n\nA second paragraph.',
        ]

        pages, report = clean_extracted_pages(raw_pages)

        self.assertEqual(pages[0].page_number, 1)
        self.assertIn('This complete sentence remains.', pages[0].cleaned_text)
        self.assertIn('A transnational paragraph continues.', pages[0].cleaned_text)
        self.assertIn('\n\nA second paragraph.', pages[0].cleaned_text)
        self.assertNotIn('COMMON HEADER', pages[0].cleaned_text)
        self.assertNotIn('3 / 4', pages[2].cleaned_text)
        self.assertEqual(sum(item['occurrences'] for item in report), 7)
        self.assertTrue(all('sentence remains.' not in item['pattern'] for item in report))

    def test_unique_page_edge_text_is_not_removed(self):
        pages, report = clean_extracted_pages([
            'First page title\nThe page text is readable.',
            'Second page title\nThe page text is readable.',
        ])

        self.assertEqual(report, [])
        self.assertIn('First page title', pages[0].cleaned_text)
        self.assertIn('Second page title', pages[1].cleaned_text)

    def test_hard_line_breaks_merge_without_removing_paragraph_breaks(self):
        pages, _ = clean_extracted_pages([
            'A line ending in\ncontinuing words.\n\nA separate paragraph.',
        ])

        self.assertIn('A line ending in continuing words.', pages[0].cleaned_text)
        self.assertIn('\n\nA separate paragraph.', pages[0].cleaned_text)

    def test_chunks_respect_word_and_page_limits_with_sentence_overlap(self):
        sentences = [
            Sentence(page_number=1, text=f'Sentence {index}.', word_count=40)
            for index in range(1, 3)
        ] + [
            Sentence(page_number=2, text='Third sentence.', word_count=40),
            Sentence(page_number=3, text='Fourth sentence.', word_count=40),
        ]

        chunks = chunk_sentences(
            sentences,
            word_limit=100,
            overlap_words=40,
            max_page_span=2,
        )

        self.assertEqual([chunk['position'] for chunk in chunks], [1, 2, 3])
        self.assertEqual(chunks[0]['text'].splitlines()[-1], chunks[1]['text'].splitlines()[0])
        self.assertTrue(all(chunk['end_page'] - chunk['start_page'] + 1 <= 2 for chunk in chunks))
        self.assertEqual((chunks[0]['start_page'], chunks[0]['end_page']), (1, 1))

    def test_document_with_attempts_cannot_be_deleted(self):
        QuizAttempt.objects.create(user=self.user, document=self.document)

        response = self.client.delete(f'/api/documents/{self.document.id}/')

        self.assertEqual(response.status_code, 409)
        self.assertTrue(Document.objects.filter(id=self.document.id).exists())
