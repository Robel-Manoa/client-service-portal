// Extends Express's Request interface so TypeScript knows our authenticated
// requests carry a `user` property

import { UserRole } from "../core/types";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: UserRole; email: string };
    }
  }
}
