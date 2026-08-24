# Zuno AI - Multi-Agent AI Assistant Platform

Zuno AI is a full-stack AI assistant platform that combines Google authentication, persistent conversations, multi-agent AI routing, file upload workflows, document generation, image analysis, and credit-based billing in one workspace.

The project is built with a React/Vite frontend and a Node.js microservice-style backend. The backend is containerized with Docker and deployed on AWS using ECR, ECS Fargate, an Application Load Balancer, S3 static website hosting, S3 private file storage, IAM roles, and CloudWatch logs.

---

## Table of Contents

- [Overview](#overview)
- [Core Features](#core-features)
- [Architecture](#architecture)
- [Backend Services](#backend-services)
- [AI Agent System](#ai-agent-system)
- [Authentication and Sessions](#authentication-and-sessions)
- [Billing and Credits](#billing-and-credits)
- [Data Model](#data-model)
- [File Storage](#file-storage)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Environment Variables](#environment-variables)
- [Local Development](#local-development)
- [AWS Deployment](#aws-deployment)
- [Important Engineering Decisions](#important-engineering-decisions)
- [Known Improvements](#known-improvements)
- [Interview Summary](#interview-summary)

---

## Overview

Most AI chat applications only support text prompts. Zuno AI extends that idea into a practical AI workspace where users can:

- Sign in with Google.
- Create and continue conversations.
- Route prompts automatically to the correct AI agent.
- Ask general questions.
- Generate and debug code.
- Generate PDFs and PowerPoint presentations.
- Upload PDFs for document analysis.
- Upload images for multimodal analysis.
- Generate images.
- Store generated files in S3.
- Upgrade plans using Razorpay.
- Spend AI credits based on the agent used.

The main goal of the project is to demonstrate a production-style full-stack architecture around AI workflows, not just a single chat API call.

---

## Core Features

### Multi-Agent AI Workspace

Zuno AI supports multiple specialized AI modes:

- Auto routing
- General chat
- Web/search style responses
- Coding assistance
- PDF generation
- PDF upload and analysis
- PPT generation
- Image generation
- Image upload and analysis

### Persistent Conversations

Users can create conversations, store messages, reload history, rename conversations using generated titles, and delete conversations.

### Google Authentication

The frontend uses Firebase Google login. The backend verifies Firebase ID tokens using Firebase Admin, creates/fetches the user in MongoDB, and creates a Redis-backed server session.

### Credit-Based Billing

The platform includes a simple credit system:

- Free plan: 100 credits
- Starter plan: 500 credits
- Pro plan: 1000 credits

Razorpay is used for order creation and secure payment verification.

### AWS Deployment

The backend is deployed as Docker containers on ECS Fargate. The frontend is built and uploaded to an S3 static website bucket. Uploaded/generated files use a separate private S3 bucket.

---

## Architecture

```text
Browser
  |
  | React + Vite frontend
  | Firebase Google login
  v
S3 Static Website Hosting
  |
  v
Application Load Balancer
  |
  v
Gateway Service - Express
  |
  |-- /api/auth    -> Auth Service
  |-- /api/chat    -> Chat Service
  |-- /api/agent   -> Agent Service
  |-- /api/billing -> Billing Service
  |
  v
Backend Services
  |
  |-- MongoDB: users, conversations, messages, payments
  |-- Redis: sessions, memory, rate limiting
  |-- S3: uploaded and generated files
  |-- Razorpay: payment orders and verification
  |-- AI Providers: OpenRouter, Gemini, Groq, Tavily, Qdrant
```

### Current AWS Runtime Layout

For the current deployment, the backend services run together in one ECS Fargate task:

```text
ECS Task
  |-- gateway  :3000
  |-- auth     :3005
  |-- chat     :3010
  |-- agent    :3015
  |-- billing  :3020
  |-- redis    :6379
```

This all-in-one task design keeps networking simple for the first production deployment because services communicate through `localhost`. A future production version can split these into independent ECS services using ECS Service Connect or AWS Cloud Map.

---

## Backend Services

### Gateway Service

Path: `backend/gateway`

Responsibilities:

- Public API entrypoint
- CORS handling
- Cookie parsing
- Redis session validation
- Protected route handling
- Proxying requests to internal services
- Forwarding authenticated user context through headers

Important routes:

```text
/api/auth
/api/chat
/api/agent
/api/billing
/api/me
```

### Auth Service

Path: `backend/services/auth`

Responsibilities:

- Verify Firebase ID tokens
- Create/fetch users in MongoDB
- Create Redis sessions
- Store user plan and credits
- Update user plan after payment
- Deduct credits after AI usage

### Chat Service

Path: `backend/services/chat`

Responsibilities:

- Create conversations
- List conversations by user
- Update conversation titles
- Save user/assistant messages
- Fetch message history
- Delete conversations and related messages

### Agent Service

Path: `backend/services/agent`

Responsibilities:

- Receive user prompts and optional files
- Upload files to S3
- Route work through LangGraph
- Execute specialized agents
- Save AI results
- Generate conversation titles
- Check rate limits
- Check and deduct credits

### Billing Service

Path: `backend/services/Billing`

Responsibilities:

- Create Razorpay orders
- Store payment records
- Verify Razorpay signatures
- Mark payments as paid
- Notify auth service to update plan and credits

---

## AI Agent System

The agent system is implemented with LangGraph.

### Agent Graph

```text
START
  |
  v
router
  |
  |-- chat          -> END
  |-- search        -> chat -> END
  |-- coding        -> END
  |-- pdf           -> END
  |-- ppt           -> END
  |-- imageGen      -> END
  |-- pdfRag        -> END
  |-- imageAnalyzer -> END
```

### Routing Strategy

Routing is not only LLM-based. It uses a layered approach:

1. Uploaded file type has highest priority.
   - PDF upload routes to PDF RAG.
   - Image upload routes to image analysis.
2. Explicit user-selected agent is considered.
3. Keyword fast paths handle obvious cases like PDF, PPT, code, image generation, and search.
4. An LLM classifier is used as a fallback for ambiguous prompts.

This design reduces cost and latency because obvious cases do not need model classification.

### Model Fallback Strategy

The backend supports multiple model providers:

- OpenRouter
- Google Gemini
- Groq

The model execution layer attempts a primary model first, then falls back to other providers when limits, timeouts, or provider errors occur.

---

## Authentication and Sessions

Authentication combines Firebase identity with Redis application sessions.

### Login Flow

```text
User clicks Google Login
  |
  v
Firebase returns ID token
  |
  v
Frontend sends token to /api/auth/login
  |
  v
Auth service verifies token using Firebase Admin
  |
  v
MongoDB user is created or fetched
  |
  v
Random session ID is generated
  |
  v
Session payload is stored in Redis
  |
  v
Frontend stores session ID and user data
```

### Why Redis Sessions?

Redis stores app-specific session state such as:

- User ID
- Name and email
- Plan
- Credits
- Session ID
- Expiration

This allows the gateway to validate requests quickly without every service verifying Firebase tokens.

---

## Billing and Credits

### Plans

| Plan | Price | Credits |
|---|---:|---:|
| Free | INR 0 | 100 |
| Starter | INR 199 | 500 |
| Pro | INR 499 | 1000 |

### Credit Cost by Agent

| Agent | Credits |
|---|---:|
| Chat | 2 |
| Search | 3 |
| Coding | 3 |
| Image | 4 |
| PDF | 5 |
| PPT | 5 |

### Payment Verification

Razorpay payment verification is done on the backend using HMAC SHA-256. The backend verifies the signature before updating the user's plan and credits.

This is important because frontend callbacks alone cannot be trusted.

---

## Data Model

### User

Stores:

- Firebase UID
- Name
- Email
- Avatar
- Plan
- Credits
- Total credits
- Plan start date
- Plan expiry date

### Conversation

Stores:

- Title
- User ID
- Created/updated timestamps

### Message

Stores:

- Conversation ID
- Role: `user` or `assistant`
- Content
- Images
- Artifacts
- File name
- File type
- File URL
- Created/updated timestamps

### Payment

Stores:

- User ID
- Razorpay order ID
- Razorpay payment ID
- Amount
- Currency
- Credits
- Plan
- Status
- Paid timestamp

---

## File Storage

Files are not stored directly in MongoDB.

The system stores:

- Actual files in S3
- File metadata in MongoDB

This is used for:

- Uploaded images
- Uploaded PDFs
- Generated PDFs
- Generated PPTs
- Other downloadable artifacts

The upload bucket is intended to stay private. The backend can return presigned URLs or redirect to short-lived S3 access links.

---

## Tech Stack

### Frontend

- React 19
- Vite
- Redux Toolkit
- Tailwind CSS
- Axios
- Firebase Auth
- Razorpay Checkout
- React Markdown
- Lucide React
- Motion
- JSZip / File Saver

### Backend

- Node.js 22
- Express.js
- MongoDB / Mongoose
- Redis / ioredis
- Firebase Admin
- Razorpay SDK
- LangChain
- LangGraph
- Multer
- AWS SDK for S3
- Puppeteer
- PPTXGenJS

### AI and Integrations

- OpenRouter
- Google Gemini
- Groq
- Tavily
- Qdrant

### Cloud and DevOps

- Docker
- AWS ECR
- AWS ECS Fargate
- AWS Application Load Balancer
- AWS S3
- AWS IAM
- AWS CloudWatch Logs
- PowerShell deployment scripts

---

## Repository Structure

```text
.
|-- backend
|   |-- gateway
|   |   |-- index.js
|   |   |-- middleware
|   |   |-- controllers
|   |   |-- utils
|   |   `-- Dockerfile
|   |-- services
|   |   |-- auth
|   |   |-- chat
|   |   |-- agent
|   |   `-- Billing
|   |-- shared
|   |   `-- redis
|   |-- package.json
|   `-- docker-compose.yml
|-- frontend
|   |-- src
|   |   |-- components
|   |   |-- features
|   |   |-- pages
|   |   |-- redux
|   |   `-- utils
|   |-- public
|   |-- package.json
|   `-- vite.config.js
|-- deploy
|   `-- aws
|       |-- create-ecr-repos.ps1
|       |-- build-and-push-backend.ps1
|       |-- deploy-ecs-all-in-one.ps1
|       |-- deploy-frontend-s3.ps1
|       `-- README.md
|-- .github
|   `-- workflows
|-- README.md
`-- skills-lock.json
```

---

## Environment Variables

Each service uses its own `.env` file during local development. Do not commit real secrets.

### Frontend

```env
VITE_FIREBASE_API_KEY=
VITE_SERVER_URL=http://localhost:3000
VITE_RAZORPAY_KEY_ID=
```

### Gateway

```env
PORT=3000
FRONTEND_URL=http://localhost:5173
AUTH_SERVICE=http://localhost:3005
CHAT_SERVICE=http://localhost:3010
AGENT_SERVICE=http://localhost:3015
BILLING_SERVICE=http://localhost:3020
REDIS_URL=redis://localhost:6379
```

### Auth Service

```env
PORT=3005
MONGO_URI=
REDIS_URL=redis://localhost:6379
```

### Chat Service

```env
PORT=3010
MONGO_URI=
```

### Agent Service

```env
PORT=3015
MONGO_URI=
REDIS_URL=redis://localhost:6379
AUTH_SERVICE=http://localhost:3005
CHAT_SERVICE=http://localhost:3010
AWS_REGION=
AWS_S3_BUCKET_NAME=
GROQ_API_KEY=
GOOGLE_API_KEY=
OPENROUTER_API_KEY=
TAVILY_API_KEY=
QDRANT_URL=
QDRANT_API_KEY=
CF_IMAGE_API_URL=
CF_IMAGE_API_KEY=
```

### Billing Service

```env
PORT=3020
MONGO_URI=
AUTH_SERVICE=http://localhost:3005
CHAT_SERVICE=http://localhost:3010
AGENT_SERVICE=http://localhost:3015
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
```

---

## Local Development

Install dependencies inside each app/service folder. The repository intentionally does not require committing `node_modules`.

### 1. Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend runs on:

```text
http://localhost:5173
```

### 2. Backend Root

```powershell
cd backend
npm install
```

### 3. Gateway

```powershell
cd backend/gateway
npm install
npm run dev
```

### 4. Auth Service

```powershell
cd backend/services/auth
npm install
npm run dev
```

### 5. Chat Service

```powershell
cd backend/services/chat
npm install
npm run dev
```

### 6. Agent Service

```powershell
cd backend/services/agent
npm install
npm run dev
```

### 7. Billing Service

```powershell
cd backend/services/Billing
npm install
npm run dev
```

### 8. Redis

For local Redis, use Docker:

```powershell
cd backend
docker compose up -d
```

---

## AWS Deployment

Deployment helpers are in:

```text
deploy/aws
```

### Prerequisites

```powershell
aws configure
aws sts get-caller-identity
docker info
```

### Create ECR Repositories

```powershell
.\deploy\aws\create-ecr-repos.ps1 -Region ap-south-1
```

### Build and Push Backend Images

```powershell
.\deploy\aws\build-and-push-backend.ps1 `
  -AccountId YOUR_ACCOUNT_ID `
  -Region ap-south-1
```

### Deploy ECS Backend

```powershell
.\deploy\aws\deploy-ecs-all-in-one.ps1 `
  -AccountId YOUR_ACCOUNT_ID `
  -Region ap-south-1 `
  -FrontendUrl http://your-frontend-bucket.s3-website.ap-south-1.amazonaws.com `
  -UploadBucket your-private-upload-bucket
```

### Deploy Frontend to S3

```powershell
.\deploy\aws\deploy-frontend-s3.ps1 `
  -BucketName your-public-frontend-bucket `
  -GatewayUrl http://your-alb-dns-name `
  -Region ap-south-1
```

### Notes

- Use one public S3 bucket for frontend assets.
- Use a separate private S3 bucket for uploaded/generated files.
- Do not put secret keys in frontend environment variables.
- For production HTTPS, put CloudFront and ACM in front of the frontend and/or API.
- The included GitHub Actions workflow may need region, ECR repository, ECS service, S3 bucket, and CloudFront values updated before use.

---

## Important Engineering Decisions

### Gateway Instead of Direct Service Access

The frontend only talks to the gateway. The gateway validates sessions and forwards requests to internal services. This keeps authentication and CORS centralized.

### Firebase Identity + Redis Sessions

Firebase proves the user's Google identity. Redis stores application session data such as user ID, plan, credits, and session expiry.

### Rule-Based + LLM-Based Agent Routing

The router handles obvious cases with deterministic rules and uses an LLM classifier only when required. This improves speed, cost, and reliability.

### S3 for Files

Generated files and uploads are stored in S3 instead of MongoDB. MongoDB stores metadata only.

### Credit Deduction After Agent Execution

The system deducts credits based on the actual agent used, not only the mode selected in the UI.

---

## Known Improvements

The current version is deployment-ready for demonstration and interview purposes. For a larger production system, the next improvements would be:

- Move Redis from the ECS task into ElastiCache.
- Split the all-in-one ECS task into separate ECS services.
- Use ECS Service Connect or AWS Cloud Map for service discovery.
- Store secrets in AWS Secrets Manager.
- Add HTTPS with CloudFront and ACM.
- Add API request validation.
- Add automated tests for auth, billing, routing, and chat flows.
- Add pagination for long message histories.
- Add queues for long-running PDF/PPT/image generation.
- Replace broad Redis session scans with direct session indexes.
- Add dashboards and alarms in CloudWatch.

---

## Interview Summary

Use this explanation in interviews:

> Zuno AI is a full-stack multi-agent AI assistant platform. The frontend is built with React, Vite, Redux Toolkit, Tailwind CSS, and Firebase Google login. The backend is split into gateway, auth, chat, agent, and billing services. The gateway validates Redis sessions and proxies requests to internal services. The agent service uses LangGraph to route prompts and uploaded files to specialized agents such as chat, coding, PDF generation, PDF RAG, image analysis, image generation, and PPT generation. MongoDB stores users, conversations, messages, and payments; Redis stores sessions, memory, and rate limits; S3 stores uploaded and generated files; Razorpay handles plan upgrades and credit purchases. I containerized the backend and deployed it on AWS ECS Fargate with ECR, ALB, S3, IAM, and CloudWatch.

---

## License

This project is currently marked as ISC in the backend package metadata. Add a dedicated `LICENSE` file if you plan to publish it as open source.
