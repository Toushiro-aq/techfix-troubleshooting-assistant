# TechFix

Web-based computer troubleshooting assistant for Grade 12 CSS students.

- `public/index.html` — the whole frontend
- `server.js` — tiny Node server: serves `public/` and handles `POST /api/chat`
- No npm dependencies, nothing to install

## Run locally

    ANTHROPIC_API_KEY=your-key node server.js

Then open http://localhost:3000

## Deploy on Render

1. Push this repo to GitHub.
2. Render dashboard → New → Web Service → pick the repo.
3. Runtime: Node. Build command: `echo ok` (or leave empty). Start command: `npm start`.
4. Add environment variable `ANTHROPIC_API_KEY` (from console.anthropic.com).
5. Deploy.

Optional env vars: `ANTHROPIC_MODEL`, `RATE_LIMIT_PER_MIN`.
