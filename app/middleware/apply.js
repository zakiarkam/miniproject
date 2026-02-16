// middleware/apply.js
// Allows using Express-like middleware in Next.js route handlers

export function withMiddleware(handler, ...middlewares) {
  return async function wrapped(nextReq, nextCtx) {
    // Create a tiny "req/res" shim from NextRequest
    const req = {
      method: nextReq.method,
      headers: nextReq.headers,
      ip: nextReq.ip ?? nextReq.headers.get("x-forwarded-for") ?? null,
      originalUrl: nextReq.nextUrl.pathname,
      nextReq,       // keep original available if needed
      nextCtx,       // route params, etc.
      user: undefined, // we’ll set this below from NextAuth session
    };

    // A minimal res shim that middlewares can use
    const res = {
      statusCode: 200,
      body: null,
      setStatus(code) { this.statusCode = code; },
      setBody(obj) { this.body = obj; },
    };

    // Run each middleware sequentially
    let idx = 0;
    const run = async () => {
      if (idx >= middlewares.length) return;
      const mw = middlewares[idx++];
      await new Promise((resolve) => {
        mw(req, res, () => resolve(null));
      });
      // If a middleware has already set an error response, short-circuit
      if (res.statusCode !== 200 && res.body) return;
      await run();
    };

    await run();

    // If any middleware denied, return now
    if (res.statusCode !== 200 && res.body) {
      // Build a NextResponse without importing (keep this adapter framework-agnostic).
      // The route handler can translate {statusCode, body} to NextResponse.json
      return { __middlewareTerminated: true, resShim: res };
    }

    // Proceed to the original handler
    const result = await handler(req, res);
    return result;
  };
}