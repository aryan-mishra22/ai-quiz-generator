from django.shortcuts import render
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.middleware.csrf import get_token
import re
from pypdf import PdfReader
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .models import Document, Question, Option
from .serializers import DocumentSerializer


def build_quiz(text):
    from .full_pipeline import build_quiz as generate_quiz
    return generate_quiz(text)


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
            quiz_data = build_quiz(text)

            if not quiz_data:
                error = "Couldn't generate questions from this text — try a longer or more detailed paragraph."
            else:
                document = Document.objects.create(content=text)
                for q in quiz_data:
                    question = Question.objects.create(
                        document=document,
                        question_text=q["question"],
                        question_type="MCQ",
                        correct_answer=q["answer"]
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
def generate_quiz_api(request):
    text = str(request.data.get("text", "")).strip()
    uploaded_file = request.FILES.get("file")
    page_count = 0

    if uploaded_file:
        if not uploaded_file.name.lower().endswith('.pdf'):
            return Response({"error": "Only PDF files are supported"}, status=400)
        if uploaded_file.size > 25 * 1024 * 1024:
            return Response({"error": "PDF files must be 25 MB or smaller"}, status=400)
        try:
            reader = PdfReader(uploaded_file)
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
            page_count = len(reader.pages)
        except Exception:
            return Response({"error": "The PDF could not be read"}, status=400)

    if not text:
        return Response({"error": "No text provided"}, status=400)

    quiz_data = build_quiz(text)

    if not quiz_data:
        return Response({"error": "Could not generate questions from this text"}, status=400)

    try:
        question_count = max(1, min(int(request.data.get("question_count", len(quiz_data))), len(quiz_data)))
    except (TypeError, ValueError):
        question_count = len(quiz_data)

    document_name = str(request.data.get("title", "")).strip() or str(request.data.get("topic", "")).strip()
    if uploaded_file:
        document_name = uploaded_file.name

    document = Document.objects.create(
        content=text,
        name=document_name,
        size=uploaded_file.size if uploaded_file else 0,
        page_count=page_count,
    )
    quiz_data = quiz_data[:question_count]
    for q in quiz_data:
        question = Question.objects.create(
            document=document,
            question_text=q["question"],
            question_type="MCQ",
            correct_answer=q["answer"]
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
def upload_document_api(request):
    uploaded_file = request.FILES.get("file")
    if not uploaded_file:
        return Response({"error": "No PDF provided"}, status=400)
    if not uploaded_file.name.lower().endswith('.pdf'):
        return Response({"error": "Only PDF files are supported"}, status=400)
    if uploaded_file.size > 25 * 1024 * 1024:
        return Response({"error": "PDF files must be 25 MB or smaller"}, status=400)

    try:
        reader = PdfReader(uploaded_file)
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
        page_count = len(reader.pages)
    except Exception:
        return Response({"error": "The PDF could not be read"}, status=400)

    document = Document.objects.create(
        content=text,
        name=uploaded_file.name,
        size=uploaded_file.size,
        page_count=page_count,
    )
    return Response(DocumentSerializer(document).data, status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
def delete_document_api(request, document_id):
    document = Document.objects.filter(id=document_id).first()
    if not document:
        return Response({"error": "Document not found"}, status=404)
    document.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
def list_documents_api(request):
    documents = Document.objects.all().order_by('-created_at')
    serializer = DocumentSerializer(documents, many=True)
    return Response(serializer.data)