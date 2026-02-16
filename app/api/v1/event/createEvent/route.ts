import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "../../../../../lib/mongo/mongodb";
import Event from "../../../../../models/eventModel";
import { sanitizeText, sanitizeURL } from "../../../../../lib/security/sanitize";

export async function POST(req: NextRequest) {
  const {
    eventName,
    selectedTab,
    eventLocation,
    eventStartDate,
    startTime,
    description,
    coverImage,
    dashboardImage,
    organizationId,
    eventEndDate,
    endTime,
  } = await req.json();

  // XSS Prevention - R4 Policy: Sanitize all text inputs
  const sanitizedEventName = sanitizeText(eventName);
  const sanitizedEventLocation = sanitizeText(eventLocation);
  const sanitizedDescription = sanitizeText(description);
  const sanitizedCoverImage = sanitizeURL(coverImage);
  const sanitizedDashboardImage = sanitizeURL(dashboardImage);

  connectMongoDB();
  const event = await Event.create({
    eventName: sanitizedEventName,
    selectedTab,
    eventLocation: sanitizedEventLocation,
    eventStartDate,
    startTime,
    description: sanitizedDescription,
    coverImage: sanitizedCoverImage,
    dashboardImage: sanitizedDashboardImage,
    organizationId,
    eventEndDate,
    endTime,
  });


  if (!event) {
    return NextResponse.json(
      { message: "Event Creation Failed" },
      { status: 400 }
    );
  }
  return NextResponse.json({ event }, { status: 201 });
}
