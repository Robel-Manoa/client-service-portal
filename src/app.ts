import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import { env } from "./config/env.config";

// API documentation
import swaggerUi from "swagger-ui-express";
import { generateOpenAPIDocument } from "./config/docs.config";

// Auth route imports
import { loginSchema } from "./delivery/schemas/auth.schema";

// Authentication/authorization middleware imports
import {
  authenticate,
  requireRole,
} from "./delivery/middlewares/auth.middleware";

// Request controller imports
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

// User controller imports
import {
  loginUser,
  createUser,
  getAllUser,
  getUserById,
  updateUser,
  deleteUser,
} from "./delivery/user.controller";

// Validation middleware and schema imports
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

// App setup

const app = express();

// Server security
// Enable Helmet
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin:
      env.NODE_ENV === "development"
        ? "*" // Allow everything in local development
        : `https://${env.URL_SITE}`,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  }),
);

// Per-IP rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later" },
});

app.use(limiter);

// Base middleware
// Lets the server parse JSON request bodies
app.use(express.json());

// OpenAPI / Swagger documentation
const openApiDocument = generateOpenAPIDocument();

// PUBLIC ROUTES
// Route to serve the raw OpenAPI document
app.get("/api-docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(openApiDocument);
});

// Interactive docs UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

// Route to check server health

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "UP",
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// Login route
app.post("/api/auth/login", validate(loginSchema), loginUser);

// PROTECTED ROUTES
// authenticate must ALWAYS run before requireRole: authenticate is what sets
// req.user from the token, requireRole only reads it back.

// Request CRUD routes
// GET filters by role at the controller level: client -> their own,
// engineer -> requests assigned to them, admin -> all of them.
app.get("/api/requests", authenticate, getAllRequests);
app.get("/api/requests/:id", authenticate, getRequestById);
// Creation is client-only: they're the ones filing requests, not staff.
app.post(
  "/api/requests",
  authenticate,
  requireRole("client"),
  validate(createRequestSchema),
  createRequest,
);
// Update the CONTENT (title/description/priority): owner or staff,
// checked in the controller.
app.put(
  "/api/requests/:id",
  authenticate,
  validate(updateRequestSchema),
  updateRequest,
);
// Change the STATUS, with per-role transition rules (see controller):
// never for clients, open->resolved only for engineers, any for admins.
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

// Assign an engineer to a request (admin-only)
app.post(
  "/api/requests/:id/assignments",
  authenticate,
  requireRole("admin"),
  validate(assignEngineerSchema),
  assignEngineer,
);

// Comments on a request: open to any authenticated user, filtering
// (ownership/visibility) is handled in the controller.
app.get("/api/requests/:id/comments", authenticate, getComments);
app.post(
  "/api/requests/:id/comments",
  authenticate,
  validate(createCommentSchema),
  createComment,
);

// User CRUD routes
// Admin-only: engineers don't need the full user directory to do their job
// on requests.
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
// Admin-only, including for one's own profile: no self-service.
app.patch(
  "/api/users/:id",
  authenticate,
  requireRole("admin"),
  validate(updateUserSchema),
  updateUser,
);
app.delete("/api/users/:id", authenticate, requireRole("admin"), deleteUser);

// Error handling
// Catch-all for routes that don't exist

app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({
    error: "Resource not found",
  });
});

// Global error handler
// Safety net: catches unexpected errors so the server doesn't crash, and
// returns a generic error response instead.

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("[Server Error]:", err.stack);
  res.status(500).json({
    error: "An internal server error occurred",
  });
});

// app.listen() happens in server.ts, not here: this lets tests import
// `app` without opening a real port.
export default app;
