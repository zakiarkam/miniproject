import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { validateHTMLUpload } from "@/lib/security/sanitize";
import { logXSSPreventionEvent, getClientIP, getUserAgent } from "@/lib/security/securityLogger";

const s3Client = new S3Client({
  region: process.env.NEXT_PUBLIC_AWS_S3_REGION,
  credentials: {
    accessKeyId: process.env.NEXT_PUBLIC_AWS_S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.NEXT_PUBLIC_AWS_S3_SECRET_ACCESS_KEY || "",
  },
});

async function uploadFileToS3(file: Buffer, fileName: string): Promise<string> {
  const fileBuffer = file;

  const params = {
    Bucket: process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME || "",
    Key: `uploadPage/${fileName}`,
    Body: fileBuffer,
    ContentType: "text/html",
  };

  const command = new PutObjectCommand(params);
  await s3Client.send(command);

  const objectUrl = `https://${process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME}.s3.${process.env.NEXT_PUBLIC_AWS_S3_REGION}.amazonaws.com/uploadPage/${fileName}`;

  return objectUrl;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file found" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const htmlContent = buffer.toString("utf-8");

    // XSS Prevention - R4 Policy: Sanitize HTML before uploading to S3
    // User-uploaded HTML must not contain scripts or dangerous content
    const validation = validateHTMLUpload(htmlContent, false);

    if (validation.hasScripts || validation.hasDangerousContent) {
      // Log security violation
      logXSSPreventionEvent({
        action: "HTML_UPLOAD_BLOCKED",
        blocked: true,
        reason: `hasScripts: ${validation.hasScripts}, hasDangerousContent: ${validation.hasDangerousContent}`,
        endpoint: "/api/v1/aws/s3-upload/uploadPage",
        ipAddress: getClientIP(request.headers),
        userAgent: getUserAgent(request.headers),
      });

      return NextResponse.json(
        {
          error: "Security violation: Uploaded HTML contains prohibited scripts or dangerous content",
          details: {
            hasScripts: validation.hasScripts,
            hasDangerousContent: validation.hasDangerousContent,
          },
        },
        { status: 400 }
      );
    }

    // Upload sanitized HTML
    const sanitizedBuffer = Buffer.from(validation.sanitized, "utf-8");
    const objectUrl = await uploadFileToS3(sanitizedBuffer, file.name);

    // Log successful sanitization
    logXSSPreventionEvent({
      action: "HTML_UPLOAD_SANITIZED",
      blocked: false,
      endpoint: "/api/v1/aws/s3-upload/uploadPage",
      ipAddress: getClientIP(request.headers),
      userAgent: getUserAgent(request.headers),
    });

    return NextResponse.json({ success: true, objectUrl });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
