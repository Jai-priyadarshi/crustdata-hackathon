from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):
        import os
        # Don't start scheduler in management commands or reloader child processes
        if os.environ.get('RUN_MAIN') == 'true' or os.environ.get('SCHEDULER_ENABLED') == '1':
            from apscheduler.schedulers.background import BackgroundScheduler
            from .jobs import send_scheduled_emails
            scheduler = BackgroundScheduler()
            scheduler.add_job(send_scheduled_emails, 'interval', seconds=30, id='send_emails', replace_existing=True)
            scheduler.start()
