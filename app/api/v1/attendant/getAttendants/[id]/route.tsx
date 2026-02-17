export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import connectMongoDB from "@/lib/mongo/mongodb";
import Attendant from "@/models/attendees";
import { authOptions } from "@/lib/auth/auth";
import { authorizeEventAction } from "@/lib/security/eventAuthorization";

const ATTENDANCE_VIEW_PERMISSIONS = ["Mark Attendance", "Manage Event"];

type Params = {
  id: string;
};

export async function GET(request: Request, { params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as any)?._id;
  const sessionUserRole = (session?.user as any)?.role;

  if (!sessionUserId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const id = params.id;

    await connectMongoDB();

    const authResult = await authorizeEventAction({
      eventId: id,
      userId: sessionUserId,
      userRole: sessionUserRole,
      requiredPermissions: ATTENDANCE_VIEW_PERMISSIONS,
    });

    if (!authResult.allowed) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const attendanceDocument = await Attendant.find({ eventId: id }).populate(
      "userId"
    );
    if (!attendanceDocument || attendanceDocument.length === 0) {
      return NextResponse.json([]);
    }
    return NextResponse.json(attendanceDocument);
  } catch (error) {
    return new NextResponse("Errror in fetching data" + error, { status: 500 });
  }
}
