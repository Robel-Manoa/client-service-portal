// OpenAPI document: API info, security schemes, and every route definition.

import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";
import {
  UserSchema,
  createUserSchema,
  updateUserSchema,
} from "../delivery/schemas/user.schema";
import { loginSchema } from "./../delivery/schemas/auth.schema";
import { z } from "zod";
import {
  requestSchema,
  createRequestSchema,
  updateRequestSchema,
  updateRequestStatusSchema,
  assignEngineerSchema,
} from "../delivery/schemas/request.schema";
import {
  commentSchema,
  createCommentSchema,
} from "../delivery/schemas/comment.schema";

// ":id" path parameter, reused across every /xxx/:id route
const idParam = (example: string) =>
  z.object({ id: z.string().openapi({ example }) });

// Fixed example ids used throughout: one representative user, one
// representative request, so every {id} param shows a realistic value in
// the docs instead of a different placeholder per route.
const USER_ID_EXAMPLE = "8f14e45f-ceea-4c9c-8f1e-000000000001";
const REQUEST_ID_EXAMPLE = "8f14e45f-ceea-4c9c-8f1e-000000000010";

export const registry = new OpenAPIRegistry();

const bearerAuth = registry.registerComponent("securitySchemes", "BearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description: "Enter the JWT token as: Bearer <token>",
});

// Every route below except login needs a token — written once instead of
// repeating this array literal at each of the 13 registerPath calls.
const AUTH_REQUIRED = [{ [bearerAuth.name]: [] }];

// The handful of response shapes that recur across almost every route,
// so registerPath calls below reference one shared object instead of
// retyping the same {description} literal a dozen times.
const NOT_AUTHENTICATED = { description: "Not authenticated" };
const ACCESS_DENIED = { description: "Access denied" };
const INVALID_DATA = { description: "Invalid data" };
const notFound = (resource: string) => ({ description: `${resource} not found` });

// Wraps a schema as the request/response `content` shape zod-to-openapi
// expects — every body and every 2xx response with a payload needs this
// exact structure.
function jsonBody(schema: z.ZodTypeAny) {
  return { content: { "application/json": { schema } } };
}

function successResponse(description: string, schema: z.ZodTypeAny) {
  return { description, ...jsonBody(schema) };
}

// Auth routes
registry.registerPath({
  method: "post",
  path: "/api/auth/login",
  summary: "User login",
  description:
    "Authenticates a user and returns a JWT token valid for 2 hours",
  request: { body: jsonBody(loginSchema.shape.body) },
  responses: {
    200: successResponse(
      "Login successful",
      z.object({ token: z.string().openapi({ example: "eyoinyziryoezyrno..." }) }),
    ),
    400: INVALID_DATA,
    404: { description: "Incorrect credentials" },
  },
});

