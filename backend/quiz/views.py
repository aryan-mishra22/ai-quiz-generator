import logging
import threading
import os
from io import BytesIO

from django.db import transaction
from django.conf import settings
from django.db.models.deletion import ProtectedError
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.middleware.csrf import get_token
import re
from rest_framework.decorators import api_view
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import permission_classes
from rest_framework.response import Response
from rest_framework import status
from .chunking import rebuild_document_chunks
from .models import AttemptAnswer, Document, Option, Question, QuizAttempt
from .pdf_processing import PDFExtraction, extract_pdf
from .serializers import DocumentSerializer

logger = logging.getLogger(__name__)


def build_quiz(text, max_questions=None):
    from .full_pipeline import build_quiz as generate_quiz
    return generate_quiz(text, max_questions=max_questions)


def save_pdf_extraction(document, extraction):
    document.content = extraction.cleaned_text
    document.extracted_pages = extraction.page_data()
    document.extraction_report = extraction.removal_report
    document.page_count = extraction.page_count
    document.processing_status = (
        Document.ProcessingStatus.FAILED if extraction.error else Document.ProcessingStatus.READY
    )
    document.processing_error = extraction.error
    document.save(update_fields=[
        'content',
        'extracted_pages',
        'extraction_report',
        'page_count',
        'processing_status',
        'processing_error',
    ])
    if not extraction.error and not rebuild_document_chunks(document):
        document.processing_status = Document.ProcessingStatus.FAILED
        document.processing_error = 'No readable sentences could be extracted.'
        document.save(update_fields=['processing_status', 'processing_error'])


def process_document_in_background(document_id, pdf_bytes):
    try:
        document = Document.objects.filter(id=document_id).first()
        if not document:
            return
        extraction = extract_pdf(BytesIO(pdf_bytes))
        save_pdf_extraction(document, extraction)
    except Exception:
        logger.exception('Background PDF processing failed for document %s', document_id)
        document = Document.objects.filter(id=document_id).first()
        if document:
            document.processing_status = Document.ProcessingStatus.FAILED
            document.processing_error = 'The PDF could not be processed. Please upload it again.'
            document.save(update_fields=['processing_status', 'processing_error'])


def start_document_processing(document_id, pdf_bytes):
    if (
        getattr(settings, 'DJANGO_DISABLE_BACKGROUND_WORKERS', False)
        or os.environ.get('DJANGO_DISABLE_BACKGROUND_WORKERS', '').lower() == 'true'
    ):
        process_document_in_background(document_id, pdf_bytes)
        return
    worker = threading.Thread(
        target=process_document_in_background,
        args=(document_id, pdf_bytes),
        daemon=True,
        name=f'pdf-document-{document_id}',
    )
    worker.start()


def option_data(option):
    return {"id": option.id, "option_text": option.option_text}


def attempt_data(attempt):
    questions = list(attempt.document.questions.prefetch_related('options').all())
    answers_by_question = {
        answer.question_id: answer
        for answer in attempt.answers.prefetch_related('selected_options').all()
    }
    data = {
        "id": attempt.id,
        "document_id": attempt.document_id,
        "title": attempt.document.name or "Study quiz",
        "started_at": attempt.started_at,
        "completed_at": attempt.completed_at,
        "score": attempt.score,
        "questions": [],
    }

    for question in questions:
        options = list(question.options.all())
        answer = answers_by_question.get(question.id)
        question_data = {
            "id": question.id,
            "question_text": question.question_text,
            "question_type": question.question_type,
            "topic": question.topic,
            "options": [option_data(option) for option in options],
            "selected_option_ids": (
                list(answer.selected_options.values_list('id', flat=True))
                if answer else []
            ),
        }
        if attempt.completed_at and answer:
            correct_options = [option for option in options if option.is_correct]
            question_data.update({
                "correct_option_ids": [option.id for option in correct_options],
                "is_correct": answer.is_correct,
                "explanation": question.explanation or (
                    "The correct answer is "
                    + ", ".join(option.option_text for option in correct_options)
                    + "."
                ),
            })
        data["questions"].append(question_data)
    data["question_count"] = len(questions)
    if attempt.completed_at:
        data["correct_count"] = sum(
            question.get("is_correct", False)
            for question in data["questions"]
        )
    return data


def user_response(user):
    return {
        "id": user.id,
        "name": user.get_full_name() or user.username,
        "email": user.email,
        "username": user.username,
    }


@api_view(['GET'])
def csrf_api(request):
    get_token(request)
    return Response({"ok": True})


@api_view(['POST'])
def signup_api(request):
    name = str(request.data.get("name", "")).strip()
    email = str(request.data.get("email", "")).strip().lower()
    password = str(request.data.get("password", ""))

    if not name or not email or not password:
        return Response({"error": "Name, email, and password are required"}, status=400)
    if not re.fullmatch(r'[^\s@]+@gmail\.com', email):
        return Response({"error": "Email must end with @gmail.com"}, status=400)
    if len(password) < 8:
        return Response({"error": "Password must be at least 8 characters"}, status=400)
    if User.objects.filter(email=email).exists():
        return Response({"error": "An account with this email already exists"}, status=409)

    username = email
    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
        first_name=name,
    )
    login(request, user)
    return Response(user_response(user), status=201)


