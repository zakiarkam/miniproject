import connectMongoDB from "@/lib/mongo/mongodb";
import Attendant from "@/models/attendees";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/auth";
import { authorizeEventAction } from "@/lib/security/eventAuthorization";

const ATTENDANCE_VIEW_PERMISSIONS = ["Mark Attendance", "Manage Event"];

export const GET = async (
  req: Request,
  { params }: { params: { id: string | string[] } }
) => {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as any)?._id;
  const sessionUserRole = (session?.user as any)?.role;

  if (!sessionUserId) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  connectMongoDB();
  try {
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const authResult = await authorizeEventAction({
      eventId: id,
      userId: sessionUserId,
      userRole: sessionUserRole,
      requiredPermissions: ATTENDANCE_VIEW_PERMISSIONS,
    });

    if (!authResult.allowed) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const attendant = await Attendant.find({ eventId: id });

    return NextResponse.json({ success: true, data: attendant.length });
  } catch (error) {
    return NextResponse.json({ success: false, message: "server error" }, { status: 500 });
  }
};