// User routes
registry.registerPath({
  method: "get",
  path: "/api/users",
  summary: "List all users",
  description: "List of every user, admin-only",
  security: AUTH_REQUIRED,
  responses: {
    200: successResponse("Users retrieved successfully", z.array(UserSchema)),
    401: NOT_AUTHENTICATED,
    403: ACCESS_DENIED,
    404: notFound("Data"),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/users/{id}",
  summary: "Get a user by ID",
  description: "Restricted to the admin and engineer roles",
  security: AUTH_REQUIRED,
  request: { params: idParam(USER_ID_EXAMPLE) },
  responses: {
    200: successResponse("User retrieved successfully", UserSchema),
    401: NOT_AUTHENTICATED,
    403: ACCESS_DENIED,
    404: notFound("User"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/users",
  summary: "Create a user",
  description:
    "Admin-only. role/is_active are optional: a newly created account defaults to an active client.",
  security: AUTH_REQUIRED,
  request: { body: jsonBody(createUserSchema.shape.body) },
  responses: {
    201: successResponse("User created successfully", UserSchema),
    400: INVALID_DATA,
    401: NOT_AUTHENTICATED,
    403: ACCESS_DENIED,
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/users/{id}",
  summary: "Update a user",
  description:
    "Admin-only, including for one's own profile (no self-service).",
  security: AUTH_REQUIRED,
  request: {
    params: idParam(USER_ID_EXAMPLE),
    body: jsonBody(updateUserSchema.shape.body),
  },
  responses: {
    200: successResponse("User updated successfully", UserSchema),
    400: INVALID_DATA,
    401: NOT_AUTHENTICATED,
    403: ACCESS_DENIED,
    404: notFound("User"),
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/users/{id}",
  summary: "Delete a user",
  description: "Admin-only",
  security: AUTH_REQUIRED,
  request: { params: idParam(USER_ID_EXAMPLE) },
  responses: {
    204: { description: "User deleted successfully" },
    401: NOT_AUTHENTICATED,
    403: ACCESS_DENIED,
    404: notFound("User"),
  },
});

// Request read routes
registry.registerPath({
  method: "get",
  path: "/api/requests",
  summary: "List all requests",
  description:
    "Client: their own requests. Engineer: requests assigned to them. Admin: every request.",
  security: AUTH_REQUIRED,
  responses: {
    200: { description: "List of all requests" },
    401: NOT_AUTHENTICATED,
    403: ACCESS_DENIED,
    404: notFound("Data"),
    500: { description: "Server error" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/requests/{id}",
  summary: "Get a request by ID",
  description:
    "A client can only see their own requests. Staff (admin/engineer) can see every request.",
  security: AUTH_REQUIRED,
  request: { params: idParam(REQUEST_ID_EXAMPLE) },
  responses: {
    200: successResponse("Request retrieved successfully", requestSchema),
    401: NOT_AUTHENTICATED,
    403: ACCESS_DENIED,
    404: notFound("Request"),
  },
});

// Request write routes
registry.registerPath({
  method: "post",
  path: "/api/requests",
  summary: "Create a new request",
  description: "Client-only (staff don't file requests).",
  security: AUTH_REQUIRED,
  request: { body: jsonBody(createRequestSchema.shape.body) },
  responses: {
    201: successResponse("Request created successfully", requestSchema),
    400: { description: "Validation error" },
    403: ACCESS_DENIED,
  },
});

registry.registerPath({
  method: "put",
  path: "/api/requests/{id}",
  summary: "Update a request's content",
  description:
    "Title/description/priority only — status has its own endpoint (PATCH). Access: owner (client) or staff (admin/engineer).",
  security: AUTH_REQUIRED,
  request: {
    params: idParam(REQUEST_ID_EXAMPLE),
    body: jsonBody(updateRequestSchema.shape.body),
  },
  responses: {
    200: successResponse("Request updated successfully", requestSchema),
    400: INVALID_DATA,
    401: NOT_AUTHENTICATED,
    403: ACCESS_DENIED,
    404: notFound("Request"),
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/requests/{id}",
  summary: "Change a request's status",
  description:
    "Client: never (403). Engineer: only the open -> resolved transition. Admin: any transition, including to closed.",
  security: AUTH_REQUIRED,
  request: {
    params: idParam(REQUEST_ID_EXAMPLE),
    body: jsonBody(updateRequestStatusSchema.shape.body),
  },
  responses: {
    200: successResponse("Status updated successfully", requestSchema),
    400: INVALID_DATA,
    401: NOT_AUTHENTICATED,
    403: { description: "Transition not allowed for this role" },
    404: notFound("Request"),
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/requests/{id}",
  summary: "Delete a request",
  description: "Admin-only",
  security: AUTH_REQUIRED,
  request: { params: idParam(REQUEST_ID_EXAMPLE) },
  responses: {
    204: { description: "Request deleted successfully" },
    401: NOT_AUTHENTICATED,
    403: ACCESS_DENIED,
    404: notFound("Request"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/requests/{id}/assignments",
  summary: "Assign an engineer to a request",
  description:
    "Admin-only. engineer_id must reference a user with the engineer role.",
  security: AUTH_REQUIRED,
  request: {
    params: idParam(REQUEST_ID_EXAMPLE),
    body: jsonBody(assignEngineerSchema.shape.body),
  },
  responses: {
    201: successResponse("Engineer assigned successfully", requestSchema),
    400: { description: "Invalid engineer_id, or the user isn't an engineer" },
    401: NOT_AUTHENTICATED,
    403: ACCESS_DENIED,
    404: notFound("Request"),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/requests/{id}/comments",
  summary: "List the comments on a request",
  description:
    "Client: public comments on their own requests only. Staff (admin/engineer): every comment, including internal ones, on any request.",
  security: AUTH_REQUIRED,
  request: { params: idParam(REQUEST_ID_EXAMPLE) },
  responses: {
    200: successResponse("Comments retrieved successfully", z.array(commentSchema)),
    401: NOT_AUTHENTICATED,
    403: ACCESS_DENIED,
    404: notFound("Request"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/requests/{id}/comments",
  summary: "Add a comment to a request",
  description:
    "Client: public visibility only, on their own requests. Staff (admin/engineer): on any request, public or internal visibility.",
  security: AUTH_REQUIRED,
  request: {
    params: idParam(REQUEST_ID_EXAMPLE),
    body: jsonBody(createCommentSchema.shape.body),
  },
  responses: {
    201: successResponse("Comment created successfully", commentSchema),
    400: INVALID_DATA,
    401: NOT_AUTHENTICATED,
    403: ACCESS_DENIED,
    404: notFound("Request"),
  },
});

export function generateOpenAPIDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: "3.0.3",
    info: {
      title: "Client Service Portal API",
      version: "1.0.0",
    },
    servers: [{ url: "/" }],
  });
}
