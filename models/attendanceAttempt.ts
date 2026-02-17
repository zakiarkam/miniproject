const mongoose = require("mongoose");

const attendanceAttemptSchema = new mongoose.Schema(
  {
    ticketCodeHash: {
      type: String,
      required: true,
    },
    ticketCodeSuffix: {
      type: String,
      default: "",
    },
    eventId: {
      type: String,
      default: "",
      index: true,
    },
    attendeeUserId: {
      type: String,
      default: "",
    },
    scannerUserId: {
      type: String,
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ["qr", "code"],
      required: true,
    },
    result: {
      type: String,
      enum: ["success", "failure"],
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const AttendanceAttempt =
  mongoose.models.AttendanceAttempt ||
  mongoose.model("AttendanceAttempt", attendanceAttemptSchema);

export default AttendanceAttempt;
