import { Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongo/mongodb";
import { authOptions } from "@/lib/auth/auth";
import Attendant from "@/models/attendees";
import BuyTicket from "@/models/buyTicket";
import { authorizeEventAction } from "@/lib/security/eventAuthorization";
import {
  isAttendanceRateLimited,
  logAttendanceAttempt,
} from "@/lib/security/audit";

const ATTENDANCE_PERMISSIONS = ["Mark Attendance", "Manage Event"];

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const scannerUserId = (session?.user as any)?._id;
  const scannerRole = (session?.user as any)?.role;

  if (!scannerUserId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { eventId, ticketCode } = await req.json();
  if (!eventId || !ticketCode || typeof ticketCode !== "string") {
    return NextResponse.json({ message: "Invalid request payload" }, { status: 400 });
  }
  if (!/^\d{8}$/.test(ticketCode)) {
    return NextResponse.json({ message: "invalid ticket code" }, { status: 200 });
  }

  try {
    connectMongoDB();

    const authResult = await authorizeEventAction({
      eventId,
      userId: scannerUserId,
      userRole: scannerRole,
      requiredPermissions: ATTENDANCE_PERMISSIONS,
    });

    if (!authResult.allowed) {
      await logAttendanceAttempt({
        ticketCode,
        eventId,
        scannerUserId,
        channel: "qr",
        result: "failure",
        reason: `unauthorized_${authResult.reason.toLowerCase()}`,
      });
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const isRateLimited = await isAttendanceRateLimited({
      scannerUserId,
      eventId,
      maxAttempts: 60,
      windowMs: 60 * 1000,
    });

    if (isRateLimited) {
      await logAttendanceAttempt({
        ticketCode,
        eventId,
        scannerUserId,
        channel: "qr",
        result: "failure",
        reason: "rate_limited",
      });
      return NextResponse.json(
        { message: "Too many attendance attempts. Try again shortly." },
        { status: 429 }
      );
    }

    const ticketDetails: any = await BuyTicket.findOne({
      eventId,
      ticketCode,
    }).populate("ticketId");

    if (!ticketDetails) {
      await logAttendanceAttempt({
        ticketCode,
        eventId,
        scannerUserId,
        channel: "qr",
        result: "failure",
        reason: "invalid_ticket_code",
      });
      return NextResponse.json({ message: "invalid ticket code" }, { status: 200 });
    }

    if (["cancelled", "refunded"].includes(ticketDetails.status)) {
      await logAttendanceAttempt({
        ticketCode,
        eventId,
        attendeeUserId: ticketDetails.userId?.toString(),
        scannerUserId,
        channel: "qr",
        result: "failure",
        reason: "invalid_ticket_status",
      });
      return NextResponse.json(
        { message: "Ticket is not valid for attendance" },
        { status: 200 }
      );
    }

    const updatedTicket = await BuyTicket.findOneAndUpdate(
      {
        _id: ticketDetails._id,
        isAttendentMarked: false,
      },
      {
        $set: { isAttendentMarked: true },
      },
      { new: true }
    );

    if (!updatedTicket) {
      await logAttendanceAttempt({
        ticketCode,
        eventId,
        attendeeUserId: ticketDetails.userId?.toString(),
        scannerUserId,
        channel: "qr",
        result: "failure",
        reason: "ticket_already_marked",
      });
      return NextResponse.json(
        { message: "This ticket is  Already Marked" },
        { status: 200 }
      );
    }

    const ticketOwnerId = ticketDetails.userId?.toString() || "";
    if (!Types.ObjectId.isValid(ticketOwnerId)) {
      await logAttendanceAttempt({
        ticketCode,
        eventId,
        scannerUserId,
        channel: "qr",
        result: "failure",
        reason: "invalid_ticket_owner",
      });
      return NextResponse.json({ message: "invalid ticket code" }, { status: 200 });
    }

    const ticketType = ticketDetails?.ticketId?.classType || "Unknown";

    const attendant = await Attendant.findOneAndUpdate(
      {
        eventId: ticketDetails.eventId,
        userId: ticketOwnerId,
      },
      {
        $setOnInsert: {
          ticketType,
          eventId: ticketDetails.eventId,
          userId: ticketOwnerId,
        },
      },
      { new: true, upsert: true }
    );

    await logAttendanceAttempt({
      ticketCode,
      eventId,
      attendeeUserId: ticketOwnerId,
      scannerUserId,
      channel: "qr",
      result: "success",
      reason: "attendance_marked",
    });

    return NextResponse.json(attendant, { status: 201 });
  } catch (error) {
    await logAttendanceAttempt({
      ticketCode,
      eventId,
      scannerUserId,
      channel: "qr",
      result: "failure",
      reason: "server_error",
    });
    return NextResponse.json({ message: "server error" }, { status: 500 });
  }
}
