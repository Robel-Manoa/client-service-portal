import bcrypt from "bcrypt";
import { userAccountDb } from "./database";
import { User } from "./types";
import jwt from "jsonwebtoken";
import { env } from "../config/env.config";
import { generateId } from "./id.util";
import { formatDate } from "./date.util";

// nombre de tours d'algorithme (salt rounds)
const SALT_ROUNDS = 10; // 10 est le standard de l'industrie

// Message reconnu par le controller pour renvoyer un 409 plutôt qu'un 500 :
// un email dupliqué est une erreur client (conflit), pas une erreur serveur.
export const EMAIL_TAKEN_MESSAGE = "Cet email est déjà utilisé.";

export class UserService {
  // implémentation de la partie login avec JWT
  static async login(email: string, passwordAttempt: string) {
    // Recherche de l'utilisateur
    const user = userAccountDb.find((u) => u.email === email);
    if (!user) return null; // utilisateur inconnu

    // Vérification du compte si actif
    if (!user.is_active) throw new Error("Compte désactivé");

    // comparaison du mot de passe avec le hash
    const isPasswordValid = await bcrypt.compare(
      passwordAttempt,
      user.password!,
    );
    if (!isPasswordValid) return null; // Le mot de passe est incorrect

    // Si le mot de passe est correcte
    // Génération du Token JWT
    const token = jwt.sign(
      { sub: user.id, role: user.role, email: user.email },
      env.JWT_SECRET,
      { expiresIn: "2h" },
    );

    return { user: this.sanitizeUser(user), token };
  }

  // Masquer le mot de passe avant d'envoyer, et formater les dates pour l'API
  // (DD-MM-YYYY HH:mm — voir date.util.ts)
  static sanitizeUser(user: User) {
    const { password, ...safeUser } = user;
    return {
      ...safeUser,
      created_at: formatDate(user.created_at),
      updated_at: formatDate(user.updated_at),
    };
  }

  // Recupération de tous les utilisateurs sans mot de passe
  static async getAll() {
    return userAccountDb.map(this.sanitizeUser);
  }

  // Récupération d'un utilisateur par ID
  static async getById(id: string) {
    const user = userAccountDb.find((u) => u.id === id);
    if (!user) return null;
    return this.sanitizeUser(user);
  }

  // Création d'un utilisation avec mot de passe haché
  static async create(
    userData: Omit<User, "id" | "created_at" | "updated_at">,
  ) {
    const emailTaken = userAccountDb.some((u) => u.email === userData.email);
    if (emailTaken) throw new Error(EMAIL_TAKEN_MESSAGE);

    const hashedPassword = await bcrypt.hash(userData.password!, SALT_ROUNDS);

    const now = new Date().toISOString();

    const newUser: User = {
      id: generateId(),
      name: userData.name,
      email: userData.email,
      password: hashedPassword,
      role: userData.role,
      is_active: userData.is_active,
      created_at: now,
      updated_at: now,
    };

    userAccountDb.push(newUser);
    return this.sanitizeUser(newUser);
  }

  // Met à jour un utilisateur existant
  static async update(
    id: string,
    userData: Partial<Omit<User, "id" | "created_at" | "updated_at">>,
  ) {
    const user = userAccountDb.find((u) => u.id === id);
    if (!user) return null;

    if (userData.email !== undefined && userData.email !== user.email) {
      const emailTaken = userAccountDb.some(
        (u) => u.id !== id && u.email === userData.email,
      );
      if (emailTaken) throw new Error(EMAIL_TAKEN_MESSAGE);
    }

    if (userData.name !== undefined) user.name = userData.name;
    if (userData.email !== undefined) user.email = userData.email;
    if (userData.password !== undefined)
      user.password = await bcrypt.hash(userData.password, SALT_ROUNDS);
    if (userData.role !== undefined) user.role = userData.role;
    if (userData.is_active !== undefined) user.is_active = userData.is_active;

    user.updated_at = new Date().toISOString();

    return this.sanitizeUser(user);
  }

  // Supprime un utilisateur
  static async delete(id: string) {
    const index = userAccountDb.findIndex((u) => u.id === id);
    if (index === -1) return false;

    userAccountDb.splice(index, 1);
    return true;
  }
}
