# Secure AI backend (Cloudflare Worker)

This proxy keeps the AI provider API key off the public GitHub Pages frontend. It supports typed questions and PNG/JPEG/WebP question images.

## Deploy
1. Create/sign in to a Cloudflare account and open Workers & Pages. Create a Worker named `reshad-du-prep-ai`.
2. Paste the contents of `worker.js` into the Worker editor and deploy.
3. In Worker Settings → Variables and Secrets, add a **Secret** named `OPENAI_API_KEY` with your API key. Never add it to GitHub or frontend JS.
4. Add a non-secret variable `ALLOWED_ORIGIN` set to the exact origin of the GitHub Pages site, e.g. `https://yourname.github.io` (no path and no trailing slash). Do not use `*` for a public production deployment.
5. Optionally add `AI_MODEL` with a model available to your API account. The default in this example is `gpt-6-astra`; change it if your account uses a different model ID.
6. Deploy again. Copy the Worker URL, usually `https://reshad-du-prep-ai.<your-subdomain>.workers.dev`.
7. In `assets/app.js`, set `const AI_API_URL = "https://YOUR-WORKER-URL.workers.dev";`, commit/push the file, and reload GitHub Pages.
8. Test with a short text question, then a cropped question image.

## Safety and costs
- API usage may cost money; check provider pricing and set a budget/usage alert before using it.
- Configure Cloudflare rate limiting or another abuse control before sharing the public URL. CORS only controls browser access; it is not authentication and does not stop direct HTTP requests.
- The Worker rejects large requests, limits input length and does not return raw provider error details. Add stronger rate limits/authentication if this is shared publicly.
- Image requests are sent to the configured AI provider. Avoid uploading personal documents or private information.
- This starter backend does not persist chats. `store: false` is requested from the API, but review your provider account's current data controls.
- The model can make mistakes; verify high-stakes exam answers against textbooks/teachers.

Official docs: https://developers.openai.com/api/reference/resources/responses/methods/create and https://developers.cloudflare.com/workers/configuration/secrets/
