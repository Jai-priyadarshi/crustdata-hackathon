#!/usr/bin/env bash
set -e
cd backend
gunicorn backend.wsgi:application --workers 2 --bind 0.0.0.0:$PORT --timeout 120
