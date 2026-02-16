import { NextRequest, NextResponse } from "next/server";

import { withMiddleware } from "@/middleware/apply";
import { accessLogger } from "@/middleware/accessLogger";
import { anomalyDetector } from "@/middleware/anomalyDetector";
import { authorize } from "@/middleware/authorize";
import { attachUser } from "@/middleware/withUser";

async function baseHandler(req: any) {
  // Demo-only: replace with real ticket retrieval logic
  const { id } = req.nextCtx?.params ?? {};
  return NextResponse.json(
    { ok: true, message: "Ticket details (demo)", ticketId: id, path: req.originalUrl },
    { status: 200 }
  );
}

export async function GET(nextReq: NextRequest, nextCtx: { params: { id: string } }) {
  const handler = withMiddleware(
    baseHandler,
    accessLogger,
    anomalyDetector,
    authorize("user") // any authenticated user
  );

  const reqShim = {
    method: nextReq.method,
    headers: nextReq.headers,
    ip: nextReq.ip ?? nextReq.headers.get("x-forwarded-for") ?? null,
    originalUrl: nextReq.nextUrl.pathname,
    nextReq,
    nextCtx,
    user: undefined,
  };

  await attachUser(reqShim);

  const result: any = await handler(reqShim as any, {} as any);

  if (result?.__middlewareTerminated) {
    return NextResponse.json(result.resShim.body, { status: result.resShim.statusCode });
  }
  return result;
}
``