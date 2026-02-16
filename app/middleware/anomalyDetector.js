// middleware/anomalyDetector.js
export function anomalyDetector(req, _res, next) {
  const user = req.user;
  if (user && user.role === "user" && req.originalUrl.startsWith("/admin")) {
    console.warn(
      `ALERT: Unauthorized access attempt by User ${user.id} to ${req.originalUrl}`
    );
  }
  next();
}