from rest_framework import serializers
from .models import Document, Question, Option

class OptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Option
        fields = ['id', 'option_text']


class QuestionSerializer(serializers.ModelSerializer):
    options = OptionSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ['id', 'question_text', 'question_type', 'topic', 'options']


class DocumentSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)

    class Meta:
        model = Document
        fields = [
            'id',
            'content',
            'name',
            'size',
            'page_count',
            'created_at',
            'questions',
            'processing_status',
            'processing_error',
            'extraction_report',
        ]