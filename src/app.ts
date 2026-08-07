import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import { env } from "./config/env.config";

import swaggerUi from "swagger-ui-express";
import { generateOpenAPIDocument } from "./config/docs.config";

import { loginSchema } from "./delivery/schemas/auth.schema";

import {
  authenticate,
  requireRole,
} from "./delivery/middlewares/auth.middleware";

import {
  getAllRequests,
  getRequestById,
  createRequest,
  updateRequest,
  updateRequestStatus,
  assignEngineer,
  getComments,
  createComment,
  deleteRequest,
} from "./delivery/request.controller";

import {
  loginUser,
  createUser,
  getAllUser,
  getUserById,
  updateUser,
  deleteUser,
} from "./delivery/user.controller";

import { validate } from "./delivery/middlewares/validate.middleware";
import {
  createUserSchema,
  updateUserSchema,
} from "./delivery/schemas/user.schema";
import {
  createRequestSchema,
  updateRequestSchema,
  updateRequestStatusSchema,
  assignEngineerSchema,
} from "./delivery/schemas/request.schema";
import { createCommentSchema } from "./delivery/schemas/comment.schema";

const app = express();

app.use(helmet());

app.use(
  cors({
    origin:
      env.NODE_ENV === "development"
        ? "*" // wide open locally, real origin only in prod
        : `https://${env.URL_SITE}`,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  }),
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later" },
});

app.use(limiter);
app.use(express.json());

const openApiDocument = generateOpenAPIDocument();

app.get("/api-docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(openApiDocument);
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "UP",
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/auth/login", validate(loginSchema), loginUser);

// From here down, every route needs a token. authenticate has to come
// before requireRole on each one — it's what sets req.user, requireRole
// just reads it back and would 401 everything if it ran first.

// GET filters results by role in the controller itself (client -> own,
// engineer -> assigned, admin -> everything) rather than at the route level.
app.get("/api/requests", authenticate, getAllRequests);
app.get("/api/requests/:id", authenticate, getRequestById);
// Clients file requests, staff don't.
app.post(
  "/api/requests",
  authenticate,
  requireRole("client"),
  validate(createRequestSchema),
  createRequest,
);
// Title/description/priority — owner or staff, checked in the controller.
app.put(
  "/api/requests/:id",
  authenticate,
  validate(updateRequestSchema),
  updateRequest,
);
// Status is separate from the PUT above because the transition rules differ
// per role (see the controller) — clients can't touch it at all.
app.patch(
  "/api/requests/:id",
  authenticate,
  validate(updateRequestStatusSchema),
  updateRequestStatus,
);
app.delete(
  "/api/requests/:id",
  authenticate,
  requireRole("admin"),
  deleteRequest,
);

app.post(
  "/api/requests/:id/assignments",
  authenticate,
  requireRole("admin"),
  validate(assignEngineerSchema),
  assignEngineer,
);

// Any authenticated user can hit these — who sees what (ownership,
// public vs. internal) is sorted out in the controller.
app.get("/api/requests/:id/comments", authenticate, getComments);
app.post(
  "/api/requests/:id/comments",
  authenticate,
  validate(createCommentSchema),
  createComment,
);

// Admin-only across the board — engineers don't need the full user
// directory to do their job on requests.
app.get("/api/users", authenticate, requireRole("admin"), getAllUser);
app.get(
  "/api/users/:id",
  authenticate,
  requireRole("admin", "engineer"),
  getUserById,
);
app.post(
  "/api/users",
  authenticate,
  requireRole("admin"),
  validate(createUserSchema),
  createUser,
);
// No self-service, even for your own profile.
app.patch(
  "/api/users/:id",
  authenticate,
  requireRole("admin"),
  validate(updateUserSchema),
  updateUser,
);
app.delete("/api/users/:id", authenticate, requireRole("admin"), deleteUser);

app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({
    error: "Resource not found",
  });
});

// Last-resort handler so an unhandled error doesn't take the whole
// process down.
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("[Server Error]:", err.stack);
  res.status(500).json({
    error: "An internal server error occurred",
  });
});

// No .listen() here — see server.ts. Keeps this file importable in tests.
export default app;
