// R3 Policy 5.1.2 — Create a PENDING PaymentOrder before redirecting to PayHere
// This endpoint is called by the client to register an order in our DB
// BEFORE the PayHere payment window opens, so the callback handler has
// an internal record to validate against.

import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongo/mongodb";
import PaymentOrder from "@/models/paymentOrder";

const EXPECTED_MERCHANT_ID = process.env.PAYHERE_MERCHANT_ID!;

export async function POST(req: NextRequest) {
  try {
    const { orderId, userId, eventId, tickets, amount, currency, merchantId } =
      await req.json();

    if (!orderId || !userId || !eventId || !amount) {
      return NextResponse.json(
        { error: "Missing required fields: orderId, userId, eventId, amount" },
        { status: 400 }
      );
    }

    // R3 Policy 5.1.3 — Store merchant_id for later mismatch detection
    const resolvedMerchantId = merchantId || EXPECTED_MERCHANT_ID;

    await connectMongoDB();

    // Check for duplicate order_id
    const existingOrder = await PaymentOrder.findOne({ orderId });
    if (existingOrder) {
      // If already exists and PENDING, return it (idempotent creation)
      if (existingOrder.status === "PENDING") {
        return NextResponse.json(
          { success: true, order: existingOrder },
          { status: 200 }
        );
      }
      return NextResponse.json(
        { error: "Order already processed" },
        { status: 409 }
      );
    }

    const order = await PaymentOrder.create({
      orderId,
      userId,
      eventId,
      tickets: tickets || [],
      amount,
      currency: currency || "LKR",
      merchantId: resolvedMerchantId,
      status: "PENDING",
    });

    return NextResponse.json({ success: true, order }, { status: 201 });
  } catch (error: any) {
    console.error("[R3] Create order error:", error);
    return NextResponse.json(
      { error: "Failed to create payment order" },
      { status: 500 }
    );
  }
}
