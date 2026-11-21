from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('api/auth/csrf/', views.csrf_api, name='auth_csrf'),
    path('api/auth/signup/', views.signup_api, name='auth_signup'),
    path('api/auth/login/', views.login_api, name='auth_login'),
    path('api/auth/logout/', views.logout_api, name='auth_logout'),
    path('api/auth/me/', views.current_user_api, name='auth_me'),
    path('api/generate-quiz/', views.generate_quiz_api, name='generate_quiz_api'),
    path('api/upload-document/', views.upload_document_api, name='upload_document_api'),
    path('api/documents/<int:document_id>/', views.delete_document_api, name='delete_document_api'),
    path('api/documents/', views.list_documents_api, name='list_documents_api'),
]