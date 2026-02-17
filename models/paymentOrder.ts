// R3 Policy 5.1 — PaymentOrder model for server-side payment tracking & idempotency
import mongoose from "mongoose";
import Event from "./eventModel";
import TicketType from "./ticketType";

const paymentOrderSchema = new mongoose.Schema(
  {
    // R3 Policy 5.1.2 — Unique order identifier for lookup & idempotency
    orderId: {
      type: String,
      required: [true, "orderId is required"],
      unique: true,
      index: true,
    },

    userId: {
      type: String,
      required: [true, "userId is required"],
    },

    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: Event,
      required: [true, "eventId is required"],
    },

    // Array of ticket selections: [{typeId, classType, quantity}]
    tickets: [
      {
        typeId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: TicketType,
          required: true,
        },
        classType: { type: String, required: true },
        quantity: { type: Number, default: 1 },
      },
    ],

    // R3 Policy 5.1.3 — Amount stored at order creation for mismatch detection
    amount: {
      type: Number,
      required: [true, "amount is required"],
    },

    currency: {
      type: String,
      default: "LKR",
    },

    // R3 Policy 5.1.3 — Merchant ID stored for validation against callback
    merchantId: {
      type: String,
      required: [true, "merchantId is required"],
    },

    // R3 Policy 5.1.4 — Status for idempotent processing
    status: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED", "CANCELLED"],
      default: "PENDING",
    },

    // PayHere payment_id received on callback
    payherePaymentId: {
      type: String,
    },

    // Ticket codes generated upon successful payment
    ticketCodes: [{ type: String }],
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

const PaymentOrder =
  mongoose.models.PaymentOrder ||
  mongoose.model("PaymentOrder", paymentOrderSchema);

export default PaymentOrder;
