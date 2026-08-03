// Extension de l'interface Request d'express pour que typescript 
// comprenne que nos requêtes authentifiées possèdent la propriété user

import { UserRole } from "../core/types";

declare global {
  namespace Express {
    interface Request {
      // Ajout de notre objet user
      user?: { id: string; role: UserRole; email: string };
    }
  }
}
