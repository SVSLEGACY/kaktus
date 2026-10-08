export const runtime = 'nodejs';

const MAX_BODY_BYTES = 1_500_000;
const MODEL_PATTERN = /^(?:models\/)?gemini-[a-zA-Z0-9._-]+$/;

function validText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface GeminiResponse {
  error?: { message?: string };
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    groundingMetadata?: {
      groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
      webSearchQueries?: string[];
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return Response.json({ error: 'Request is too large.' }, { status: 413 });
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!isRecord(parsed)) return Response.json({ error: 'Request body must be an object.' }, { status: 400 });
    body = parsed;
  } catch {
    return Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  if (!validText(body.apiKey, 512) || !validText(body.model, 160) || !MODEL_PATTERN.test(body.model)) {
    return Response.json({ error: 'A valid Gemini API key and model are required.' }, { status: 400 });
  }
  if (!validText(body.systemPrompt, 600_000) || !Array.isArray(body.contents) || body.contents.length > 80) {
    return Response.json({ error: 'Invalid agent context.' }, { status: 400 });
  }

  const model = body.model.startsWith('models/') ? body.model : 'models/' + body.model;
  const upstream = await fetch('https://generativelanguage.googleapis.com/v1beta/' + model + ':generateContent?key=' + encodeURIComponent(body.apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: body.systemPrompt }] },
      contents: body.contents,
      ...(body.research === true ? { tools: [{ google_search: {} }] } : {}),
      generationConfig: {
        temperature: typeof body.temperature === 'number' ? Math.min(Math.max(body.temperature, 0), 1) : 0.2,
        maxOutputTokens: typeof body.maxOutputTokens === 'number' ? Math.min(Math.max(body.maxOutputTokens, 256), 32768) : 16384,
        responseMimeType: 'text/plain',
      },
    }),
  });
  const result: GeminiResponse = await upstream.json().catch((): GeminiResponse => ({}));
  if (!upstream.ok || result.error) {
    return Response.json({ error: result.error?.message || 'Gemini request failed.' }, { status: upstream.status || 502 });
  }
  const text = result.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('') || '';
  const grounding = result.candidates?.[0]?.groundingMetadata;
  const sources = Array.isArray(grounding?.groundingChunks)
    ? grounding.groundingChunks.flatMap(chunk => chunk.web?.uri && chunk.web?.title
      ? [{ title: chunk.web.title.slice(0, 240), uri: chunk.web.uri }]
      : []).filter((source: { uri: string }, index: number, all: { uri: string }[]) => all.findIndex(item => item.uri === source.uri) === index).slice(0, 20)
    : [];
  const searchQueries = Array.isArray(grounding?.webSearchQueries) ? grounding.webSearchQueries.slice(0, 12) : [];
  const usage = result.usageMetadata?.totalTokenCount || 0;
  return Response.json({ text, sources, searchQueries, researched: body.research === true && sources.length > 0, usage });
}

export async function GET() {
  return Response.json({ ok: true, service: 'Hardware Studio Agent Gateway' });
}
