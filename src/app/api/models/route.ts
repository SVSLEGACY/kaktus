export const runtime = 'nodejs';

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get('key');
  if (!key || key.length > 512) return Response.json({ error: 'API key is required.' }, { status: 400 });

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(key));
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) return Response.json({ error: data.error?.message || 'Could not load models.' }, { status: response.status || 502 });

  const models = (data.models || [])
    .filter((model: any) => typeof model.name === 'string' && model.name.includes('gemini') && (model.supportedGenerationMethods || []).includes('generateContent'))
    .map((model: any) => ({
      name: model.name,
      version: model.version || '',
      displayName: model.displayName || model.name.replace('models/', ''),
      description: model.description || '',
    }));
  return Response.json({ models });
}
