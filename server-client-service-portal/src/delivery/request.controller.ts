import { Request, Response } from "express";
import { RequestService } from "../core/request.service";
import { CommentService } from "../core/comment.service";
import { UserService } from "../core/user.service";
import { ServiceRequest } from "../core/types";

type AuthenticatedUser = NonNullable<Request["user"]>;

// Staff (admin/engineer) get treated as staff for cross-cutting things like
// internal-comment visibility. It does NOT mean "full access to any
// request" — engineers are further scoped to their own assignments by
// canAccessRequest below.
const isStaff = (role?: string) => role === "admin" || role === "engineer";

// Whether `user` may view/edit this specific request at all. Admin: always.
// Engineer: only a request assigned to them. Client: only a request they
// own. Used everywhere a single request is read or acted on.
const canAccessRequest = (
  user: { id: string; role: string },
  request: { client_id: string; assigned_engineer_id?: string },
) => {
  if (user.role === "admin") return true;
  if (user.role === "engineer") return request.assigned_engineer_id === user.id;
  return request.client_id === user.id;
};

// Every handler below needs req.user narrowed before it can do anything.
// authenticate (see delivery/middlewares/auth.middleware.ts) already
// guarantees it's set for every real HTTP request — this is what
// backstops a handler being called directly, bypassing that middleware
// (see tests/controller-guards.test.ts).
function requireUser(req: Request, res: Response): AuthenticatedUser | undefined {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return undefined;
  }
  return req.user;
}

// Shared "look up the request, 404 if it doesn't exist" step that every
// single-request handler below needs before it can check access or act.
async function requireExistingRequest(
  id: string,
  res: Response,
): Promise<ServiceRequest | undefined> {
  const existing = await RequestService.getById(id);
  if (!existing) {
    res.status(404).json({ error: "Request not found" });
    return undefined;
  }
  return existing;
}

// Shared canAccessRequest -> 403 step, written once instead of repeated at
// every read/write endpoint that scopes access to a single request.
function requireAccess(
  user: AuthenticatedUser,
  request: { client_id: string; assigned_engineer_id?: string },
  res: Response,
): boolean {
  if (!canAccessRequest(user, request)) {
    res.status(403).json({ error: "Access denied" });
    return false;
  }
  return true;
}

// Client: their own requests. Engineer: requests assigned to them. Admin: everything.
export const getAllRequests = async (req: Request, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;

  let requests;
  if (user.role === "admin") {
    requests = await RequestService.getAll();
  } else if (user.role === "engineer") {
    requests = await RequestService.getAllForEngineer(user.id);
  } else {
    requests = await RequestService.getAllForClient(user.id);
  }

  res.status(200).json(requests);
};

// Client-only — the role check happens on the route (requireRole), not here.
export const createRequest = async (req: Request, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;

  const { title, description, priority } = req.body;

  // Always the logged-in user's own ID, never something from the body —
  // otherwise a client could file a request as someone else.
  const newRequest = await RequestService.create({
    client_id: user.id,
    title,
    description,
    priority,
  });

  res.status(201).json(newRequest);
};

export const getRequestById = async (req: Request, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;

  const id = req.params.id as string;
  const found = await requireExistingRequest(id, res);
  if (!found) return;

  if (!requireAccess(user, found, res)) return;

  res.status(200).json(found);
};

// Content only (title/description/priority) — status changes go through
// updateRequestStatus instead, since who's allowed to do that is a
// different set of rules.
export const updateRequest = async (req: Request, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;

  const id = req.params.id as string;
  const existing = await requireExistingRequest(id, res);
  if (!existing) return;

  if (!requireAccess(user, existing, res)) return;

  const { title, description, priority } = req.body;
  const updated = await RequestService.update(id, { title, description, priority });

  res.status(200).json(updated);
};

// PATCH /api/requests/:id — clients can never touch this, engineers can only
// resolve an open request, admins can move to any status.
export const updateRequestStatus = async (req: Request, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;

  const id = req.params.id as string;
  const existing = await requireExistingRequest(id, res);
  if (!existing) return;

  const { status } = req.body;

  if (user.role === "client") {
    res.status(403).json({
      error: "A client cannot change a request's status",
    });
    return;
  }

  if (!requireAccess(user, existing, res)) return;

  const isEngineerAllowedTransition =
    existing.status === "open" && status === "resolved";

  if (user.role === "engineer" && !isEngineerAllowedTransition) {
    res.status(403).json({
      error:
        "An engineer can only move a request from 'open' to 'resolved'",
    });
    return;
  }

  // Falls through to here for admins with no restriction, and for engineers
  // making the one transition they're allowed.
  const updated = await RequestService.updateStatus(id, status);

  res.status(200).json(updated);
};

export const assignEngineer = async (req: Request, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;

  const id = req.params.id as string;
  const existing = await requireExistingRequest(id, res);
  if (!existing) return;

  const { engineer_id } = req.body;
  const engineer = await UserService.getById(engineer_id);

  if (engineer?.role !== "engineer") {
    res.status(400).json({
      error: "engineer_id must reference a user with the engineer role",
    });
    return;
  }

  const updated = await RequestService.assignEngineer(id, engineer_id);
  res.status(201).json(updated);
};

// Clients see public comments on their own requests; staff see everything,
// internal notes included.
export const getComments = async (req: Request, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;

  const id = req.params.id as string;
  const existing = await requireExistingRequest(id, res);
  if (!existing) return;

  if (!requireAccess(user, existing, res)) return;

  const staff = isStaff(user.role);
  const comments = await CommentService.listForRequest(id, staff);
  res.status(200).json(comments);
};

export const createComment = async (req: Request, res: Response) => {
  const user = requireUser(req, res);
  if (!user) return;

  const id = req.params.id as string;
  const existing = await requireExistingRequest(id, res);
  if (!existing) return;

  if (!requireAccess(user, existing, res)) return;

  const staff = isStaff(user.role);
  const { body, visibility } = req.body;
  // A client asking for "internal" gets silently downgraded to "public" —
  // only staff can actually create an internal note.
  const finalVisibility = staff && visibility === "internal" ? "internal" : "public";

  const comment = await CommentService.create({
    request_id: id,
    author_id: user.id,
    body,
    visibility: finalVisibility,
  });

  res.status(201).json(comment);
};

export const deleteRequest = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const deleted = await RequestService.delete(id);

  if (!deleted) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  res.status(204).send();
};
