import bcrypt from "bcrypt";
import { userAccountDb } from "./database";
import { User } from "./types";
import jwt from "jsonwebtoken";
import { env } from "../config/env.config";
import { generateId } from "./id.util";
import { formatDate } from "./date.util";

const SALT_ROUNDS = 10; // bcrypt's recommended default

// Controller checks for this exact message to return 409 instead of 500 —
// a duplicate email is the client's fault, not ours.
export const EMAIL_TAKEN_MESSAGE = "This email is already in use.";

export class UserService {
  static async login(email: string, passwordAttempt: string) {
    const user = userAccountDb.find((u) => u.email === email);
    if (!user) return null; // unknown user

    if (!user.is_active) throw new Error("Account disabled");

    const isPasswordValid = await bcrypt.compare(
      passwordAttempt,
      user.password!,
    );
    if (!isPasswordValid) return null;

    const token = jwt.sign(
      { sub: user.id, role: user.role, email: user.email },
      env.JWT_SECRET,
      { expiresIn: "2h" },
    );

    return { user: this.sanitizeUser(user), token };
  }

  // Every read path funnels through here so we never leak a password hash,
  // and dates come out formatted for the API instead of raw ISO.
  static sanitizeUser(user: User) {
    const { password, ...safeUser } = user;
    return {
      ...safeUser,
      created_at: formatDate(user.created_at),
      updated_at: formatDate(user.updated_at),
    };
  }

  static async getAll() {
    return userAccountDb.map(this.sanitizeUser);
  }

  static async getById(id: string) {
    const user = userAccountDb.find((u) => u.id === id);
    if (!user) return null;
    return this.sanitizeUser(user);
  }

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

  static async delete(id: string) {
    const index = userAccountDb.findIndex((u) => u.id === id);
    if (index === -1) return false;

    userAccountDb.splice(index, 1);
    return true;
  }
}
