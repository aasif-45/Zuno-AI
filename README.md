# 🤖 Zuno AI — Multi-Agent AI Assistant Platform

<div align="center">

[![React 19](https://img.shields.io/badge/Frontend-React%2019%20%7C%20Vite-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Backend-Node.js%20%7C%20Express-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Containers-Docker%20%7C%20Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![AWS ECS Fargate](https://img.shields.io/badge/Cloud-AWS%20ECS%20Fargate%20%7C%20S3%20%7C%20ALB-FF9900?logo=amazon-aws&logoColor=white)](https://aws.amazon.com/)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB%20Atlas-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Redis](https://img.shields.io/badge/Cache-Redis%20Sessions-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![LangGraph](https://img.shields.io/badge/AI%20Framework-LangGraph%20StateGraph-1C3C3C?logo=langchain&logoColor=white)](https://langchain-ai.github.io/langgraph/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**A full-stack, cloud-native Multi-Agent AI productivity workspace featuring intelligent agent routing, live coding artifacts, document generation (PDF/PPT), vision & OCR, and credit-based subscription billing.**

[🌐 Live Demo](http://myai-demo1.s3-website.ap-south-1.amazonaws.com) • [📁 GitHub Repository](https://github.com/aasif-45/Zuno-AI) • [📖 Architecture](#-system-architecture) • [🚀 Quickstart](#-step-by-step-local-setup)

</div>

---

## 📌 Project Overview

**Zuno AI** is a capstone-grade full-stack artificial intelligence application designed to overcome the limitations of single-prompt chatbots. Rather than routing all user requests through a single generic model, Zuno AI employs a **Microservices-based Multi-Agent Orchestration Architecture**.

The system dynamically analyzes user intent, file attachments, and prompt context to route tasks to specialized agent nodes—such as interactive coding with live sandbox execution, presentation generation, PDF synthesis and semantic analysis, web search with Tavily, image generation, and multimodal vision analysis.

### 🌟 Key Highlights
* **Dynamic Multi-Agent Routing:** Blends rule-based deterministic matching with an LLM classifier powered by LangGraph StateGraph.
* **Interactive Code & Document Artifacts:** In-browser live Monaco editor, code execution previews, and downloadable PPTX/PDF files.
* **Cloud-Native AWS Deployment:** Production-grade containerization with Docker, AWS ECR, ECS Fargate, Application Load Balancers (ALB), and S3 static & private asset buckets.
* **Secure Auth & Session Caching:** Firebase Google OAuth2 verified via Firebase Admin SDK with Redis-backed session management.
* **Monetization & Quota Engine:** Integrated Razorpay checkout with webhook verification, plan upgrades (Free, Starter, Pro), and atomic credit tracking.
* **Mobile-First Responsive UI:** Designed with a modern, ChatGPT-style bottom-sheet drawer experience for mobile smartphone screens (320px–430px+).

---

## 🎯 Problem Statement & Motivation

Traditional conversational AI interfaces suffer from several common shortcomings:
1. **Lack of Specialization:** A single LLM prompt struggles to handle specialized formatting like generating valid PowerPoint slides, styling complex PDFs, or running web search simultaneously.
2. **Missing State & Context Isolation:** Monolithic chat applications easily mix conversational history with resource-heavy file parsing and payment logic.
3. **High Latency & Token Costs:** Running heavy reasoning models on simple chat prompts wastes API credits and degrades user experience.
4. **Poor Mobile Usability:** Many desktop AI web apps simply scale down UI elements rather than adopting native mobile interaction patterns.

**Zuno AI solves these problems** by decoupling the application into independent microservices, utilizing a tiered agent router to minimize latency and costs, and wrapping the frontend in an adaptive desktop/mobile design.

---

## 🚀 Live Demo & Endpoints

| Resource | URL |
| :--- | :--- |
| **Frontend Web App** | [http://myai-demo1.s3-website.ap-south-1.amazonaws.com](http://myai-demo1.s3-website.ap-south-1.amazonaws.com) |
| **API Gateway (ALB)** | `http://myai-alb-452140884.ap-south-1.elb.amazonaws.com` |
| **Source Code** | [https://github.com/aasif-45/Zuno-AI](https://github.com/aasif-45/Zuno-AI) |
| **Cloud Region** | `ap-south-1` (AWS Asia Pacific - Mumbai) |

---

## 🤖 Specialized AI Agents

| Agent Mode | Icon | Core Capabilities & Technology | Credit Cost |
| :--- | :---: | :--- | :---: |
| **Auto Router** | ⚡ | Analyzes prompt intent & attachments; automatically dispatches to the optimal agent node. | *Varies* |
| **Coding Assistant** | 💻 | Writes clean code, explains bugs, and generates interactive code artifacts rendered in Monaco Editor. | 1 Credit |
| **PPT Generator** | 📊 | Generates formatted multi-slide PowerPoint presentations (`.pptx`) saved to S3. | 2 Credits |
| **PDF Generator** | 📄 | Produces structured PDF reports with clean typography, tables, and headers. | 2 Credits |
| **PDF Reader / RAG** | 📑 | Extracts text and semantic embeddings from uploaded PDFs for contextual Q&A. | 1 Credit |
| **Vision & Image OCR** | 👁️ | Analyzes uploaded images/diagrams using multimodal vision models. | 1 Credit |
| **Image Generation** | 🎨 | Generates high-fidelity artwork and assets from natural language prompts. | 3 Credits |
| **Web Search** | 🌐 | Real-time web-grounded query execution using Tavily Search API. | 1 Credit |
| **General Chat** | 💬 | Fast, contextual conversational intelligence with conversational memory. | 1 Credit |

---

## 🏗️ System Architecture

```
                               ┌─────────────────────────────────────────┐
                               │             Client Browser              │
                               │  (React 19 + Vite + Tailwind CSS + PWA) │
                               └────────────────────┬────────────────────┘
                                                    │
                                     HTTP Requests & File Uploads
                                                    │
                                                    ▼
                               ┌─────────────────────────────────────────┐
                               │      AWS Application Load Balancer      │
                               │        (Port 80 -> Forwarding)          │
                               └────────────────────┬────────────────────┘
                                                    │
                                                    ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       AWS ECS Fargate Task                                             │
│                                                                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────────────────────┐   │
│   │                                   API Gateway Service (:3000)                                  │   │
│   │                      • Reverse Proxy • CORS • Rate Limiting • Session Validation               │   │
│   └───────────────┬───────────────────────────────┬───────────────────────────────┬────────────────┘   │
│                   │                               │                               │                    │
│                   ▼                               ▼                               ▼                    │
│   ┌───────────────────────────────┐ ┌───────────────────────────────┐ ┌────────────────────────────┐   │
│   │      Auth Service (:3005)     │ │      Chat Service (:3010)     │ │   Billing Service (:3020)  │   │
│   │  • Firebase Token Verification│ │  • Conversation CRUD          │ │   • Razorpay Order Creation│   │
│   │  • User Profile Lifecycle     │ │  • Message History Storage    │ │   • Signature Verification │   │
│   │  • Redis Session Creation     │ │  • Dynamic Title Generation   │ │   • Credit Balance Top-up  │   │
│   └───────────────┬───────────────┘ └───────────────┬───────────────┘ └─────────────┬──────────────┘   │
│                   │                                 │                               │                  │
│                   └─────────────────────────────────┼───────────────────────────────┘                  │
│                                                     │                                                  │
│                                                     ▼                                                  │
│                                   ┌───────────────────────────────────┐                                │
│                                   │        Agent Service (:3015)      │                                │
│                                   │  • LangGraph StateGraph Router    │                                │
│                                   │  • Tool Executions & File Parser  │                                │
│                                   │  • S3 Asset Generation & Upload   │                                │
│                                   │  • Multi-LLM Provider Interface   │                                │
│                                   └─────────────────┬─────────────────┘                                │
│                                                     │                                                  │
│                                                     ▼                                                  │
│                                   ┌───────────────────────────────────┐                                │
│                                   │        Local Redis Cache (:6379)  │                                │
│                                   │  • Session Store • Agent Memory   │                                │
│                                   └───────────────────────────────────┘                                │
└─────────────────────────────────────────────────────┬──────────────────────────────────────────────────┘
                                                      │
                       ┌──────────────────────────────┼──────────────────────────────┐
                       │                              │                              │
                       ▼                              ▼                              ▼
          ┌─────────────────────────┐    ┌─────────────────────────┐    ┌─────────────────────────┐
          │      MongoDB Atlas      │    │     AWS S3 Buckets      │    │     External AI APIs    │
          │ • Users & Credentials   │    │ • Static App Hosting    │    │ • OpenRouter & Gemini   │
          │ • Chats & Messages      │    │ • Private User Uploads  │    │ • Tavily Web Search     │
          │ • Orders & Transactions │    │ • Generated PDF & PPTX  │    │ • Razorpay Gateway      │
          └─────────────────────────┘    └─────────────────────────┘    └─────────────────────────┘
```

---

## 🛠️ Technology Stack

### **Frontend:**
* **Core:** React 19, Vite, React Router v7
* **State Management:** Redux Toolkit (`@reduxjs/toolkit`, `react-redux`)
* **Styling & Animation:** Tailwind CSS v4, Motion (`motion/react`), Lucide React icons
* **Code & Markdown:** Monaco Editor (`@monaco-editor/react`), `react-markdown`, `react-syntax-highlighter`, `remark-gfm`
* **File Management:** JSZip, FileSaver

### **Backend Microservices:**
* **Runtime & Framework:** Node.js (ES Modules), Express.js
* **AI Orchestration:** LangGraph, LangChain (`@langchain/core`, `@langchain/community`)
* **Databases:** MongoDB Atlas (Mongoose ODM), Redis (ioredis)
* **Authentication:** Firebase Admin SDK (Google OAuth2 token verification)
* **File & Media Processing:** AWS SDK (`@aws-sdk/client-s3`), Multer, pdf-parse, pptxgenjs, pdfkit
* **Payments:** Razorpay Node.js SDK

### **DevOps & Cloud Infrastructure:**
* **Containerization:** Docker, Multi-stage builds, Docker Compose
* **Cloud Platform:** Amazon Web Services (AWS)
* **Compute:** AWS ECS (Elastic Container Service) with Fargate (Serverless CPU/RAM)
* **Networking:** Application Load Balancer (ALB), Target Groups, VPC Public Subnets
* **Storage:** AWS S3 (Static Website Hosting + Private Asset Store)
* **CI/CD & Registries:** AWS ECR (Elastic Container Registry), PowerShell automation scripts

---

## 📂 Repository Structure

```text
Zuno-AI/
├── backend/
│   ├── gateway/                  # API Gateway (Reverse Proxy & Rate Limiting)
│   │   ├── index.js
│   │   └── Dockerfile
│   ├── services/
│   │   ├── agent/                # LangGraph Multi-Agent Orchestrator
│   │   │   ├── config/           # LLM, S3, Memory, Tavily configurations
│   │   │   ├── controllers/      # Agent request lifecycle & credit deduction
│   │   │   ├── graph/            # LangGraph StateGraph, Nodes, & Router
│   │   │   ├── routes/
│   │   │   └── Dockerfile
│   │   ├── auth/                 # Authentication & User Management
│   │   │   ├── controllers/      # Firebase token verification & sessions
│   │   │   ├── models/           # User schema
│   │   │   └── Dockerfile
│   │   ├── chat/                 # Conversations & Message Management
│   │   │   ├── controllers/      # Chat CRUD, Title auto-generation
│   │   │   ├── models/           # Conversation & Message schemas
│   │   │   └── Dockerfile
│   │   └── Billing/              # Razorpay Payments & Credit Top-ups
│   │       ├── controllers/      # Order creation & signature verification
│   │       ├── models/           # Payment transaction schema
│   │       └── Dockerfile
│   ├── shared/                   # Shared Redis & utility libraries
│   ├── docker-compose.yml        # Local multi-service orchestration
│   └── package.json
├── frontend/
│   ├── public/                   # Static logos, favicons, and SVGs
│   ├── src/
│   │   ├── assets/               # UI graphics
│   │   ├── components/           # UI Components (Sidebar, ChatArea, Artifacts, Modals)
│   │   │   ├── Artifact.jsx      # Live Code Sandbox & Preview
│   │   │   ├── BillingDrawer.jsx # Mobile-friendly Plan Upgrade Modal
│   │   │   ├── ChatInput.jsx     # Responsive Input Box & Agent Selector
│   │   │   ├── MessageBubble.jsx # Markdown, tables, code blocks, file links
│   │   │   ├── ProfileModal.jsx  # User account & credit status bottom sheet
│   │   │   ├── SettingsModal.jsx # App preferences & data export
│   │   │   └── Sidebar.jsx       # Persistent collapsible chat history drawer
│   │   ├── features/             # Axios API service integrations
│   │   ├── redux/                # Redux slices (User, Conversation, Message)
│   │   ├── utils/                # Axios instance & Firebase client config
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── deploy/
│   └── aws/                      # Automated AWS Deployment PowerShell Scripts
│       ├── create-ecr-repos.ps1
│       ├── build-and-push-backend.ps1
│       ├── deploy-ecs-all-in-one.ps1
│       └── deploy-frontend-s3.ps1
├── .gitignore
└── README.md
```

---

## 🗄️ Database Schemas & Data Model

### 1. **User Schema (`User.js`)**
```javascript
{
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  avatar: { type: String, default: "" },
  firebaseUid: { type: String, required: true, unique: true },
  plan: { type: String, enum: ["free", "starter", "pro"], default: "free" },
  credits: { type: Number, default: 100 },
  totalCredits: { type: Number, default: 100 },
  createdAt: { type: Date, default: Date.now }
}
```

### 2. **Conversation Schema (`conversation.model.js`)**
```javascript
{
  userId: { type: String, required: true, index: true },
  title: { type: String, default: "New Chat" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}
```

### 3. **Message Schema (`message.model.js`)**
```javascript
{
  conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
  sender: { type: String, enum: ["user", "assistant"], required: true },
  text: { type: String, required: true },
  agentUsed: { type: String, default: "auto" },
  fileUrl: { type: String, default: null },
  fileName: { type: String, default: null },
  fileType: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
}
```

### 4. **Payment Schema (`payment.model.js`)**
```javascript
{
  userId: { type: String, required: true, index: true },
  orderId: { type: String, required: true, unique: true },
  paymentId: { type: String },
  signature: { type: String },
  plan: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ["created", "paid", "failed"], default: "created" },
  createdAt: { type: Date, default: Date.now }
}
```

---

## ⚙️ Environment Variables Guide

### **Backend (`.env`)**
Create `.env` in the respective `backend/services/*` folders:

```env
# Server
PORT=3000
NODE_ENV=development

# Database & Cache
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/zuno_ai?retryWrites=true&w=majority
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Firebase Admin
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# AWS S3 Storage
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
S3_BUCKET_NAME=your_s3_files_bucket

# AI Model APIs
OPENROUTER_API_KEY=sk-or-v1-...
GEMINI_API_KEY=AIzaSy...
TAVILY_API_KEY=tvly-...

# Payments
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=your_razorpay_secret
```

### **Frontend (`frontend/.env`)**
```env
VITE_API_URL=http://localhost:3000
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef
VITE_RAZORPAY_KEY_ID=rzp_test_...
```

---

## 🚀 Step-by-Step Local Setup

### 1. **Clone the Repository**
```bash
git clone https://github.com/aasif-45/Zuno-AI.git
cd Zuno-AI
```

### 2. **Run Backend with Docker Compose**
Ensure Docker Desktop is running:
```bash
cd backend
docker-compose up -d redis
```

### 3. **Install Dependencies & Start Backend Services**
```bash
# In separate terminal tabs or using a process manager:
cd backend/gateway && npm install && npm run dev
cd backend/services/auth && npm install && npm run dev
cd backend/services/chat && npm install && npm run dev
cd backend/services/agent && npm install && npm run dev
cd backend/services/Billing && npm install && npm run dev
```

### 4. **Install & Run Frontend**
```bash
cd ../../frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser!

---

## ☁️ AWS Cloud Deployment Summary

The project includes ready-to-use PowerShell scripts in `deploy/aws/`:

1. **`create-ecr-repos.ps1`**: Provisions AWS ECR private repositories for all microservices.
2. **`build-and-push-backend.ps1`**: Builds Linux/amd64 Docker containers and pushes images to ECR.
3. **`deploy-ecs-all-in-one.ps1`**: Creates IAM roles, CloudWatch log groups, security groups, ALB target groups, and registers an ECS Fargate task definition.
4. **`deploy-frontend-s3.ps1`**: Builds the production React app with Vite and deploys static assets to AWS S3 with cache-busting headers.

---

## 💡 Engineering Challenges & Key Learnings

1. **State Consistency Across Distributed Services:**
   - *Challenge:* Deducting credits accurately while handling multi-step agent execution failures.
   - *Solution:* Implemented post-execution atomic credit deduction in MongoDB using session locks so users are never charged for aborted or failed AI generations.

2. **Deterministic vs. LLM Router Optimization:**
   - *Challenge:* LLM classifiers add 800ms–1.5s latency to simple greetings and basic code queries.
   - *Solution:* Built a 2-tier router. Fast regular-expression and keyword heuristics resolve obvious queries in $<5\text{ms}$; complex ambiguous prompts fall back gracefully to the LangGraph LLM classifier.

3. **In-Browser Artifact Rendering & Security:**
   - *Challenge:* Safely rendering user-generated HTML/JS artifacts without exposing parent app cookies or triggering XSS.
   - *Solution:* Sandboxed `<iframe>` environment with Monaco Editor, blocking top-level DOM access while allowing interactive game and app preview.

4. **Mobile UX Fidelity:**
   - *Challenge:* Centered modal popups were difficult to reach on modern tall smartphone screens.
   - *Solution:* Refactored Settings, Profile, and Billing modals to responsive bottom-sheet drawers with fixed headers, sticky action buttons, and $44\text{px}+$ touch targets.

---

## 🔮 Future Roadmap

- [ ] Transition single-task container into independent ECS Microservice Clusters using AWS Cloud Map.
- [ ] Implement Redis-backed Token Bucket Rate Limiting per user IP/ID.
- [ ] Add real-time Server-Sent Events (SSE) / WebSocket streaming for AI responses.
- [ ] Migrate secret configurations to AWS Secrets Manager with automated key rotation.
- [ ] CloudFront CDN distribution with SSL/TLS termination via AWS Certificate Manager (ACM).

---

## 👨‍💻 Author & Academic Information

* **Developer:** Aasif
* **Project Type:** Final Year Capstone / Full-Stack AI Portfolio Project
* **GitHub:** [@aasif-45](https://github.com/aasif-45)
* **Repository:** [Zuno-AI](https://github.com/aasif-45/Zuno-AI)

---

<div align="center">
  <sub>Built with ❤️ using React 19, Node.js, LangGraph, Docker & AWS ECS.</sub>
</div>
