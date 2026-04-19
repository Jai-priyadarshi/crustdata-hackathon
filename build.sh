#!/usr/bin/env bash
set -e

echo "--- Building frontend ---"
cd frontend
npm install
npm run build
cd ..

echo "--- Installing Python deps ---"
pip install -r backend/requirements.txt

echo "--- Copying frontend build ---"
rm -rf backend/frontend_build
cp -r frontend/dist backend/frontend_build

echo "--- Django setup ---"
cd backend
python manage.py collectstatic --no-input
python manage.py migrate
