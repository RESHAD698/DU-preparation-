# DU Prep Lab — Reshad

A mobile-friendly, dark glassmorphism study and mock-exam website for DU Science Unit preparation.

## Chapter-wise v2 features
- Four subjects: Biology, Physics, Higher Math and Chemistry
- Both papers for each subject
- `data/chapters.json`: 75 chapter entries with topic breakdowns
- `data/questions.json`: 44 starter MCQs tagged by subject, paper, chapter, topic and Easy/Medium/Hard difficulty
- Practice filters for subject, paper, chapter, topic and difficulty
- Hints, answer checking and explanations in Practice mode
- Timed exam mode with subject/paper/chapter/topic filters, question palette, review flags and auto-submit
- Demo marking: +1 correct, −0.25 incorrect, 0 unanswered
- Post-exam chapter breakdown, answer review and local attempt history
- Responsive layout for mobile and desktop

## Important syllabus and question-bank note
The chapter catalogue is an admission-oriented map based on common Bangladesh HSC science topics; chapter names and chapter placement can differ by textbook edition. It is **not an official DU syllabus**. Check the current DU Science Unit admission circular and align the list with the subjects/chapters required for your session. Some chapter/topic combinations are present in the catalogue but do not have MCQs yet. The 44 questions are starter practice questions, not official or previous-year DU questions. Cross-check answers and explanations before relying on them for high-stakes preparation.

## Limitations
- The current Tutor uses saved hints and explanations. **No live AI API is connected.**
- Results stay in the current browser/device; they do not sync across devices.
- `localStorage` can be cleared by browser settings. Export/backup is not implemented yet.
- This is a static front-end project; never put a secret API key in `assets/app.js` or any public repository.

## Publish using GitHub from your phone
1. Sign in to GitHub and create a repository named `reshad-du-prep`.
2. Upload all files and preserve the folder structure:
   - `index.html`
   - `README.md`
   - `assets/style.css`
   - `assets/app.js`
   - `data/questions.json`
   - `data/chapters.json`
3. Open repository **Settings → Pages**.
4. Select **Deploy from a branch**, choose `main` and `/ (root)`, then Save.
5. Wait for deployment and open the URL shown in Settings → Pages.
6. Test subject/paper/chapter/topic filters, Practice mode, exam timer, submission and results.

## Test locally
Because the app loads JSON with `fetch()`, do not open `index.html` directly as a `file://` URL. Use GitHub Pages or a local HTTP server.

## Add questions
Add question objects to `data/questions.json`. Every question should include `id`, `subject`, `paper`, `chapter`, `chapterId`, `topic`, `difficulty`, `question`, four `options`, zero-based `answer`, `hint`, and `explanation`. `chapterId` must match an ID in `data/chapters.json`. `answer`: `0` = A, `1` = B, `2` = C, `3` = D. Keep IDs unique and valid JSON.

## Add real AI later
Use a server-side endpoint/serverless function as a proxy to an AI provider. Store the API key only in server-side environment variables. The browser should call your endpoint; it must never contain the secret key. Keep live AI controls disabled in exam mode, and add rate limits to avoid unexpected charges.

## AI Tutor & Problem Solver (new)
- New AI Tutor page supports text questions and optional PNG/JPEG/WebP question images.
- Tutor mode is hint-first; Problem Solver mode requests a step-by-step solution.
- The frontend has no API key. It calls the optional secure Cloudflare Worker proxy in `backend/worker.js`.
- Follow `backend/README.md` to deploy the Worker, store `OPENAI_API_KEY` as a Worker secret, set the allowed GitHub Pages origin, and paste the Worker URL into `AI_API_URL` in `assets/app.js`.
- AI will not work until you complete those setup steps and have API access/billing enabled. AI usage may cost money; check pricing and set usage limits first.
- Before sharing publicly, configure rate limiting/abuse protection. CORS alone is not authentication.
