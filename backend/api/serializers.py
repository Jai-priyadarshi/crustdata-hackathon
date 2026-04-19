from rest_framework import serializers
from .models import Campaign, Prospect, Email


class EmailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Email
        fields = '__all__'


class ProspectSerializer(serializers.ModelSerializer):
    emails = EmailSerializer(many=True, read_only=True)

    class Meta:
        model = Prospect
        fields = '__all__'


class CampaignSerializer(serializers.ModelSerializer):
    prospects = ProspectSerializer(many=True, read_only=True)
    prospect_count = serializers.SerializerMethodField()

    class Meta:
        model = Campaign
        fields = '__all__'

    def get_prospect_count(self, obj):
        return obj.prospects.count()
