// middleware/accessLogger.js
export function accessLogger(req, _res, next) {
  const user = req.user || { id: "anonymous", role: "none" };
  // In Next.js you can replace console.log with your own logging service later
  console.log({
    type: "access_log",
    userId: user.id,
    role: user.role,
    resource: req.originalUrl,
    action: req.method,
    timestamp: new Date().toISOString(),
  });
  next();
}
``