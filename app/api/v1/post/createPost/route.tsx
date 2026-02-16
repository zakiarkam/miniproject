import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "../../../../../lib/mongo/mongodb";
import Post from "@/models/post";
import { sanitizeText, sanitizeURL } from "../../../../../lib/security/sanitize";

export async function POST(req: NextRequest) {
  try {
    const { userName, userImage, eventId, description, image } =
      await req.json();
    if (!userName || !userImage || !eventId || !description || !image) {
      return NextResponse.json(
        { message: "Please fill all the fields" },
        { status: 400 }
      );
    }

    // XSS Prevention - R4 Policy: Sanitize all text inputs for community posts
    const sanitizedUserName = sanitizeText(userName);
    const sanitizedUserImage = sanitizeURL(userImage);
    const sanitizedDescription = sanitizeText(description);
    const sanitizedImage = sanitizeURL(image);

    connectMongoDB();
    await Post.create({
      userName: sanitizedUserName,
      userImage: sanitizedUserImage,
      eventId,
      description: sanitizedDescription,
      image: sanitizedImage,
    });
    return NextResponse.json(
      { message: "Post Created Successfully" },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json(
      { message: " server Error Failed to create post" },
      { status: 500 }
    );
  }
}
