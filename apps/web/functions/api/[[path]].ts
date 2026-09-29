interface PagesContext {
  request: Request;
  env: { API_ORIGIN: string };
}

/** Reenvía /api/* a Render desde el mismo origen de la web. */
export async function onRequest({ request, env }: PagesContext): Promise<Response> {
  let apiOrigin: URL;
  try {
    apiOrigin = new URL(env.API_ORIGIN);
  } catch {
    return new Response('La variable API_ORIGIN no contiene una URL válida.', { status: 500 });
  }

  if (apiOrigin.protocol !== 'https:') {
    return new Response('API_ORIGIN debe usar HTTPS.', { status: 500 });
  }

  const incoming = new URL(request.url);
  const target = new URL(`${incoming.pathname}${incoming.search}`, apiOrigin);
  const headers = new Headers(request.headers);
  headers.delete('host');

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') init.body = request.body;

  return fetch(new Request(target, init));
}
