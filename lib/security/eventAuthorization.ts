import { Types } from "mongoose";
import Event from "@/models/eventModel";
import Permission from "@/models/permissionModel";

type AuthorizationInput = {
  eventId: string;
  userId: string;
  userRole?: string;
  requiredPermissions: string[];
};

type AuthorizationResult = {
  allowed: boolean;
  reason: string;
  event?: any;
};

function hasPermission(permissionDoc: any, eventId: string, required: string[]) {
  const globalPermissions: string[] = permissionDoc?.globalPermission || [];

  if (globalPermissions.includes("allPermission")) {
    return true;
  }

  if (required.some((permission) => globalPermissions.includes(permission))) {
    return true;
  }

  const eventPermissionEntry = (permissionDoc?.eventPermission || []).find(
    (entry: any) => entry?.eventId?.toString() === eventId
  );
  const eventPermissions: string[] = eventPermissionEntry?.eventPermission || [];

  return required.some((permission) => eventPermissions.includes(permission));
}

export async function authorizeEventAction({
  eventId,
  userId,
  userRole,
  requiredPermissions,
}: AuthorizationInput): Promise<AuthorizationResult> {
  if (!eventId || !Types.ObjectId.isValid(eventId)) {
    return { allowed: false, reason: "INVALID_EVENT_ID" };
  }

  const event = await Event.findById(eventId).select("organizationId");
  if (!event) {
    return { allowed: false, reason: "EVENT_NOT_FOUND" };
  }

  if (userRole === "admin") {
    return { allowed: true, reason: "ALLOWED_ADMIN", event };
  }

  const permissionDoc = await Permission.findOne({
    userId,
    organizationId: event.organizationId?.toString(),
  });

  if (!permissionDoc) {
    return { allowed: false, reason: "PERMISSION_NOT_FOUND", event };
  }

  if (hasPermission(permissionDoc, eventId, requiredPermissions)) {
    return { allowed: true, reason: "ALLOWED_PERMISSION", event };
  }

  return { allowed: false, reason: "INSUFFICIENT_PERMISSION", event };
}
