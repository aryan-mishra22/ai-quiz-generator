from django.db import models
from django.conf import settings

class Document(models.Model):
    class ProcessingStatus(models.TextChoices):
        PROCESSING = 'processing', 'Processing'
        READY = 'ready', 'Ready'
        FAILED = 'failed', 'Failed'

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='documents',
        null=True,
        blank=True,
    )
    content = models.TextField()
    name = models.CharField(max_length=255, blank=True, default='')
    size = models.PositiveIntegerField(default=0)
    page_count = models.PositiveIntegerField(default=0)
    extracted_pages = models.JSONField(default=list, blank=True)
    extraction_report = models.JSONField(default=list, blank=True)
    processing_status = models.CharField(
        max_length=16,
        choices=ProcessingStatus.choices,
        default=ProcessingStatus.READY,
    )
    processing_error = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.content[:50]


class DocumentChunk(models.Model):
    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name='chunks',
    )
    start_page = models.PositiveIntegerField()
    end_page = models.PositiveIntegerField()
    position = models.PositiveIntegerField()
    text = models.TextField()
    topic = models.CharField(max_length=255, blank=True, default='')

    class Meta:
        ordering = ['position']
        constraints = [
            models.UniqueConstraint(
                fields=('document', 'position'),
                name='unique_document_chunk_position',
            ),
        ]

    def __str__(self):
        return f'Chunk {self.position} from document {self.document_id}'


class Question(models.Model):
    QUESTION_TYPES = [
        ('MCQ', 'Multiple Choice'),
        ('TRUE_FALSE', 'True/False'),
        ('SHORT_ANSWER', 'Short Answer'),
    ]

    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='questions')
    question_text = models.TextField()
    question_type = models.CharField(max_length=20, choices=QUESTION_TYPES)
    correct_answer = models.TextField()
    topic = models.CharField(max_length=255, blank=True, default='')
    explanation = models.TextField(blank=True, default='')

    def __str__(self):
        return self.question_text[:50]


class Option(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='options')
    option_text = models.TextField()
    is_correct = models.BooleanField(default=False)

    def __str__(self):
        return self.option_text


class QuizAttempt(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='quiz_attempts',
    )
    document = models.ForeignKey(
        Document,
        on_delete=models.PROTECT,
        related_name='attempts',
    )
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    score = models.PositiveSmallIntegerField(null=True, blank=True)

    def __str__(self):
        return f'{self.user} - {self.document}'


class AttemptAnswer(models.Model):
    attempt = models.ForeignKey(
        QuizAttempt,
        on_delete=models.CASCADE,
        related_name='answers',
    )
    question = models.ForeignKey(
        Question,
        on_delete=models.PROTECT,
        related_name='attempt_answers',
    )
    selected_options = models.ManyToManyField(
        Option,
        blank=True,
        related_name='attempt_answers',
    )
    is_correct = models.BooleanField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=('attempt', 'question'),
                name='unique_attempt_question_answer',
            ),
        ]

    def __str__(self):
        return f'Answer to {self.question_id} in attempt {self.attempt_id}'