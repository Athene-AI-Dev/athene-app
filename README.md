# AtheneAI

Welcome to the **AtheneAI** construction site. This project has been initialized as a modern, scalable Next.js application designed for agentic AI workflows. It follows a modular architecture with high-visibility documentation to ensure all contributors are aligned.

## 🏗️ Project Setup Status
The initial skeleton has been built, dependencies installed, and tooling configured. This includes:
- **Next.js 16** (Turbopack enabled)
- **Tailwind CSS v4** styling
- **Shadcn/UI** components
- **Clerk** Authentication middleware ready
- **LangGraph** & **Supabase** foundations

## 🚀 Quick Start

To get up and running locally, follow these steps:

### 1. Prerequisites
Ensure you have **Node.js 18+** and **npm** installed.

### 2. Installation
Navigate to the web application directory and install dependencies:
```powershell
cd apps/web
npm install
```

### 3. Environment Variables
The application requires several third-party integrations. Copy the example environment file and fill in your keys:
```powershell
cp .env.example .env
```
*Required keys from: Clerk, Supabase, Nango, QStash, Upstash Redis, Anthropic, and OpenAI.*

### 4. Development
Start the development server with local proxying enabled:
```powershell
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### 5. Production Build
Verify the production-readiness of the app:
```powershell
npm run build
```

## 📂 Architecture
The project structure follows the blueprint defined in Chapter 11. For a detailed breakdown of folders, API routes, and library modules, please refer to:
👉 **[ATHENE_ARCHITECTURE.md](./ATHENE_ARCHITECTURE.md)**

## 🛠️ Tooling
- **TypeScript**: Strict mode enabled.
- **ESLint**: Configured with Next.js core web vitals and Prettier integration.
- **Prettier**: Set to a 2-space indent, single quotes, and trailing commas.
- **Proxy/Middleware**: Using the Next.js 16 `proxy.ts` convention for Clerk authentication.

---
*Maintained by the AtheneAI Development Team.*
