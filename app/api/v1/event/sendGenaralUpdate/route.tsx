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
  marketingUpdates: boolean;
};

const CAMPAIGN_PERMISSIONS = ["Manage Marketing Campaign", "Manage Event"];

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as any)?._id;
  const sessionUserRole = (session?.user as any)?.role;

  if (!sessionUserId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { subject, message, eventId } = await req.json();

  if (!subject || !message || !eventId) {
    return NextResponse.json({ message: "Invalid request payload" }, { status: 400 });
  }

  if (subject.length > 120 || message.length > 2000) {
    return NextResponse.json(
      { message: "Subject or message is too long" },
      { status: 400 }
    );
  }

  try {
    connectMongoDB();

    const authResult = await authorizeEventAction({
      eventId,
      userId: sessionUserId,
      userRole: sessionUserRole,
      requiredPermissions: CAMPAIGN_PERMISSIONS,
    });

    if (!authResult.allowed) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const isLimited = await isNotificationRateLimited({
      action: "general_update",
      eventId,
      initiatedBy: sessionUserId,
      maxPerHour: 5,
    });

    if (isLimited) {
      return NextResponse.json(
        { message: "Rate limit exceeded for update emails" },
        { status: 429 }
      );
    }

    const event: any = await Event.findById(eventId).populate("registerUser");
    if (!event) {
      return NextResponse.json({ message: "No event" }, { status: 404 });
    }

    const usersEmail = event.registerUser
      .filter((user: RegisterUser) => user.marketingUpdates)
      .map((user: RegisterUser) => user.email)
      .filter((email: string) => Boolean(email));

    if (usersEmail.length === 0) {
      return NextResponse.json({ message: "No users registered for the event" });
    }

    const res = await transporter.sendMail({
      from: "eventsnow.project.ruchith@gmail.com",
      to: usersEmail,
      subject: subject.trim(),
      html: `<h1>${escapeHtml(message.trim())}</h1>`,
    });

    if (res.accepted.length > 0) {
      await logNotificationAction({
        action: "general_update",
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
