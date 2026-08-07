import { Request, Response } from "express";
import { RequestService } from "../core/request.service";
import { CommentService } from "../core/comment.service";
import { UserService } from "../core/user.service";

// Staff (admin/engineer) get full access to a request by ID;
// a client only sees/edits their own.
const isStaff = (role?: string) => role === "admin" || role === "engineer";

// Client: their own requests. Engineer: requests assigned to them. Admin: everything.
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

// Client-only — the role check happens on the route (requireRole), not here.
export const createRequest = async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { title, description, priority } = req.body;

  // Always the logged-in user's own ID, never something from the body —
  // otherwise a client could file a request as someone else.
  const newRequest = await RequestService.create({
    client_id: req.user.id,
    title,
    description,
    priority,
  });

  res.status(201).json(newRequest);
};

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

// Content only (title/description/priority) — status changes go through
// updateRequestStatus instead, since who's allowed to do that is a
// different set of rules.
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

// PATCH /api/requests/:id — clients can never touch this, engineers can only
// resolve an open request, admins can move to any status.
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

  // Falls through to here for admins with no restriction, and for engineers
  // making the one transition they're allowed.
  const updated = await RequestService.updateStatus(id, status);

  res.status(200).json(updated);
};

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

// Clients see public comments on their own requests; staff see everything,
// internal notes included.
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
  // A client asking for "internal" gets silently downgraded to "public" —
  // only staff can actually create an internal note.
  const finalVisibility = staff && visibility === "internal" ? "internal" : "public";

  const comment = await CommentService.create({
    request_id: id,
    author_id: req.user.id,
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
