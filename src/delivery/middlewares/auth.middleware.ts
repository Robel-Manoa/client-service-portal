import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.config";
import { UserRole } from "../../core/types";

interface JwtPayloadCustom {
  sub: string;
  role: UserRole;
  email: string;
}

// JWT verification (authentication)
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Read the Authorization header (expected format: "Bearer <token>")
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer")) {
    res.status(401).json({ error: "Access denied. Missing token" });
    return;
  }

  // Extract the token
  const token = authHeader.split(" ")[1];

  // Verify the signature
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayloadCustom;

    req.user = {
      id: decoded.sub,
      role: decoded.role,
      email: decoded.email,
    };

    next(); // proceed once authentication succeeds
  } catch (error) {
    console.error("[Auth] Token verification failed:", error);
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
};

// Role check (RBAC)
export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    // Check that the logged-in user's role is authorized
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    next();
  };
};
