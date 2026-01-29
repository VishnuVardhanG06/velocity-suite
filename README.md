# ⚡ Velocity Suite: Grounded Autonomous Intelligence

🚀 A production-grade full-stack prototype providing real-time market intelligence with autonomous web browsing and verified data grounding.

## 🎯 Overview
Velocity Suite implements a **"Verified Grounding"** architecture that prevents AI hallucinations by requiring every data point to have a traceable source URL. The system uses a multi-agent microservices architecture to bridge the gap between raw web data and executive strategy.

- **Node.js Backend**: Handles API requests and SQLite database persistence.
- **Python AI Engine**: Autonomous web scraping with Playwright and strict Pydantic validation.
- **Frontend**: Neon-Dark FinTech themed UI with integrated intelligence tabs.

## ✨ Strategic Features (Phase 3)

### 📊 Tab 1: Market Pulse
* **KPI Dashboard**: Real-time tracking of Average Price, Sentiment Scores, and Market Pulse.
* **Thought Process Feed**: Live activity log showing the agent's autonomous reasoning in real-time.

### 🔍 Tab 2: Intelligence Grid
* **Verified Grounding**: Every data point features a clickable link to its live web source.
* **Source Badges**: ✓ icons confirm data authenticity and extraction source.

### 💡 Tab 3: SWOT Analysis
* **Autonomous Insights**: AI-generated Strengths, Weaknesses, Opportunities, and Threats.
* **Competitive Intelligence**: Automatically identifies market gaps and competitor pricing advantages.

## 🛠️ Technology Stack
* **Backend**: Node.js, Express, SQLite (`better-sqlite3`)
* **AI Engine**: Python, FastAPI, Playwright (Stealth Mode), Pydantic
* **Frontend**: HTML5, Tailwind CSS (Neon-Dark Theme), Vanilla JavaScript

## 📁 Project Structure
```text
velocity-suite/
├── velocity-server/      # Node.js Backend & API
├── velocity-agent/       # Python AI Engine & Scraper
└── public/               # Frontend Assets & Dashboard