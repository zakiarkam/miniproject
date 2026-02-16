// middleware/authorize.js
export function authorize(requiredRole) {
  return (req, res, next) => {
    const user = req.user; // assume user is attached after authentication

    if (!user) {
      res.statusCode = 401;
      res.body = { error: "Unauthorized" };
      return;
    }

    // RBAC hierarchy
    const roleHierarchy = {
      admin: 3,
      organization: 2,
      user: 1,
    };

    const current = roleHierarchy[user.role] ?? 0;
    const needed = roleHierarchy[requiredRole] ?? 0;

    if (current < needed) {
      res.statusCode = 403;
      res.body = { error: "Forbidden: insufficient privileges" };
      return;
    }

    next();
  };
}