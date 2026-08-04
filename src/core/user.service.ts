import bcrypt from "bcrypt";
import { userAccountDb } from "./database";
import { User } from "./types";
import jwt from "jsonwebtoken";
import { env } from "../config/env.config";
import { generateId } from "./id.util";
import { formatDate } from "./date.util";

// number of algorithm rounds (salt rounds)
const SALT_ROUNDS = 10; // 10 is the industry standard

// Message recognized by the controller to return a 409 instead of a 500:
// a duplicate email is a client error (conflict), not a server error.
export const EMAIL_TAKEN_MESSAGE = "This email is already in use.";

export class UserService {
  // Login implementation with JWT
  static async login(email: string, passwordAttempt: string) {
    // Look up the user
    const user = userAccountDb.find((u) => u.email === email);
    if (!user) return null; // unknown user

    // Check that the account is active
    if (!user.is_active) throw new Error("Account disabled");

    // Compare the password against the hash
    const isPasswordValid = await bcrypt.compare(
      passwordAttempt,
      user.password!,
    );
    if (!isPasswordValid) return null; // incorrect password

    // Password is correct
    // Generate the JWT
    const token = jwt.sign(
      { sub: user.id, role: user.role, email: user.email },
      env.JWT_SECRET,
      { expiresIn: "2h" },
    );

    return { user: this.sanitizeUser(user), token };
  }

  // Strip the password before returning the user, and format dates for the
  // API (DD-MM-YYYY HH:mm — see date.util.ts)
  static sanitizeUser(user: User) {
    const { password, ...safeUser } = user;
    return {
      ...safeUser,
      created_at: formatDate(user.created_at),
      updated_at: formatDate(user.updated_at),
    };
  }

  // Fetch all users without their passwords
  static async getAll() {
    return userAccountDb.map(this.sanitizeUser);
  }

  // Fetch a single user by ID
  static async getById(id: string) {
    const user = userAccountDb.find((u) => u.id === id);
    if (!user) return null;
    return this.sanitizeUser(user);
  }

  // Create a user with a hashed password
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

  // Update an existing user
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

  // Delete a user
  static async delete(id: string) {
    const index = userAccountDb.findIndex((u) => u.id === id);
    if (index === -1) return false;

    userAccountDb.splice(index, 1);
    return true;
  }
}
