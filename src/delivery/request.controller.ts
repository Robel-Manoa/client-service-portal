// Controller: HTTP routes for service requests, built with Express
// CRUD operations for service requests

import { Request, Response } from "express";
import { RequestService } from "../core/request.service";
import { CommentService } from "../core/comment.service";
import { UserService } from "../core/user.service";

// Staff (admin/engineer) get full access to a request by ID;
// a client only sees/edits their own.
const isStaff = (role?: string) => role === "admin" || role === "engineer";

// Fetch every request
// Client: their own. Engineer: those assigned to them. Admin: all of them.
export const getAllRequests = async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  let requests;
  if (req.user.role === "admin") {
    requests = await RequestService.getAll();
  } else if (req.user.role === "engineer") {
    requests = await RequestService.getAllForEngineer(req.user.id);
  } else {
    requests = await RequestService.getAllForClient(req.user.id);
  }

  res.status(200).json(requests);
};

// Create a new request (client-only, see requireRole upstream)

export const createRequest = async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  // req.body has already been validated by Zod
  const { title, description, priority } = req.body;

  // client_id always comes from the token, never from the body: a user can
  // only create a request in their own name.
  const newRequest = await RequestService.create({
    client_id: req.user.id,
    title,
    description,
    priority,
  });

  res.status(201).json(newRequest);
};

// Fetch a request by ID

export const getRequestById = async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const id = req.params.id as string;
  const found = await RequestService.getById(id);

  if (!found) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  if (!isStaff(req.user.role) && found.client_id !== req.user.id) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  res.status(200).json(found);
};

// Update a request's CONTENT (title/description/priority).
// Status has its own endpoint: see updateRequestStatus.

export const updateRequest = async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const id = req.params.id as string;
  const existing = await RequestService.getById(id);

  if (!existing) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  const staff = isStaff(req.user.role);
  const isOwner = existing.client_id === req.user.id;

  if (!staff && !isOwner) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const { title, description, priority } = req.body;
  const updated = await RequestService.update(id, { title, description, priority });

  res.status(200).json(updated);
};

// Change a request's status (PATCH /api/requests/:id)
// Client: never. Engineer: open -> resolved only. Admin: any transition.

export const updateRequestStatus = async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const id = req.params.id as string;
  const existing = await RequestService.getById(id);

  if (!existing) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  const { status } = req.body;

  if (req.user.role === "client") {
    res.status(403).json({
      error: "A client cannot change a request's status",
    });
    return;
  }

  const isEngineerAllowedTransition =
    existing.status === "open" && status === "resolved";

  if (req.user.role === "engineer" && !isEngineerAllowedTransition) {
    res.status(403).json({
      error:
        "An engineer can only move a request from 'open' to 'resolved'",
    });
    return;
  }

  // An admin can perform any transition, including to "closed".
  const updated = await RequestService.updateStatus(id, status);

  res.status(200).json(updated);
};

// Assign an engineer to a request (admin-only)

export const assignEngineer = async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const id = req.params.id as string;
  const existing = await RequestService.getById(id);

  if (!existing) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

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

// List the comments on a request.
// Client: public comments on their own requests only.
// Staff (admin/engineer): every comment, including internal ones.

export const getComments = async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const id = req.params.id as string;
  const existing = await RequestService.getById(id);

  if (!existing) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  const staff = isStaff(req.user.role);

  if (!staff && existing.client_id !== req.user.id) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const comments = await CommentService.listForRequest(id, staff);
  res.status(200).json(comments);
};

// Create a comment on a request.
// A client can only post with public visibility (enforced here regardless
// of the value sent); only staff can create an internal comment.

export const createComment = async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const id = req.params.id as string;
  const existing = await RequestService.getById(id);

  if (!existing) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  const staff = isStaff(req.user.role);

  if (!staff && existing.client_id !== req.user.id) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const { body, visibility } = req.body;
  const finalVisibility = staff && visibility === "internal" ? "internal" : "public";

  const comment = await CommentService.create({
    request_id: id,
    author_id: req.user.id,
    body,
    visibility: finalVisibility,
  });

  res.status(201).json(comment);
};

// Delete a request

export const deleteRequest = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const deleted = await RequestService.delete(id);

  if (!deleted) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  res.status(204).send(); // 204 No Content

  // The request succeeded, but there's no content to return.
};
