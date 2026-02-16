import { NextRequest, NextResponse } from "next/server";

import { withMiddleware } from "@/middleware/apply";
import { accessLogger } from "@/middleware/accessLogger";
import { anomalyDetector } from "@/middleware/anomalyDetector";
import { authorize } from "@/middleware/authorize";
import { attachUser } from "@/middleware/withUser";

async function baseHandler(req: any) {
  // Demo-only: replace with real approve logic (params from req.nextCtx?.params)
  // const { id } = req.nextCtx?.params ?? {};
  return NextResponse.json(
    { ok: true, message: "Event approved (demo)", path: req.originalUrl },
    { status: 200 }
  );
}

export async function PUT(nextReq: NextRequest, nextCtx: { params: { id: string } }) {
  const handler = withMiddleware(
    baseHandler,
    accessLogger,
    anomalyDetector,
    authorize("admin") // hierarchy: admin > organization > user
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
