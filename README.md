# TeamFlow - Task Management Application

A MEAN stack app for teams to manage projects and tasks collaboratively.

## Features

- Create and manage projects
- Add tasks with title, description, priority, and due date
- Track status: To Do, In Progress, Done
- Filter tasks by project and status
- Project and task CRUD APIs with validation

## Tech Stack

- MongoDB + Mongoose
- Express.js + Node.js
- Angular 18

## Local End-to-End Setup

### 1. Install dependencies

From repository root:

	cd backend
	npm install
	cd ..\frontend
	npm install

### 2. Configure backend environment

Create backend/.env (or copy backend/.env.example):

	PORT=3000
	MONGODB_URI=mongodb://localhost:27017/teamflow
	CORS_ORIGINS=http://localhost:4200

### 3. Start backend

	cd backend
	npm start

Backend base URL:

	http://localhost:3000

Health check:

	http://localhost:3000/api/health

Note: if MongoDB is unavailable, backend automatically uses an in-memory fallback so the app still works for demos.

### 4. Start frontend

	cd frontend
	npm start

Frontend URL:

	http://localhost:4200

Local frontend uses proxy.conf.json, so API calls go to backend without CORS issues.

## Production Build

Frontend production build:

	cd frontend
	npm run build

Output folder:

	frontend/dist/frontend

For production, update frontend/src/environments/environment.production.ts with your deployed backend API URL.

## Push to GitHub Using GitHub CLI

If this folder is not a git repo yet:

	git init
	git add .
	git commit -m "Initial TeamFlow app"

Create and push a new GitHub repo (replace YOUR_REPO_NAME):

	gh repo create YOUR_REPO_NAME --private --source . --remote origin --push

Or public:

	gh repo create YOUR_REPO_NAME --public --source . --remote origin --push

## Hosting Guide

Recommended split deployment:

- Backend: Render (Web Service)
- Frontend: Netlify (Static Site)

### A. Host backend on Render

1. In Render, create a new Web Service from your GitHub repo.
2. Set Root Directory to backend.
3. Build Command:

	   npm install

4. Start Command:

	   npm start

5. Add environment variables:

	   PORT=3000
	   MONGODB_URI=<your mongodb atlas uri>
	   CORS_ORIGINS=<your netlify frontend url>

6. Deploy and copy backend URL, for example:

	   https://teamflow-api.onrender.com

### B. Host frontend on Netlify

1. In Netlify, import the same GitHub repo.
2. Set Base directory to frontend.
3. Build command:

	   npm run build

4. Publish directory:

	   dist/frontend/browser

5. Before deploying, set frontend/src/environments/environment.production.ts apiUrl to:

	   https://teamflow-api.onrender.com/api

6. Commit and push that change, then trigger deploy.

### C. Final production checks

After deploy:

- Open frontend URL
- Create a project
- Create a task
- Change task status
- Delete project/task
- Verify backend health at /api/health

## Notes

- Current backend fallback mode keeps data in memory only and resets on restart.
- For persistent production data, use MongoDB Atlas and set MONGODB_URI.
