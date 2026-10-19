/**
 * Cloudflare Worker proxy for DU Prep Lab AI Tutor.
 * Set OPENAI_API_KEY as a Worker secret and ALLOWED_ORIGIN as your GitHub Pages origin.
 * Never expose the provider key to browser code.
 */
const corsHeaders = (origin, allowedOrigin) => ({
  "Access-Control-Allow-Origin": allowedOrigin === "*" ? "*" : (origin === allowedOrigin ? origin : "null"),
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Vary": "Origin"
});
function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers } });
}
function getOutputText(data) {
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  const parts = [];
  for (const item of data.output || []) for (const content of item.content || []) if (content.type === "output_text" && content.text) parts.push(content.text);
  return parts.join("\n").trim();
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = env.ALLOWED_ORIGIN || "";
    const headers = corsHeaders(origin, allowedOrigin);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return json({ error: "Use POST for AI requests." }, 405, headers);
    if (!allowedOrigin || (allowedOrigin !== "*" && origin !== allowedOrigin)) return json({ error: "This website origin is not allowed. Configure ALLOWED_ORIGIN in the Worker." }, 403, headers);
    if (!env.OPENAI_API_KEY) return json({ error: "Backend API secret is not configured." }, 500, headers);
    const contentLength = Number(request.headers.get("Content-Length") || 0);
    if (contentLength > 6_000_000) return json({ error: "Request too large. Use a smaller image or shorter question." }, 413, headers);
    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON request." }, 400, headers); }
    const mode = body.mode === "solve" ? "solve" : "tutor";
    const subject = String(body.subject || "General").slice(0, 50);
    const level = String(body.level || "Medium").slice(0, 30);
    const paper = String(body.paper || "Not specified").slice(0, 40);
    const question = String(body.question || "").trim().slice(0, 6000);
    const imageDataUrl = typeof body.imageDataUrl === "string" ? body.imageDataUrl : "";
    if (!question && !imageDataUrl) return json({ error: "Provide question text or an image." }, 400, headers);
    if (imageDataUrl && (!/^data:image\/(png|jpeg|webp);base64,/.test(imageDataUrl) || imageDataUrl.length > 5_500_000)) return json({ error: "Image must be PNG, JPEG or WebP and no larger than about 4 MB." }, 400, headers);

    const instructions = `You are a careful Bangladesh DU Science Unit admission study assistant. Reply in clear Bangla unless the student asks in English. The student is preparing Biology, Physics, Higher Math and Chemistry. Subject: ${subject}; paper: ${paper}; target difficulty: ${level}. Mode: ${mode === "solve" ? "PROBLEM SOLVER" : "AI TUTOR"}.\n` +
      (mode === "solve"
        ? "Solve the supplied problem accurately step by step. State assumptions and units, identify the relevant formula/concept, show substitutions and calculations, then give a clearly labelled final answer. For Biology or conceptual questions, explain the reasoning in ordered steps. If the image is unclear or key data are missing, say exactly what is unreadable/missing instead of inventing it. Check arithmetic and units."
        : "Teach rather than merely dump an answer. Start with the core concept and one useful hint; then explain the reasoning and guide the student to the answer. For MCQs, explain why the correct option fits and briefly why tempting alternatives fail. If the student explicitly asks for the full solution, provide it. Do not invent syllabus claims or pretend certainty when uncertain.") +
      " Use readable headings and numbered steps. Do not claim to be an official DU source. End with one short self-check question when useful.";
    const content = [];
    if (question) content.push({ type: "input_text", text: question });
    if (imageDataUrl) content.push({ type: "input_image", image_url: imageDataUrl, detail: "high" });
    let apiResponse;
    try {
      apiResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Authorization": `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: env.AI_MODEL || "gpt-6-astra", instructions, input: [{ role: "user", content }], max_output_tokens: 1800, store: false })
      });
    } catch {
      return json({ error: "Could not reach the AI provider. Try again shortly." }, 502, headers);
    }
    const data = await apiResponse.json().catch(() => ({}));
    if (!apiResponse.ok) {
      // Avoid returning provider payloads that may contain sensitive diagnostics.
      const status = apiResponse.status === 429 ? 429 : 502;
      return json({ error: apiResponse.status === 429 ? "AI usage limit reached. Try again later." : "AI provider request failed. Check the model setting and API account." }, status, headers);
    }
    const answer = getOutputText(data);
    if (!answer) return json({ error: "The AI returned no text. Try asking again with a clearer question." }, 502, headers);
    return json({ answer }, 200, headers);
  }
};
