from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('api/generate-quiz/', views.generate_quiz_api, name='generate_quiz_api'),
    path('api/documents/', views.list_documents_api, name='list_documents_api'),
]