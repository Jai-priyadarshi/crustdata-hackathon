from django.contrib import admin
from django.urls import path, include, re_path
from django.http import FileResponse
from django.conf import settings
import os


def spa(request, path=''):
    index = os.path.join(settings.BASE_DIR, 'frontend_build', 'index.html')
    return FileResponse(open(index, 'rb'), content_type='text/html')


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
    re_path(r'^(?!static/|api/|admin/).*$', spa),
]
