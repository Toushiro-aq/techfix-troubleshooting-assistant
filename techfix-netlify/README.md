# TechFix

Web-based computer troubleshooting assistant for Grade 12 CSS students.

- `index.html` — the whole frontend
- `netlify/functions/chat.mts` — the AI endpoint (`POST /api/chat`), uses Netlify AI Gateway
- No npm packages, nothing to install

## Deploy on Netlify

1. Push this repo to GitHub.
2. Netlify → Add new project → Import from Git → pick this repo.
3. Leave the build command empty. Publish directory: leave default (root).
4. Deploy to production once so the AI Gateway turns on (needs a credit-based plan, the Free plan works).
5. No API key needed. Netlify injects it.

Optional: set an environment variable `TECHFIX_MODEL` (e.g. `claude-sonnet-5-5`) to use a smarter model.

## Updating

Edit files, then `git add .`, `git commit -m "message"`, `git push`. Netlify redeploys automatically.
