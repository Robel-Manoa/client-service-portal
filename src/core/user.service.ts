import bcrypt from "bcrypt";
import { User } from "./types";
import jwt from "jsonwebtoken";
import { env } from "../config/env.config";
import { generateId } from "./id.util";
import { formatDate } from "./date.util";
import type { UserRepository } from "./ports";
import { userRepository as defaultUsers } from "./in-memory.repositories";

const SALT_ROUNDS = 10; // bcrypt's recommended default

// Controller checks for this exact message to return 409 instead of 500 —
// a duplicate email is the client's fault, not ours.
export const EMAIL_TAKEN_MESSAGE = "This email is already in use.";

export class UserService {
  static async login(
    email: string,
    passwordAttempt: string,
    users: UserRepository = defaultUsers,
  ) {
    const user = await users.findByEmail(email);
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

  static async getAll(users: UserRepository = defaultUsers) {
    return (await users.findAll()).map(this.sanitizeUser);
  }

  static async getById(id: string, users: UserRepository = defaultUsers) {
    const user = await users.findById(id);
    if (!user) return null;
    return this.sanitizeUser(user);
  }

  static async create(
    userData: Omit<User, "id" | "created_at" | "updated_at">,
    users: UserRepository = defaultUsers,
  ) {
    const emailTaken = (await users.findByEmail(userData.email)) !== undefined;
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

    await users.insert(newUser);
    return this.sanitizeUser(newUser);
  }

  static async update(
    id: string,
    userData: Partial<Omit<User, "id" | "created_at" | "updated_at">>,
    users: UserRepository = defaultUsers,
  ) {
    const user = await users.findById(id);
    if (!user) return null;

    if (userData.email !== undefined && userData.email !== user.email) {
      const existing = await users.findByEmail(userData.email);
      const emailTaken = existing !== undefined && existing.id !== id;
      if (emailTaken) throw new Error(EMAIL_TAKEN_MESSAGE);
    }

    if (userData.name !== undefined) user.name = userData.name;
    if (userData.email !== undefined) user.email = userData.email;
    if (userData.password !== undefined)
      user.password = await bcrypt.hash(userData.password, SALT_ROUNDS);
    if (userData.role !== undefined) user.role = userData.role;
    if (userData.is_active !== undefined) user.is_active = userData.is_active;

    user.updated_at = new Date().toISOString();

    await users.save(user);
    return this.sanitizeUser(user);
  }

  static async delete(id: string, users: UserRepository = defaultUsers) {
    return users.deleteById(id);
  }
}
