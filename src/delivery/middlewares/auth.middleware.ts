import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.config";
import { UserRole } from "../../core/types";

interface JwtPayloadCustom {
  sub: string;
  role: UserRole;
  email: string;
}

// Vérification du TOKEN JWT (authentification)
export const authentificate = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Récupération du header Authorization (Format attendu : "Bearer <token>")
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer")) {
    res.status(401).json({ error: "Accès refusé. Token innexistant" });
    return;
  }

  // Extraction du TOKEN
  const token = authHeader.split(" ")[1];

  // Vérification de la signature
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayloadCustom;

    req.user = {
      id: decoded.sub,
      role: decoded.role,
      email: decoded.email,
    };

    next(); // on passe une fois l'authentification réussi
  } catch (error) {
    console.error("[Auth] Vérification du token échouée:", error);
    res.status(401).json({ error: "TOKEN invalide ou expiré" });
    return;
  }
};

// Vérification des rôles (système RBAC)
export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "utilisateur non authentifié" });
      return;
    }

    // Vérification des autorisations pour le rôle de l'utilisateur connecter
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: "Accès non autorisé" });
      return;
    }

    next();
  };
};
