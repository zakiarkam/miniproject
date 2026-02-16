import { getServerSession } from "next-auth";

export async function secureSession(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) throw new Error("Unauthorized");

  // enforce expiry
  if (Date.now() > new Date(session.expires).getTime()) {
    throw new Error("Session expired");
  }
}