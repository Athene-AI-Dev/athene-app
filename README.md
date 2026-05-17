# 🌌 Athene AI - Setup & Architecture 🌌

Welcome to the future of context-aware intelligence. This guide will help you build and deploy the **Athene AI** ecosystem.

---

## 🏗️ Core Foundation
Bootstrap your environment and prepare for deployment:

```bash
# 1. Clone & Initialize
git clone https://github.com/Athene-AI-Dev/athene-app.git
cd athene-app
pnpm install
cp .env.example .env
```

## 📦 Dependency Manifest
The following stack powers our orchestration, database, and UI layers:

### ⚙️ Core & Orchestration
- **Identity**: `@clerk/nextjs@^7.0.12`
- **Persistence**: `@supabase/supabase-js@^2.103.0`
- **Intelligence**: `@langchain/langgraph@^1.2.9`, `@langchain/core@^1.1.42`
- **Memory**: `@langchain/langgraph-checkpoint-postgres@^1.0.1`

### 🔌 Integrations & Jobs
- **OAuth**: `@nangohq/node@^0.69.48`
- **Task Queue**: `@upstash/qstash@^2.10.1`
- **Cache**: `@upstash/redis@^1.37.0`

### 🧠 Language Models
- **Providers**: Anthropic, OpenAI, Google Gemini
- **Utilities**: `gpt-tokenizer@^2.9.0`, `zod@^4.4.1`

### 🎨 Design System
- **Framework**: `Next.js 15+`, `TailwindCSS`
- **UI Components**: `shadcn/ui`, `xyflow/react`, `lucide-react`

---

## 🚀 Component Installation
Initialize the design system and UI components:

```bash
# Initialize shadcn/ui
npx shadcn@latest init

# Add required UI modules
npx shadcn@latest add button card dialog dropdown-menu input label select textarea sonner sheet sidebar table tabs
```

## 🔧 Development Workflow
Ensure your environment is correctly configured:

- **Linting**: Extends `next/core-web-vitals` + `prettier` (uses ESLint 8.x).
- **Formatting**: 2-space indentation, single quotes.
- **Testing**: Run comprehensive unit and integration tests with `vitest`.

---

## ⚡ Quick Start
```bash
# Start local development server
npm run dev

# Verify production build
npm run build
```

---

### 🛡️ Security Guardrails
- **Zero-Storage Content Policy**: Document bodies are never persisted in the database.
- **Encryption**: sensitive metadata is encrypted at rest using AES-256-GCM.
- **RLS Enforcement**: All Supabase queries must pass through the `withRLS` wrapper.
