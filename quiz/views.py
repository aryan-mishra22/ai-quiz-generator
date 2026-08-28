from django.shortcuts import render
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Document, Question, Option
from .serializers import DocumentSerializer
from .full_pipeline import build_quiz


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

    return render(request, "quiz/index.html", {"quiz": quiz, "error": error})


@api_view(['POST'])
def generate_quiz_api(request):
    text = request.data.get("text", "").strip()

    if not text:
        return Response({"error": "No text provided"}, status=400)

    quiz_data = build_quiz(text)

    if not quiz_data:
        return Response({"error": "Could not generate questions from this text"}, status=400)

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

    serializer = DocumentSerializer(document)
    return Response(serializer.data)


@api_view(['GET'])
def list_documents_api(request):
    documents = Document.objects.all().order_by('-created_at')
    serializer = DocumentSerializer(documents, many=True)
    return Response(serializer.data)