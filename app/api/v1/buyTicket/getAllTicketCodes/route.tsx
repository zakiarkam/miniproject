import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongo/mongodb";
import { authOptions } from "@/lib/auth/auth";
import BuyTicket from "@/models/buyTicket";

export const GET = async () => {
  const session = await getServerSession(authOptions);
  const sessionUserRole = (session?.user as any)?.role;

  if (!session || sessionUserRole !== "admin") {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  connectMongoDB();
  try {
    const allTicketCodes = await BuyTicket.distinct("ticketCode");
    return NextResponse.json({ success: true, data: allTicketCodes });
  } catch (error) {
    return NextResponse.json({ success: false, message: "server error" }, { status: 500 });
  }
};
