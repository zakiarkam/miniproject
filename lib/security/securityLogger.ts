export interface SecurityEvent {
  userId?: string;
  organizationId?: string;
  eventId?: string;
  eventType: string;
  action: string;
  resource?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export function logSecurityEvent(event: SecurityEvent): void {
  const logEntry = {
    ...event,
    timestamp: event.timestamp.toISOString(),
    level: "security",
  };

  console.log("[SECURITY EVENT]", JSON.stringify(logEntry, null, 2));
}

export function logContentEvent(params: {
  userId: string;
  organizationId: string;
  eventId: string;
  hostPageType: "template" | "pageBuilder" | "uploadPage";
  s3Key?: string;
  action: "create" | "update" | "delete";
  ipAddress?: string;
  userAgent?: string;
}): void {
  logSecurityEvent({
    userId: params.userId,
    organizationId: params.organizationId,
    eventId: params.eventId,
    eventType: "CONTENT_MANAGEMENT",
    action: params.action.toUpperCase(),
    resource: `${params.hostPageType}${params.s3Key ? `:${params.s3Key}` : ""}`,
    details: {
      hostPageType: params.hostPageType,
      s3Key: params.s3Key,
    },
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    timestamp: new Date(),
  });
}

/**
 * Logs XSS prevention events (sanitization, blocked uploads, etc.)
 */
export function logXSSPreventionEvent(params: {
  userId?: string;
  action: string;
  blocked: boolean;
  reason?: string;
  endpoint: string;
  ipAddress?: string;
  userAgent?: string;
}): void {
  logSecurityEvent({
    userId: params.userId,
    eventType: "XSS_PREVENTION",
    action: params.action,
    resource: params.endpoint,
    details: {
      blocked: params.blocked,
      reason: params.reason,
    },
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    timestamp: new Date(),
  });
}

/**
 * Extracts IP address from request headers
 */
export function getClientIP(headers: Headers): string | undefined {
  return (
    headers.get("x-forwarded-for")?.split(",")[0] ||
    headers.get("x-real-ip") ||
    undefined
  );
}

export function getUserAgent(headers: Headers): string | undefined {
  return headers.get("user-agent") || undefined;
}
