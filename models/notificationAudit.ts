const mongoose = require("mongoose");

const notificationAuditSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ["ticket_qr", "general_update", "event_change"],
      required: true,
      index: true,
    },
    eventId: {
      type: String,
      default: "",
      index: true,
    },
    initiatedBy: {
      type: String,
      required: true,
      index: true,
    },
    targetCount: {
      type: Number,
      default: 1,
    },
  },
  { timestamps: true }
);

const NotificationAudit =
  mongoose.models.NotificationAudit ||
  mongoose.model("NotificationAudit", notificationAuditSchema);

export default NotificationAudit;
