from django.db import models


class Campaign(models.Model):
    name = models.CharField(max_length=255)
    query = models.TextField()
    product_context = models.TextField(blank=True)
    tone = models.CharField(max_length=20, choices=[('formal', 'Formal'), ('casual', 'Casual'), ('technical', 'Technical')], default='casual')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Prospect(models.Model):
    INTENT_CHOICES = [('high', 'High'), ('medium', 'Medium'), ('low', 'Low')]
    STATUS_CHOICES = [('draft', 'Draft'), ('sent', 'Sent'), ('replied', 'Replied')]

    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name='prospects')
    name = models.CharField(max_length=255)
    title = models.CharField(max_length=255, blank=True)
    company = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    linkedin_url = models.URLField(blank=True)
    location = models.CharField(max_length=255, blank=True)
    employment_history = models.JSONField(default=list)
    skills = models.JSONField(default=list)
    intent = models.CharField(max_length=10, choices=INTENT_CHOICES, default='low')
    intent_signal = models.TextField(blank=True)
    intent_quote = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='draft')
    raw_data = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} @ {self.company}"


class Email(models.Model):
    prospect = models.ForeignKey(Prospect, on_delete=models.CASCADE, related_name='emails')
    sequence_number = models.IntegerField(default=1)
    subject = models.CharField(max_length=500, blank=True)
    body = models.TextField()
    scheduled_day = models.IntegerField(default=0)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['sequence_number']

    def __str__(self):
        return f"Email {self.sequence_number} → {self.prospect.name}"
