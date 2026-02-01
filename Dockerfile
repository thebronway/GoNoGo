# STAGE 1: Build React Frontend
FROM node:18 AS build-frontend
WORKDIR /frontend_build
COPY ./frontend/package.json ./frontend/package-lock.json* ./
RUN npm install
COPY ./frontend ./
RUN npm run build

# STAGE 2: Python Backend
FROM python:3.11-slim
WORKDIR /app

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Backend Code
COPY ./app ./app

# Copy Built Frontend from Stage 1
COPY --from=build-frontend /frontend_build/dist /app/static

# Run it
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "4642", "--workers", "5"]