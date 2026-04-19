#!/bin/bash
# Start Django backend
source venv/bin/activate
cd backend && python manage.py runserver &
DJANGO_PID=$!

# Start React frontend
cd ../frontend && npm run dev &
VITE_PID=$!

echo "Backend running at http://localhost:8000"
echo "Frontend running at http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers"

trap "kill $DJANGO_PID $VITE_PID" EXIT
wait
