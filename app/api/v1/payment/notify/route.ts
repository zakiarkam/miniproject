// R3 Policy 5.1 — PayHere Server-Side Callback (notify_url) Handler
// This route receives POST callbacks from PayHere's payment gateway.
// It validates the signature, checks against internal records, and processes
// payment idempotently. NEVER trust client-side payment status.

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import connectMongoDB from "@/lib/mongo/mongodb";
import PaymentOrder from "@/models/paymentOrder";
import PaymentAuditLog from "@/models/paymentAuditLog";
import Event from "@/models/eventModel";
import BuyTicket from "@/models/buyTicket";
import TicketType from "@/models/ticketType";
import { checkRateLimit } from "@/lib/rateLimiter";

// R3 Policy 5.1 — Merchant secret from environment (NEVER hardcode)
const MERCHANT_SECRET = process.env.PAYHERE_MERCHANT_SECRET!;
const EXPECTED_MERCHANT_ID = process.env.PAYHERE_MERCHANT_ID!;

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * R3 Policy 5.1.7 — Write an audit log entry to the database
 */
async function auditLog(params: {
  userId: string;
  eventId: string;
  orderId: string;
  status: string;
  action: string;
  details?: string;
  ipAddress?: string;
}) {
  try {
    await PaymentAuditLog.create({
      ...params,
      timestamp: new Date(),
    });
  } catch (err) {
    // Audit logging must not break the flow; log to console as fallback
    console.error("[R3 AUDIT] Failed to write audit log:", err, params);
  }
}

/**
 * R3 Policy 5.1.1 — Verify PayHere HMAC/hash signature
 * PayHere sends: md5(merchant_id + order_id + amount + currency + status_code + md5(merchant_secret))
 */
function verifyPayhereSignature(params: {
  merchant_id: string;
  order_id: string;
  amount: string;
  currency: string;
  status_code: string;
  md5sig: string;
}): boolean {
  const hashedSecret = crypto
    .createHash("md5")
    .update(MERCHANT_SECRET)
    .digest("hex")
    .toUpperCase();

  const rawSignature =
    params.merchant_id +
    params.order_id +
    params.amount +
    params.currency +
    params.status_code +
    hashedSecret;

  const localHash = crypto
    .createHash("md5")
    .update(rawSignature)
    .digest("hex")
    .toUpperCase();

  return localHash === params.md5sig.toUpperCase();
}

/**
 * Generate a unique 8-digit ticket code that doesn't collide with existing codes.
 */
async function generateUniqueTicketCode(): Promise<string> {
  const existingCodes = await BuyTicket.distinct("ticketCode");
  const existingSet = new Set(existingCodes);
  let code: string;
  do {
    code = Math.floor(10000000 + Math.random() * 90000000).toString();
  } while (existingSet.has(code));
  return code;
}

