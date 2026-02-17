import { randomInt } from "crypto";
import { Types } from "mongoose";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongo/mongodb";
import { authOptions } from "@/lib/auth/auth";
import BuyTicket from "@/models/buyTicket";
import TicketType from "@/models/ticketType";

async function generateUniqueTicketCode() {
  const maxAttempts = 20;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = randomInt(10000000, 100000000).toString();
    const exists = await BuyTicket.exists({ ticketCode: code });
    if (!exists) {
      return code;
    }
  }

  throw new Error("FAILED_TO_GENERATE_TICKET_CODE");
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as any)?._id;
  const sessionUserRole = (session?.user as any)?.role;

  if (!sessionUserId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { ticketId, eventId, userId } = await req.json();
  const resolvedTicketId = typeof ticketId === "string" ? ticketId : ticketId?.typeId;

  if (!resolvedTicketId || !eventId || !userId) {
    return NextResponse.json({ message: "Invalid request payload" }, { status: 400 });
  }

  if (sessionUserRole !== "admin" && sessionUserId !== userId) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  if (!Types.ObjectId.isValid(resolvedTicketId) || !Types.ObjectId.isValid(eventId)) {
    return NextResponse.json({ message: "Invalid ticket or event id" }, { status: 400 });
  }

  try {
    connectMongoDB();

    const ticketType = await TicketType.findOne({
      _id: resolvedTicketId,
      eventId,
    });

    if (!ticketType) {
      return NextResponse.json({ message: "Invalid ticket type for event" }, { status: 400 });
    }

    const ticketCode = await generateUniqueTicketCode();

    const buyTicket = await BuyTicket.create({
      ticketId: resolvedTicketId,
      eventId,
      userId,
      ticketCode,
      status: "active",
    });

    if (!buyTicket) {
      return NextResponse.json(
        { message: "user buy ticket Failed,try again" },
        { status: 400 }
      );
    }

    const updatedTicketCount = await TicketType.findByIdAndUpdate(resolvedTicketId, {
      $inc: { count: 1 },
    });

    if (!updatedTicketCount) {
      return NextResponse.json(
        { message: "ticket count update Failed,try again" },
        { status: 400 }
      );
    }

    return NextResponse.json({ buyTicket, ticketCode }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: "server error" }, { status: 500 });
  }
}
