import sys
import threading

from django.apps import AppConfig


class QuizConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'quiz'

    def ready(self):
        if 'runserver' not in sys.argv:
            return

        def warm_models():
            from .full_pipeline import _load_models
            _load_models()

        threading.Thread(target=warm_models, daemon=True, name='quiz-model-warmup').start()
