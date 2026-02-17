import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/auth";
import connectMongoDB from "@/lib/mongo/mongodb";
import { transporter } from "@/config/nodemailer";
import BuyTicket from "@/models/buyTicket";
import User from "@/models/userModel";
import qrCode from "qrcode";
import {
  isNotificationRateLimited,
  logNotificationAction,
} from "@/lib/security/audit";
import { uploadToCloudinary } from "@/util/helper";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as any)?._id;

  if (!sessionUserId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const data = await req.json();
  const { ticketCode, eventId } = data;

  if (!ticketCode || !eventId) {
    return NextResponse.json({ message: "Invalid request payload" }, { status: 400 });
  }

  try {
    connectMongoDB();

    const user = await User.findById(sessionUserId).select("email");
    if (!user) {
      return NextResponse.json({ message: "No User exists" }, { status: 404 });
    }

    const ticket: any = await BuyTicket.findOne({
      eventId,
      userId: sessionUserId,
      ticketCode,
    }).populate("ticketId");

    if (!ticket) {
      return NextResponse.json({ message: "Ticket not found for user" }, { status: 403 });
    }

    const isLimited = await isNotificationRateLimited({
      action: "ticket_qr",
      eventId,
      initiatedBy: sessionUserId,
      maxPerHour: 20,
    });

    if (isLimited) {
      return NextResponse.json(
        { message: "Too many QR email requests. Try again later." },
        { status: 429 }
      );
    }

    const qrPayload = JSON.stringify({
      useId: sessionUserId,
      eventId,
      class: ticket?.ticketId?._id?.toString() || "",
      classType: ticket?.ticketId?.classType || "",
      ticketCode,
    });
    const qrImage = await qrCode.toDataURL(qrPayload);
    const image = await uploadToCloudinary(qrImage);

    const res = await transporter.sendMail({
      from: "eventsnow.project.ruchith@gmail.com",
      to: user.email,
      subject: "Payment Successful",
      text: "Payment successful. Here is your ticket QR code.",
      html: `<div>
      <img src="${image}" alt="ticket qr code" />
      <div>Your ticket code: ${ticketCode}</div>
      </div>`,
    });

    if (res.accepted.length > 0) {
      await logNotificationAction({
        action: "ticket_qr",
        eventId,
        initiatedBy: sessionUserId,
        targetCount: 1,
      });
      return NextResponse.json({ message: "Email sent successfully" });
    }

    return NextResponse.json({ message: "Email not accepted by provider" }, { status: 502 });
  } catch (error) {
    return NextResponse.json({ message: "server error" }, { status: 500 });
  }
}