@api_view(['POST'])
def login_api(request):
    email = str(request.data.get("email", "")).strip().lower()
    password = str(request.data.get("password", ""))
    if not re.fullmatch(r'[^\s@]+@gmail\.com', email):
        return Response({"error": "Email must end with @gmail.com"}, status=400)
    user_record = User.objects.filter(email__iexact=email).first()
    username = user_record.username if user_record else email
    user = authenticate(request, username=username, password=password)
    if not user:
        return Response({"error": "Invalid email or password"}, status=401)
    login(request, user)
    return Response(user_response(user))


@api_view(['POST'])
def logout_api(request):
    logout(request)
    return Response({"ok": True})


@api_view(['GET'])
def current_user_api(request):
    if not request.user.is_authenticated:
        return Response({"error": "Not authenticated"}, status=401)
    return Response(user_response(request.user))


def index(request):
    quiz = None
    error = None

    if request.method == "POST":
        text = request.POST.get("text", "").strip()

        if not text:
            error = "Please paste some text first."
        else:
            try:
                quiz_data = build_quiz(text)
            except Exception:
                logger.exception("Quiz generation failed for the HTML endpoint.")
                quiz_data = []
                error = "Quiz generation is temporarily unavailable. Please try again later."

            if not error and not quiz_data:
                error = "Couldn't generate questions from this text — try a longer or more detailed paragraph."
            elif not error:
                document = Document.objects.create(
                    owner=request.user if request.user.is_authenticated else None,
                    content=text,
                )
                for q in quiz_data:
                    question = Question.objects.create(
                        document=document,
                        question_text=q["question"],
                        question_type="MCQ",
                        correct_answer=q["answer"],
                        topic=q.get("topic", ""),
                        explanation=q.get("explanation", ""),
                    )
                    for opt in q["options"]:
                        Option.objects.create(
                            question=question,
                            option_text=opt,
                            is_correct=(opt == q["answer"])
                        )
                quiz = quiz_data

    return render(request, "index.html", {"quiz": quiz, "error": error})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_quiz_api(request):
    text = str(request.data.get("text", "")).strip()
    uploaded_file = request.FILES.get("file")
    extraction = None

    if uploaded_file:
        if not uploaded_file.name.lower().endswith('.pdf'):
            return Response({"error": "Only PDF files are supported"}, status=400)
        if uploaded_file.size > 25 * 1024 * 1024:
            return Response({"error": "PDF files must be 25 MB or smaller"}, status=400)
        extraction = extract_pdf(uploaded_file)
        document = Document.objects.create(
            owner=request.user,
            name=uploaded_file.name,
            content='',
            size=uploaded_file.size,
            processing_status=Document.ProcessingStatus.PROCESSING,
        )
        save_pdf_extraction(document, extraction)
        if document.processing_status == Document.ProcessingStatus.FAILED:
            return Response(
                {"error": document.processing_error, "document_id": document.id},
                status=status.HTTP_400_BAD_REQUEST,
            )
        text = extraction.cleaned_text

    if not text:
        return Response({"error": "No text provided"}, status=400)

    try:
        max_questions = request.data.get("question_count")
        if max_questions is not None:
            max_questions = max(1, int(max_questions))
    except (TypeError, ValueError, OverflowError):
        max_questions = None

    try:
        quiz_data = build_quiz(text, max_questions=max_questions)
    except Exception:
        logger.exception("Quiz generation failed for document %s", request.data.get("title", ""))
        return Response(
            {"error": "Quiz generation is temporarily unavailable. Please try again later."},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    if not quiz_data:
        return Response({"error": "Could not generate questions from this text"}, status=400)

    question_count = min(max_questions, len(quiz_data)) if max_questions is not None else len(quiz_data)

    document_name = str(request.data.get("title", "")).strip() or str(request.data.get("topic", "")).strip()
    if uploaded_file:
        document_name = uploaded_file.name

    if extraction is None:
        document = Document.objects.create(
            owner=request.user,
            content=text,
            name=document_name,
        )
    else:
        document.name = document_name
        document.save(update_fields=['name'])
    topic = str(request.data.get("topic", "")).strip()[:255]
    quiz_data = quiz_data[:question_count]
    for q in quiz_data:
        question = Question.objects.create(
            document=document,
            question_text=q["question"],
            question_type="MCQ",
            correct_answer=q["answer"],
            topic=str(q.get("topic") or topic),
            explanation=q.get("explanation", ""),
        )
        for opt in q["options"]:
            Option.objects.create(
                question=question,
                option_text=opt,
                is_correct=(opt == q["answer"])
            )

    serializer = DocumentSerializer(document)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_document_api(request):
    uploaded_file = request.FILES.get("file")
    if not uploaded_file:
        return Response({"error": "No PDF provided"}, status=400)
    if not uploaded_file.name.lower().endswith('.pdf'):
        return Response({"error": "Only PDF files are supported"}, status=400)
    if uploaded_file.size > 25 * 1024 * 1024:
        return Response({"error": "PDF files must be 25 MB or smaller"}, status=400)

    document = Document.objects.create(
        owner=request.user,
        name=uploaded_file.name,
        content='',
        size=uploaded_file.size,
        processing_status=Document.ProcessingStatus.PROCESSING,
    )
    pdf_bytes = uploaded_file.read()
    start_document_processing(document.id, pdf_bytes)
    return Response(DocumentSerializer(document).data, status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_document_api(request, document_id):
    document = Document.objects.filter(id=document_id, owner=request.user).first()
    if not document:
        return Response({"error": "Document not found"}, status=404)
    try:
        document.delete()
    except ProtectedError:
        return Response(
            {"error": "This study set has saved quiz attempts and cannot be deleted."},
            status=status.HTTP_409_CONFLICT,
        )
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_documents_api(request):
    documents = Document.objects.filter(owner=request.user).order_by('-created_at')
    serializer = DocumentSerializer(documents, many=True)
    return Response(serializer.data)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def attempts_api(request):
    if request.method == 'GET':
        attempts = (
            QuizAttempt.objects.filter(user=request.user)
            .select_related('document')
            .order_by('-started_at')
        )
        return Response([
            {
                "id": attempt.id,
                "document_id": attempt.document_id,
                "title": attempt.document.name or "Study quiz",
                "started_at": attempt.started_at,
                "completed_at": attempt.completed_at,
                "score": attempt.score,
                "question_count": attempt.document.questions.count(),
                "correct_count": attempt.answers.filter(is_correct=True).count(),
            }
            for attempt in attempts
        ])

    document_id = request.data.get("document_id")
    if not document_id:
        return Response({"error": "A document_id is required."}, status=status.HTTP_400_BAD_REQUEST)

    document = get_object_or_404(Document, pk=document_id, owner=request.user)
    if not document.questions.exists():
        return Response(
            {"error": "This study document does not have a quiz yet."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    attempt = QuizAttempt.objects.create(user=request.user, document=document)
    return Response(attempt_data(attempt), status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def submit_attempt_api(request, attempt_id):
    attempt = get_object_or_404(QuizAttempt, pk=attempt_id, user=request.user)
    if attempt.completed_at:
        return Response(
            {"error": "This attempt has already been submitted. Start a new attempt to try again."},
            status=status.HTTP_409_CONFLICT,
        )

    submitted_answers = request.data.get("answers")
    if not isinstance(submitted_answers, list):
        return Response(
            {"error": "Answers must be provided as a list."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    questions = list(attempt.document.questions.prefetch_related('options').all())
    questions_by_id = {question.id: question for question in questions}
    normalized_answers = {}
    for submitted_answer in submitted_answers:
        if not isinstance(submitted_answer, dict):
            return Response({"error": "Each answer must include a question_id."}, status=400)
        try:
            question_id = int(submitted_answer.get("question_id"))
        except (TypeError, ValueError):
            return Response({"error": "Each answer must include a valid question_id."}, status=400)
        if question_id not in questions_by_id:
            return Response({"error": "An answer references a question outside this attempt."}, status=400)
        if question_id in normalized_answers:
            return Response({"error": "Each question may be answered only once."}, status=400)

        selected_ids = submitted_answer.get("selected_option_ids", [])
        if not isinstance(selected_ids, list):
            return Response({"error": "selected_option_ids must be a list."}, status=400)
        try:
            selected_ids = {int(option_id) for option_id in selected_ids}
        except (TypeError, ValueError):
            return Response({"error": "Each selected option ID must be valid."}, status=400)

        question = questions_by_id[question_id]
        options_by_id = {option.id: option for option in question.options.all()}
        if not selected_ids.issubset(options_by_id):
            return Response(
                {"error": "An answer includes an option that does not belong to its question."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        normalized_answers[question_id] = [options_by_id[option_id] for option_id in selected_ids]

    correct_count = 0
    with transaction.atomic():
        for question in questions:
            selected_options = normalized_answers.get(question.id, [])
            correct_option_ids = {
                option.id for option in question.options.all() if option.is_correct
            }
            selected_option_ids = {option.id for option in selected_options}
            is_correct = bool(correct_option_ids) and selected_option_ids == correct_option_ids
            correct_count += int(is_correct)
            answer, _ = AttemptAnswer.objects.update_or_create(
                attempt=attempt,
                question=question,
                defaults={"is_correct": is_correct},
            )
            answer.selected_options.set(selected_options)

        attempt.score = int((correct_count * 100 / len(questions)) + 0.5)
        attempt.completed_at = timezone.now()
        attempt.save(update_fields=['score', 'completed_at'])

    return Response(attempt_data(attempt))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_attempt_api(request, attempt_id):
    attempt = get_object_or_404(QuizAttempt, pk=attempt_id, user=request.user)
    return Response(attempt_data(attempt))