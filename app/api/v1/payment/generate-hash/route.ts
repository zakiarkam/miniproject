// R3 Policy 5.1 — Server-side hash generation for PayHere checkout
// The merchant secret must NEVER be exposed to the client.
// The client calls this endpoint to get the hash before opening PayHere.

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const MERCHANT_SECRET = process.env.PAYHERE_MERCHANT_SECRET!;
const MERCHANT_ID = process.env.PAYHERE_MERCHANT_ID!;

export async function POST(req: NextRequest) {
  try {
    const { orderId, amount, currency } = await req.json();

    if (!orderId || amount == null || !currency) {
      return NextResponse.json(
        { error: "Missing required fields: orderId, amount, currency" },
        { status: 400 }
      );
    }

    // R3 Policy 5.1.1 — Generate hash server-side only
    // NOSONAR: MD5 is REQUIRED by PayHere API spec (developers.payhere.lk). Not used for passwords.
    const hashedSecret = crypto
      .createHash("md5") // NOSONAR — PayHere spec compliance
      .update(MERCHANT_SECRET)
      .digest("hex")
      .toUpperCase();

    const amountFormatted = Number(amount)
      .toLocaleString("en-us", { minimumFractionDigits: 2 })
      .replaceAll(",", "");

    const hash = crypto
      .createHash("md5") // NOSONAR — PayHere spec compliance
      .update(MERCHANT_ID + orderId + amountFormatted + currency + hashedSecret)
      .digest("hex")
      .toUpperCase();

    return NextResponse.json({
      hash,
      merchantId: MERCHANT_ID,
    });
  } catch (error: any) {
    console.error("[R3] Hash generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate hash" },
      { status: 500 }
    );
  }
}
