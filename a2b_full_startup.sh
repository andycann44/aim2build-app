#!/bin/bash
set -euo pipefail

cd ~/aim2build-app

# Backend
cd backend
source ../.venv/bin/activate
pkill -f "uvicorn app.main:app" || true
nohup /home/ubuntu/aim2build-app/.venv/bin/python -m uvicorn app.main:app \
  --host 0.0.0.0 --port 8000 \
  > /tmp/aim2build-backend.log 2>&1 &
deactivate

# Frontend
cd ~/aim2build-app/frontend
npm run build
pkill -f "vite" || true
nohup npm run preview -- --host 0.0.0.0 --port 5173 \
  > /tmp/aim2build-frontend.log 2>&1 &
