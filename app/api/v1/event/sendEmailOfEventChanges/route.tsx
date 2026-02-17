import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/auth";
import connectMongoDB from "@/lib/mongo/mongodb";
import { transporter } from "@/config/nodemailer";
import Event from "@/models/eventModel";
import { authorizeEventAction } from "@/lib/security/eventAuthorization";
import {
  isNotificationRateLimited,
  logNotificationAction,
} from "@/lib/security/audit";

type RegisterUser = {
  email: string;
  eventUpdates: boolean;
};

const EVENT_UPDATE_PERMISSIONS = ["Manage Event"];

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as any)?._id;
  const sessionUserRole = (session?.user as any)?.role;

  if (!sessionUserId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { eventId } = await req.json();
  if (!eventId) {
    return NextResponse.json({ message: "Invalid request payload" }, { status: 400 });
  }

  try {
    connectMongoDB();

    const authResult = await authorizeEventAction({
      eventId,
      userId: sessionUserId,
      userRole: sessionUserRole,
      requiredPermissions: EVENT_UPDATE_PERMISSIONS,
    });

    if (!authResult.allowed) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const isLimited = await isNotificationRateLimited({
      action: "event_change",
      eventId,
      initiatedBy: sessionUserId,
      maxPerHour: 5,
    });

    if (isLimited) {
      return NextResponse.json(
        { message: "Rate limit exceeded for event update emails" },
        { status: 429 }
      );
    }

    const event: any = await Event.findById(eventId).populate("registerUser");
    if (!event) {
      return NextResponse.json({ message: "No event" }, { status: 404 });
    }

    const usersEmail = event.registerUser
      .filter((user: RegisterUser) => user.eventUpdates)
      .map((user: RegisterUser) => user.email)
      .filter((email: string) => Boolean(email));

    if (usersEmail.length === 0) {
      return NextResponse.json({ message: "No users registered for the event" });
    }

    const eventTitle = event.eventName || "Your event";
    const dateRange = `${event.eventStartDate || ""} - ${event.eventEndDate || ""}`;

    const res = await transporter.sendMail({
      from: "eventsnow.project.ruchith@gmail.com",
      to: usersEmail,
      subject: "Event details updated",
      text: "Event details were updated. Please review the latest event information.",
      html: `<div>
        <h2>${eventTitle} was updated</h2>
        <p>Date: ${dateRange}</p>
        <p>Location: ${event.eventLocation || "N/A"}</p>
        <p>Start time: ${event.startTime || "N/A"}</p>
        <p>End time: ${event.endTime || "N/A"}</p>
      </div>`,
    });

    if (res.accepted.length > 0) {
      await logNotificationAction({
        action: "event_change",
        eventId,
        initiatedBy: sessionUserId,
        targetCount: usersEmail.length,
      });
      return NextResponse.json({ message: "Email sent successfully" });
    }

    return NextResponse.json({ message: "Email not accepted by provider" }, { status: 502 });
  } catch (error) {
    return NextResponse.json({ message: "server error" }, { status: 500 });
  }
}
