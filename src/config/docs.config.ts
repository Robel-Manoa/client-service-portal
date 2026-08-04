// OpenAPI document generation
// This file holds the general API info, security schemes, and paths with
// their HTTP methods.

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

// Create the OpenAPI registry
export const registry = new OpenAPIRegistry();

// Declare the authentication scheme
const bearerAuth = registry.registerComponent("securitySchemes", "BearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description: "Enter the JWT token as: Bearer <token>",
});

// Auth routes
registry.registerPath({
  method: "post",
  path: "/api/auth/login",
  summary: "User login",
  description:
    "Authenticates a user and returns a JWT token valid for 2 hours",
  request: {
    body: {
      content: {
        "application/json": {
          schema: loginSchema.shape.body,
        },
      },
    },
  },

  responses: {
    200: {
      description: "Login successful",
      content: {
        "application/json": {
          schema: z.object({
            token: z.string().openapi({ example: "eyoinyziryoezyrno..." }),
          }),
        },
      },
    },

    400: { description: "Invalid data" },
    404: { description: "Incorrect credentials" },
  },
});

// User routes
registry.registerPath({
  method: "get",
  path: "/api/users",
  summary: "List all users",
  description: "List of every user, admin-only",
  // This route requires a JWT token
  security: [{ [bearerAuth.name]: [] }],

  responses: {
    200: {
      description: "Users retrieved successfully",
      content: { "application/json": { schema: z.array(UserSchema) } },
    },
    401: { description: "Not authenticated" },
    403: { description: "Access denied" },
    404: { description: "Data not found" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/users/{id}",
  summary: "Get a user by ID",
  description: "Restricted to the admin and engineer roles",
  security: [{ [bearerAuth.name]: [] }],
  request: { params: idParam("8f14e45f-ceea-4c9c-8f1e-000000000001") },
  responses: {
    200: {
      description: "User retrieved successfully",
      content: { "application/json": { schema: UserSchema } },
    },
    401: { description: "Not authenticated" },
    403: { description: "Access denied" },
    404: { description: "User not found" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/users",
  summary: "Create a user",
  description:
    "Admin-only. role/is_active are optional: a newly created account defaults to an active client.",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    body: {
      content: {
        "application/json": { schema: createUserSchema.shape.body },
      },
    },
  },
  responses: {
    201: {
      description: "User created successfully",
      content: { "application/json": { schema: UserSchema } },
    },
    400: { description: "Invalid data" },
    401: { description: "Not authenticated" },
    403: { description: "Access denied" },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/users/{id}",
  summary: "Update a user",
  description:
    "Admin-only, including for one's own profile (no self-service).",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: idParam("8f14e45f-ceea-4c9c-8f1e-000000000001"),
    body: {
      content: {
        "application/json": { schema: updateUserSchema.shape.body },
      },
    },
  },
  responses: {
    200: {
      description: "User updated successfully",
      content: { "application/json": { schema: UserSchema } },
    },
    400: { description: "Invalid data" },
    401: { description: "Not authenticated" },
    403: { description: "Access denied" },
    404: { description: "User not found" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/users/{id}",
  summary: "Delete a user",
  description: "Admin-only",
  security: [{ [bearerAuth.name]: [] }],
  request: { params: idParam("8f14e45f-ceea-4c9c-8f1e-000000000001") },
  responses: {
    204: { description: "User deleted successfully" },
    401: { description: "Not authenticated" },
    403: { description: "Access denied" },
    404: { description: "User not found" },
  },
});

// Request read routes
registry.registerPath({
  method: "get",
  path: "/api/requests",
  summary: "List all requests",
  description:
    "Client: their own requests. Engineer: requests assigned to them. Admin: every request.",
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: { description: "List of all requests" },
    401: { description: "Not authenticated" },
    403: { description: "Access denied" },
    404: { description: "Data not found" },
    500: { description: "Server error" },
  },
});

// Route to fetch a single request by ID
registry.registerPath({
  method: "get",
  path: "/api/requests/{id}",
  summary: "Get a request by ID",
  description:
    "A client can only see their own requests. Staff (admin/engineer) can see every request.",
  security: [{ [bearerAuth.name]: [] }],
  request: { params: idParam("8f14e45f-ceea-4c9c-8f1e-000000000010") },
  responses: {
    200: {
      description: "Request retrieved successfully",
      content: { "application/json": { schema: requestSchema } },
    },
    401: { description: "Not authenticated" },
    403: { description: "Access denied" },
    404: { description: "Request not found" },
  },
});

// Request write routes
registry.registerPath({
  method: "post",
  path: "/api/requests",
  summary: "Create a new request",
  description: "Client-only (staff don't file requests).",
  security: [{ [bearerAuth.name]: [] }],

  request: {
    body: {
      content: {
        "application/json": { schema: createRequestSchema.shape.body },
      },
    },
  },

  responses: {
    201: {
      description: "Request created successfully",
      content: { "application/json": { schema: requestSchema } },
    },
    400: { description: "Validation error" },
    403: { description: "Access denied" },
  },
});

registry.registerPath({
  method: "put",
  path: "/api/requests/{id}",
  summary: "Update a request's content",
  description:
    "Title/description/priority only — status has its own endpoint (PATCH). Access: owner (client) or staff (admin/engineer).",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: idParam("8f14e45f-ceea-4c9c-8f1e-000000000010"),
    body: {
      content: {
        "application/json": { schema: updateRequestSchema.shape.body },
      },
    },
  },
  responses: {
    200: {
      description: "Request updated successfully",
      content: { "application/json": { schema: requestSchema } },
    },
    400: { description: "Invalid data" },
    401: { description: "Not authenticated" },
    403: { description: "Access denied" },
    404: { description: "Request not found" },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/requests/{id}",
  summary: "Change a request's status",
  description:
    "Client: never (403). Engineer: only the open -> resolved transition. Admin: any transition, including to closed.",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: idParam("8f14e45f-ceea-4c9c-8f1e-000000000010"),
    body: {
      content: {
        "application/json": { schema: updateRequestStatusSchema.shape.body },
      },
    },
  },
  responses: {
    200: {
      description: "Status updated successfully",
      content: { "application/json": { schema: requestSchema } },
    },
    400: { description: "Invalid data" },
    401: { description: "Not authenticated" },
    403: { description: "Transition not allowed for this role" },
    404: { description: "Request not found" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/requests/{id}",
  summary: "Delete a request",
  description: "Admin-only",
  security: [{ [bearerAuth.name]: [] }],
  request: { params: idParam("8f14e45f-ceea-4c9c-8f1e-000000000010") },
  responses: {
    204: { description: "Request deleted successfully" },
    401: { description: "Not authenticated" },
    403: { description: "Access denied" },
    404: { description: "Request not found" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/requests/{id}/assignments",
  summary: "Assign an engineer to a request",
  description:
    "Admin-only. engineer_id must reference a user with the engineer role.",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: idParam("8f14e45f-ceea-4c9c-8f1e-000000000010"),
    body: {
      content: {
        "application/json": { schema: assignEngineerSchema.shape.body },
      },
    },
  },
  responses: {
    201: {
      description: "Engineer assigned successfully",
      content: { "application/json": { schema: requestSchema } },
    },
    400: { description: "Invalid engineer_id, or the user isn't an engineer" },
    401: { description: "Not authenticated" },
    403: { description: "Access denied" },
    404: { description: "Request not found" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/requests/{id}/comments",
  summary: "List the comments on a request",
  description:
    "Client: public comments on their own requests only. Staff (admin/engineer): every comment, including internal ones, on any request.",
  security: [{ [bearerAuth.name]: [] }],
  request: { params: idParam("8f14e45f-ceea-4c9c-8f1e-000000000010") },
  responses: {
    200: {
      description: "Comments retrieved successfully",
      content: { "application/json": { schema: z.array(commentSchema) } },
    },
    401: { description: "Not authenticated" },
    403: { description: "Access denied" },
    404: { description: "Request not found" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/requests/{id}/comments",
  summary: "Add a comment to a request",
  description:
    "Client: public visibility only, on their own requests. Staff (admin/engineer): on any request, public or internal visibility.",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: idParam("8f14e45f-ceea-4c9c-8f1e-000000000010"),
    body: {
      content: {
        "application/json": { schema: createCommentSchema.shape.body },
      },
    },
  },
  responses: {
    201: {
      description: "Comment created successfully",
      content: { "application/json": { schema: commentSchema } },
    },
    400: { description: "Invalid data" },
    401: { description: "Not authenticated" },
    403: { description: "Access denied" },
    404: { description: "Request not found" },
  },
});

// Generate the OpenAPI JSON document
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
