// Controller : Création des routes pour les requettes HTTP avec Express
// CRUD pour les demandes de services

import { Request, Response } from "express";
import { RequestService } from "../core/request.service";
import { CommentService } from "../core/comment.service";
import { UserService } from "../core/user.service";

// Le staff (admin/engineer) a un accès complet à une demande par ID ;
// un client ne voit/modifie que les siennes.
const isStaff = (role?: string) => role === "admin" || role === "engineer";

// Récupération de tous les demandes
// Client : les siennes. Engineer : celles qui lui sont assignées. Admin : toutes.
export const getAllRequests = async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Utilisateur non authentifié" });
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

// Création d'une nouvelle demande (réservé aux clients, voir requireRole en amont)

export const createRequest = async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Utilisateur non authentifié" });
    return;
  }

  // req.body est déjà validé grâce à Zod
  const { title, description, priority } = req.body;

  // client_id vient toujours du token, jamais du body : un utilisateur ne peut
  // créer une demande qu'en son propre nom.
  const newRequest = await RequestService.create({
    client_id: req.user.id,
    title,
    description,
    priority,
  });

  res.status(201).json(newRequest);
};

// Récupération des demandes par ID

export const getRequestById = async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Utilisateur non authentifié" });
    return;
  }

  const id = req.params.id as string;
  const found = await RequestService.getById(id);

  if (!found) {
    res.status(404).json({ error: "Demande introuvable" });
    return;
  }

  if (!isStaff(req.user.role) && found.client_id !== req.user.id) {
    res.status(403).json({ error: "Accès non autorisé" });
    return;
  }

  res.status(200).json(found);
};

// Mise à jour du CONTENU d'une demande (titre/description/priorité).
// Le statut a son propre endpoint : voir updateRequestStatus.

export const updateRequest = async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Utilisateur non authentifié" });
    return;
  }

  const id = req.params.id as string;
  const existing = await RequestService.getById(id);

  if (!existing) {
    res.status(404).json({ error: "Demande introuvable" });
    return;
  }

  const staff = isStaff(req.user.role);
  const isOwner = existing.client_id === req.user.id;

  if (!staff && !isOwner) {
    res.status(403).json({ error: "Accès non autorisé" });
    return;
  }

  const { title, description, priority } = req.body;
  const updated = await RequestService.update(id, { title, description, priority });

  res.status(200).json(updated);
};

// Changement de statut d'une demande (PATCH /api/requests/:id)
// Client : jamais. Engineer : uniquement open -> resolved. Admin : toute transition.

export const updateRequestStatus = async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Utilisateur non authentifié" });
    return;
  }

  const id = req.params.id as string;
  const existing = await RequestService.getById(id);

  if (!existing) {
    res.status(404).json({ error: "Demande introuvable" });
    return;
  }

  const { status } = req.body;

  if (req.user.role === "client") {
    res.status(403).json({
      error: "Un client ne peut pas modifier le statut d'une demande",
    });
    return;
  }

  const isEngineerAllowedTransition =
    existing.status === "open" && status === "resolved";

  if (req.user.role === "engineer" && !isEngineerAllowedTransition) {
    res.status(403).json({
      error:
        "Un engineer ne peut faire passer une demande que de 'open' à 'resolved'",
    });
    return;
  }

  // Un admin peut faire n'importe quelle transition, y compris vers "closed".
  const updated = await RequestService.updateStatus(id, status);

  res.status(200).json(updated);
};

// Assignation d'un engineer à une demande (réservé aux admins)

export const assignEngineer = async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Utilisateur non authentifié" });
    return;
  }

  const id = req.params.id as string;
  const existing = await RequestService.getById(id);

  if (!existing) {
    res.status(404).json({ error: "Demande introuvable" });
    return;
  }

  const { engineer_id } = req.body;
  const engineer = await UserService.getById(engineer_id);

  if (engineer?.role !== "engineer") {
    res.status(400).json({
      error: "engineer_id doit correspondre à un utilisateur ayant le rôle engineer",
    });
    return;
  }

  const updated = await RequestService.assignEngineer(id, engineer_id);
  res.status(201).json(updated);
};

// Liste des commentaires d'une demande.
// Client : uniquement les commentaires publics de ses propres demandes.
// Staff (admin/engineer) : tous les commentaires, y compris internes.

export const getComments = async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Utilisateur non authentifié" });
    return;
  }

  const id = req.params.id as string;
  const existing = await RequestService.getById(id);

  if (!existing) {
    res.status(404).json({ error: "Demande introuvable" });
    return;
  }

  const staff = isStaff(req.user.role);

  if (!staff && existing.client_id !== req.user.id) {
    res.status(403).json({ error: "Accès non autorisé" });
    return;
  }

  const comments = await CommentService.listForRequest(id, staff);
  res.status(200).json(comments);
};

// Création d'un commentaire sur une demande.
// Un client ne peut poster qu'en visibilité publique (forcé ici, quelle que
// soit la valeur envoyée) ; seul le staff peut créer un commentaire interne.

export const createComment = async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "Utilisateur non authentifié" });
    return;
  }

  const id = req.params.id as string;
  const existing = await RequestService.getById(id);

  if (!existing) {
    res.status(404).json({ error: "Demande introuvable" });
    return;
  }

  const staff = isStaff(req.user.role);

  if (!staff && existing.client_id !== req.user.id) {
    res.status(403).json({ error: "Accès non autorisé" });
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

// Suppréssion d'une demande

export const deleteRequest = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const deleted = await RequestService.delete(id);

  if (!deleted) {
    res.status(404).json({ error: "Demande introuvable" });
    return;
  }

  res.status(204).send(); // 204 No Content

  // La requête a réussi, mais il n’y a pas de contenu à renvoyer.
};
