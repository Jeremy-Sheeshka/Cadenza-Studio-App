# Cadenza Studio — Self-Hosted Studio Management

This program is still a work in progress and does not yet function as it should.
`
## Quick Start

```bash
cd Cadenza-Studio-App

# 1. Install dependencies
npm install
cd server && npm install && cd ..

# 2. Seed the database (creates demo accounts)
npm run seed

# 3. Start the app (backend + frontend)
npm run dev:full
```

Then open **http://localhost:5173** and click any "Demo" button.

## Demo Accounts
| Role | Email | Password |
|------|-------|----------|
| Teacher | teacher@cadenza.local | cadenza123 |
| Student | student@cadenza.local | student123 |
| Family | family@cadenza.local | family123 |

## Requirements
- Node.js 18+
- npm 9+
- Ollama (optional, for AI features): `ollama pull llama3.2:3b`

## Structure
- `src/` — React frontend (23 pages, 3 account types)
- `server/` — Express API + SQLite database (34 endpoints)
- `data/` — SQLite database file stored here
