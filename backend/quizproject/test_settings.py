from .settings import *
import os

os.environ['DJANGO_DISABLE_BACKGROUND_WORKERS'] = 'True'
DJANGO_DISABLE_BACKGROUND_WORKERS = True

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    },
}

PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']
