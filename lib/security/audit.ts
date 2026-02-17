import { createHash } from "crypto";
import AttendanceAttempt from "@/models/attendanceAttempt";
import NotificationAudit from "@/models/notificationAudit";

type AttendanceLogInput = {
  ticketCode: string;
  eventId: string;
  attendeeUserId?: string;
  scannerUserId: string;
  channel: "qr" | "code";
  result: "success" | "failure";
  reason: string;
};

type NotificationRateLimitInput = {
  action: "ticket_qr" | "general_update" | "event_change";
  eventId: string;
  initiatedBy: string;
  maxPerHour: number;
};

type NotificationLogInput = {
  action: "ticket_qr" | "general_update" | "event_change";
  eventId: string;
  initiatedBy: string;
  targetCount?: number;
};

type AttendanceRateLimitInput = {
  scannerUserId: string;
  eventId: string;
  maxAttempts: number;
  windowMs: number;
};

export async function logAttendanceAttempt({
  ticketCode,
  eventId,
  attendeeUserId = "",
  scannerUserId,
  channel,
  result,
  reason,
}: AttendanceLogInput) {
  try {
    const ticketCodeHash = createHash("sha256").update(ticketCode).digest("hex");
    await AttendanceAttempt.create({
      ticketCodeHash,
      ticketCodeSuffix: ticketCode.slice(-4),
      eventId,
      attendeeUserId,
      scannerUserId,
      channel,
      result,
      reason,
    });
  } catch (error) {
    console.error("Failed to log attendance attempt", error);
  }
}

export async function isNotificationRateLimited({
  action,
  eventId,
  initiatedBy,
  maxPerHour,
}: NotificationRateLimitInput) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const sentInWindow = await NotificationAudit.countDocuments({
    action,
    eventId,
    initiatedBy,
    createdAt: { $gte: oneHourAgo },
  });

  return sentInWindow >= maxPerHour;
}

export async function logNotificationAction({
  action,
  eventId,
  initiatedBy,
  targetCount = 1,
}: NotificationLogInput) {
  try {
    await NotificationAudit.create({
      action,
      eventId,
      initiatedBy,
      targetCount,
    });
  } catch (error) {
    console.error("Failed to log notification action", error);
  }
}

export async function isAttendanceRateLimited({
  scannerUserId,
  eventId,
  maxAttempts,
  windowMs,
}: AttendanceRateLimitInput) {
  const windowStart = new Date(Date.now() - windowMs);
  const attempts = await AttendanceAttempt.countDocuments({
    scannerUserId,
    eventId,
    createdAt: { $gte: windowStart },
  });

  return attempts >= maxAttempts;
}
