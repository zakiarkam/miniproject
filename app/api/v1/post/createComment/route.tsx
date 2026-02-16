import { NextRequest, NextResponse } from "next/server";
import connectMongoDB from "../../../../../lib/mongo/mongodb";

import Comment from "@/models/comment";
import { sanitizeText, sanitizeURL } from "../../../../../lib/security/sanitize";

export async function POST(req: NextRequest) {
  const { userId,userName, userImage, postId, description } = await req.json();


  await connectMongoDB();

  if (!userImage || !postId || !description || !userId || !userName) {
    return NextResponse.json(
      { message: "Please fill all the fields" },
      { status: 400 }
    );
  }

  // XSS Prevention - R4 Policy: Sanitize all text inputs for comments
  const sanitizedUserName = sanitizeText(userName);
  const sanitizedUserImage = sanitizeURL(userImage);
  const sanitizedDescription = sanitizeText(description);

  const comment = await Comment.create({
    userId,
    userName: sanitizedUserName,
    userImage: sanitizedUserImage,
    postId,
    description: sanitizedDescription,
  });

  return NextResponse.json(
    { message: "comment created successfully", comment: comment },
    { status: 201 }
  );
}
