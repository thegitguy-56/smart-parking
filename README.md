# Vision-Based Smart Parking System

A comprehensive, full-stack computer vision application designed to monitor parking lot occupancy, predict future availability, and recommend optimal parking slots in real-time. This project was built as a capstone project for the Computer Vision course at SIMATS Engineering.

## Overview

The system uses a camera feed of a parking lot to continuously detect whether individual parking slots are free or occupied. It utilizes a deep learning pipeline powered by MobileNetV2 for image classification, coupled with time-series forecasting using Facebook Prophet to predict future parking availability. The entire system is tied together with a high-performance FastAPI backend and a responsive, interactive React dashboard.

## Key Features

- **Live Occupancy Detection**: Uses a fine-tuned MobileNetV2 model (PyTorch) to classify parking slots as empty or occupied based on camera frames.
- **Predictive Forecasting**: Leverages Facebook Prophet to analyze historical occupancy logs and predict future slot availability up to 120 minutes in advance.
- **Intelligent Recommendations**: Calculates the optimal parking slot for a user by scoring available slots based on proximity to an entry point and their forecasted vacancy probability.
- **Interactive Dashboard**: A modern React frontend featuring a live annotated parking map, real-time KPI metrics, and occupancy trend charts.

## Technology Stack

**Backend**
- **Framework**: FastAPI (Python)
- **Machine Learning**: PyTorch (MobileNetV2), torchvision
- **Time-Series Forecasting**: Facebook Prophet
- **Computer Vision**: OpenCV
- **Database**: SQLite (WAL mode enabled for concurrency)

**Frontend**
- **Framework**: React, Vite
- **Styling**: Tailwind CSS
- **Visualization**: Recharts (Trends), React-Konva (Interactive Map)

## Repository Structure

- `backend/`
  - `api/`: FastAPI routing and application initialization.
  - `src/`: Core logic including the PyTorch detector, Prophet predictor, and SQLite database manager.
  - `data/`: Raw test frames, SQLite database, and the parking slot coordinate map (`slot_map.json`).
  - `models/`: Pre-trained MobileNetV2 model checkpoints and serialized Prophet models.
  - `Dockerfile`: Configuration for cloud deployment.
- `frontend/`
  - `src/`: React application source code, including API service layers and UI components.

## Local Setup

### 1. Backend

Navigate to the backend directory and install the requirements:

```bash
cd backend
conda create -n parking-env python=3.10
conda activate parking-env
pip install -r requirements.txt
```

Run the FastAPI server:

```bash
uvicorn api.main:app --reload --port 8000
```
The backend will be available at `http://localhost:8000`. You can view the API documentation at `http://localhost:8000/docs`.

### 2. Frontend

Navigate to the frontend directory, install the Node.js packages, and start the development server:

```bash
cd frontend
npm install
npm run dev
```
The dashboard will be available at `http://localhost:5173`. Ensure the backend is running so the dashboard can fetch live data.

## Deployment

This system is optimized for split cloud deployment:
- **Backend**: Containerized via Docker and deployed on **Hugging Face Spaces** (providing sufficient memory and CPU for PyTorch and Prophet).
- **Frontend**: Deployed on **Vercel** as a static Vite application. Set the `VITE_API_URL` environment variable in Vercel to point to the Hugging Face Space URL.

---

Built by Rohan and Himavath
