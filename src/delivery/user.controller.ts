import { Request, Response } from "express";
import { UserService, EMAIL_TAKEN_MESSAGE } from "../core/user.service";

// Connexion d'un utilisateur
export const loginUser = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const result = await UserService.login(email, password);
    // si donnée invalide
    if (!result) {
      res.status(401).json({ error: "Donnée invalide" });
      return;
    }

    res.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Connexion refusée";
    res.status(403).json({ error: message });
  }
};

// Récupération de tous les utilisateurs

export const getAllUser = async (req: Request, res: Response) => {
  const users = await UserService.getAll();
  res.status(200).json(users);
};

// Récupération des utilisations par ID

export const getUserById = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const user = await UserService.getById(id);

  if (!user) {
    res.status(404).json({ error: "Utilisateur introuvable" });
    return;
  }

  res.status(200).json(user);
};

// Création d'utilisateur avec les services de création

export const createUser = async (req: Request, res: Response) => {
  const { name, email, password, role, is_active } = req.body;

  // Les utilisateurs créer sont des clients par defaut
  const assignedRole = role || "client";

  // Délegation de la tache de création au service
  try {
    const newUser = await UserService.create({
      name,
      email,
      password,
      role: assignedRole,
      is_active: is_active ?? true,
    });

    res.status(201).json(newUser);
  } catch (error) {
    if (error instanceof Error && error.message === EMAIL_TAKEN_MESSAGE) {
      res.status(409).json({ error: error.message });
      return;
    }
    throw error;
  }
};

// Mise à jour d'un utilisateur (PATCH /api/users/:id, réservé aux admins —
// voir requireRole("admin") en amont, aucun self-service).

export const updateUser = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { name, email, password, role, is_active } = req.body;

  try {
    const updatedUser = await UserService.update(id, {
      name,
      email,
      password,
      role,
      is_active,
    });

    if (!updatedUser) {
      res.status(404).json({ error: "Utilisateur introuvable" });
      return;
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    if (error instanceof Error && error.message === EMAIL_TAKEN_MESSAGE) {
      res.status(409).json({ error: error.message });
      return;
    }
    throw error;
  }
};

// Suppréssion d'un utilisateurs avec les services

export const deleteUser = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const isDeleted = await UserService.delete(id);

  if (!isDeleted) {
    res.status(404).json({ error: "Utilisateur introuvable" });
    return;
  }

  res.status(204).send();
};
