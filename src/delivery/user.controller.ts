import { Request, Response } from "express";
import { UserService, EMAIL_TAKEN_MESSAGE } from "../core/user.service";

export const loginUser = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const result = await UserService.login(email, password);
    if (!result) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    res.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Login failed";
    res.status(403).json({ error: message });
  }
};

export const getAllUser = async (req: Request, res: Response) => {
  const users = await UserService.getAll();
  res.status(200).json(users);
};

export const getUserById = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const user = await UserService.getById(id);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.status(200).json(user);
};

export const createUser = async (req: Request, res: Response) => {
  const { name, email, password, role, is_active } = req.body;

  // role/is_active are optional in the request — fall back to a plain
  // active client if the caller doesn't specify them.
  const assignedRole = role || "client";

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

// Admin-only (requireRole("admin") on the route) — including for editing
// your own profile, there's no self-service path here.
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
      res.status(404).json({ error: "User not found" });
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

export const deleteUser = async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const isDeleted = await UserService.delete(id);

  if (!isDeleted) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.status(204).send();
};
