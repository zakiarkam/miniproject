// R3 Policy 5.1.7 — Audit log model for payment transaction traceability
import mongoose from "mongoose";

const paymentAuditLogSchema = new mongoose.Schema({
  // R3 Policy 5.1.7 — Required audit fields: userId, eventId, orderId, status, timestamp
  userId: {
    type: String,
    required: true,
  },

  eventId: {
    type: String,
    required: true,
  },

  orderId: {
    type: String,
    required: true,
    index: true,
  },

  status: {
    type: String,
    required: true,
  },

  action: {
    type: String,
    required: true,
    enum: [
      "CALLBACK_RECEIVED",
      "SIGNATURE_VALID",
      "SIGNATURE_INVALID",
      "AMOUNT_MISMATCH",
      "MERCHANT_MISMATCH",
      "ORDER_NOT_FOUND",
      "DUPLICATE_PAYMENT",
      "PAYMENT_SUCCESS",
      "PAYMENT_FAILED",
      "HTTPS_REJECTED",
      "RATE_LIMITED",
      "TICKET_ISSUED",
    ],
  },

  details: {
    type: String,
  },

  ipAddress: {
    type: String,
  },

  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

const PaymentAuditLog =
  mongoose.models.PaymentAuditLog ||
  mongoose.model("PaymentAuditLog", paymentAuditLogSchema);

export default PaymentAuditLog;