// ─── POST Handler ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // R3 Policy 5.1.6 — HTTPS enforcement check
  const proto =
    req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(":", "");
  if (proto !== "https" && process.env.NODE_ENV === "production") {
    // In production, reject non-HTTPS callbacks
    console.warn("[R3] HTTPS enforcement: rejected non-HTTPS callback");
    await connectMongoDB();
    await auditLog({
      userId: "unknown",
      eventId: "unknown",
      orderId: "unknown",
      status: "REJECTED",
      action: "HTTPS_REJECTED",
      details: `Protocol: ${proto}`,
      ipAddress: req.headers.get("x-forwarded-for") || "unknown",
    });
    return NextResponse.json(
      { error: "HTTPS required" },
      { status: 403 }
    );
  }

  let body: any;
  try {
    // PayHere sends application/x-www-form-urlencoded
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      body = Object.fromEntries(params.entries());
    } else {
      body = await req.json();
    }
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const {
    merchant_id,
    order_id,
    payment_id,
    payhere_amount,
    payhere_currency,
    status_code,
    md5sig,
  } = body;

  // Basic field validation
  if (!merchant_id || !order_id || !md5sig || !status_code) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const clientIp = req.headers.get("x-forwarded-for") || "unknown";

  await connectMongoDB();

  // R3 Policy 5.1.8 — Rate limit per order_id (10 requests/min)
  const rateCheck = checkRateLimit(order_id);
  if (!rateCheck.allowed) {
    await auditLog({
      userId: "unknown",
      eventId: "unknown",
      orderId: order_id,
      status: "RATE_LIMITED",
      action: "RATE_LIMITED",
      details: `Rate limit exceeded for order_id: ${order_id}`,
      ipAddress: clientIp,
    });
    return NextResponse.json(
      { error: "Too many requests for this order" },
      { status: 429 }
    );
  }

  // R3 Policy 5.1.7 — Audit: callback received
  await auditLog({
    userId: "unknown", // will be updated once order is fetched
    eventId: "unknown",
    orderId: order_id,
    status: status_code,
    action: "CALLBACK_RECEIVED",
    details: `merchant_id=${merchant_id}, amount=${payhere_amount}, payment_id=${payment_id}`,
    ipAddress: clientIp,
  });

  // ── Step 1: R3 Policy 5.1.1 — HMAC hash validation ──────────────────
  const isSignatureValid = verifyPayhereSignature({
    merchant_id,
    order_id,
    amount: payhere_amount,
    currency: payhere_currency,
    status_code,
    md5sig,
  });

  if (!isSignatureValid) {
    await auditLog({
      userId: "unknown",
      eventId: "unknown",
      orderId: order_id,
      status: status_code,
      action: "SIGNATURE_INVALID",
      details: "Hash signature mismatch — possible tampering",
      ipAddress: clientIp,
    });
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  // R3 Policy 5.1.7 — Audit: signature valid
  await auditLog({
    userId: "unknown",
    eventId: "unknown",
    orderId: order_id,
    status: status_code,
    action: "SIGNATURE_VALID",
    ipAddress: clientIp,
  });

  // ── Step 2: R3 Policy 5.1.2 — Fetch internal order by order_id ──────
  const order = await PaymentOrder.findOne({ orderId: order_id });

  if (!order) {
    await auditLog({
      userId: "unknown",
      eventId: "unknown",
      orderId: order_id,
      status: status_code,
      action: "ORDER_NOT_FOUND",
      details: `No internal order found for order_id: ${order_id}`,
      ipAddress: clientIp,
    });
    return NextResponse.json(
      { error: "Order not found" },
      { status: 400 }
    );
  }

  const orderUserId = order.userId;
  const orderEventId = order.eventId.toString();

  // ── Step 3: R3 Policy 5.1.3 — Reject amount/merchant_id/order mismatch ──
  const callbackAmount = parseFloat(payhere_amount);
  if (callbackAmount !== order.amount) {
    await auditLog({
      userId: orderUserId,
      eventId: orderEventId,
      orderId: order_id,
      status: status_code,
      action: "AMOUNT_MISMATCH",
      details: `Expected ${order.amount}, received ${callbackAmount}`,
      ipAddress: clientIp,
    });
    return NextResponse.json(
      { error: "Amount mismatch" },
      { status: 400 }
    );
  }

  if (merchant_id !== EXPECTED_MERCHANT_ID) {
    await auditLog({
      userId: orderUserId,
      eventId: orderEventId,
      orderId: order_id,
      status: status_code,
      action: "MERCHANT_MISMATCH",
      details: `Expected ${EXPECTED_MERCHANT_ID}, received ${merchant_id}`,
      ipAddress: clientIp,
    });
    return NextResponse.json(
      { error: "Merchant ID mismatch" },
      { status: 400 }
    );
  }

  // ── Step 4: R3 Policy 5.1.4 — Idempotency: already PAID → log duplicate ──
  if (order.status === "PAID") {
    await auditLog({
      userId: orderUserId,
      eventId: orderEventId,
      orderId: order_id,
      status: status_code,
      action: "DUPLICATE_PAYMENT",
      details: "Order already marked as PAID — no update performed",
      ipAddress: clientIp,
    });
    // R3 Policy 5.1.4 — Return 200 for duplicate (idempotent)
    return NextResponse.json({ success: true, message: "Already processed" });
  }

  // ── Handle non-success status codes from PayHere ──────────────────────
  // PayHere status_code: 2 = success, 0 = pending, -1 = canceled, -2 = failed, -3 = chargeback
  const statusCodeNum = parseInt(status_code, 10);
  if (statusCodeNum !== 2) {
    const failStatus =
      statusCodeNum === 0
        ? "PENDING"
        : statusCodeNum === -1
        ? "CANCELLED"
        : "FAILED";

    await PaymentOrder.findOneAndUpdate(
      { orderId: order_id },
      { status: failStatus, payherePaymentId: payment_id }
    );

    await auditLog({
      userId: orderUserId,
      eventId: orderEventId,
      orderId: order_id,
      status: failStatus,
      action: "PAYMENT_FAILED",
      details: `PayHere status_code: ${status_code}`,
      ipAddress: clientIp,
    });

    return NextResponse.json({ success: true, message: `Payment ${failStatus.toLowerCase()}` });
  }

  // ── Step 5: R3 Policy 5.1.5 — Valid + PENDING → mark PAID, +Event.income, issue ticket ──
  try {
    // 5a. Mark order as PAID
    const updatedOrder = await PaymentOrder.findOneAndUpdate(
      { orderId: order_id, status: "PENDING" }, // Only update if still PENDING (extra idempotency guard)
      { status: "PAID", payherePaymentId: payment_id },
      { new: true }
    );

    if (!updatedOrder) {
      // Another callback already processed this order (race condition guard)
      await auditLog({
        userId: orderUserId,
        eventId: orderEventId,
        orderId: order_id,
        status: "PAID",
        action: "DUPLICATE_PAYMENT",
        details: "Concurrent callback — order no longer PENDING",
        ipAddress: clientIp,
      });
      return NextResponse.json({ success: true, message: "Already processed" });
    }

    // 5b. Issue tickets for each item in the order
    const issuedTicketCodes: string[] = [];

    for (const ticket of updatedOrder.tickets) {
      for (let i = 0; i < (ticket.quantity || 1); i++) {
        const ticketCode = await generateUniqueTicketCode();

        // Create BuyTicket record
        await BuyTicket.create({
          ticketId: ticket.typeId,
          eventId: updatedOrder.eventId,
          userId: updatedOrder.userId,
          ticketCode,
        });

        // Increment ticket type count
        await TicketType.findByIdAndUpdate(ticket.typeId, {
          $inc: { count: 1 },
        });

        issuedTicketCodes.push(ticketCode);

        // R3 Policy 5.1.7 — Audit: ticket issued
        await auditLog({
          userId: orderUserId,
          eventId: orderEventId,
          orderId: order_id,
          status: "PAID",
          action: "TICKET_ISSUED",
          details: `ticketCode=${ticketCode}, typeId=${ticket.typeId}`,
          ipAddress: clientIp,
        });
      }
    }

    // Store ticket codes on the order
    await PaymentOrder.findOneAndUpdate(
      { orderId: order_id },
      { ticketCodes: issuedTicketCodes }
    );

    // 5c. Update Event.income
    await Event.findByIdAndUpdate(updatedOrder.eventId, {
      $inc: { income: updatedOrder.amount },
    });

    // R3 Policy 5.1.7 — Audit: payment success
    await auditLog({
      userId: orderUserId,
      eventId: orderEventId,
      orderId: order_id,
      status: "PAID",
      action: "PAYMENT_SUCCESS",
      details: `Amount: ${updatedOrder.amount}, Tickets: ${issuedTicketCodes.length}`,
      ipAddress: clientIp,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[R3] Payment processing error:", error);
    await auditLog({
      userId: orderUserId,
      eventId: orderEventId,
      orderId: order_id,
      status: "ERROR",
      action: "PAYMENT_FAILED",
      details: `Server error: ${error.message}`,
      ipAddress: clientIp,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
