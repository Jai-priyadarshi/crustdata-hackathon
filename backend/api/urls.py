from django.urls import path
from . import views

urlpatterns = [
    path('campaigns/', views.CampaignListView.as_view()),
    path('campaigns/run/', views.RunCampaignView.as_view()),
    path('campaigns/<int:pk>/', views.CampaignDetailView.as_view()),
    path('campaigns/<int:campaign_id>/prospects/', views.ProspectListView.as_view()),
    path('prospects/<int:pk>/', views.ProspectDetailView.as_view()),
    path('prospects/<int:prospect_id>/regenerate-emails/', views.RegenerateEmailView.as_view()),
    path('emails/<int:pk>/', views.EmailDetailView.as_view()),
    path('emails/<int:email_id>/send/', views.SendEmailView.as_view()),
    path('scrape-url/', views.ScrapeUrlView.as_view()),
    path('campaigns/<int:campaign_id>/schedule/', views.ScheduleCampaignView.as_view()),
    path('campaigns/<int:campaign_id>/cancel-schedule/', views.CancelCampaignScheduleView.as_view()),
    path('prospects/<int:prospect_id>/cancel-schedule/', views.CancelScheduleView.as_view()),
]
