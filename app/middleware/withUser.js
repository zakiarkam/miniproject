// middleware/withUser.js
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function attachUser(req) {
  const session = await getServerSession(authOptions);
  if (session?.user?._id && session.user.role) {
    req.user = {
      id: session.user._id,
      role: normalizeRole(session.user.role),
    };
  } else {
    req.user = undefined;
  }
}

function normalizeRole(role) {
  // Map your roles to those used in the simple RBAC hierarchy
  // e.g., "superadmin" => "admin"
  if (role === "superadmin") return "admin";
  if (role === "organization") return "organization";
  if (role === "user") return "user";
  // default fallback
  return "user";
}