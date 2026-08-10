// Implements ports.ts on top of the arrays in database.ts. This gets
// replaced by a real DB adapter later; the core only ever sees the interfaces.
import { userAccountDb, serviceRequestDb, requestCommentDb } from "./database";
import { UserRepository, RequestRepository, CommentRepository } from "./ports";
import { RequestComment, ServiceRequest, User } from "./types";

export class InMemoryUserRepository implements UserRepository {
  async findAll(): Promise<User[]> {
    return userAccountDb;
  }

  async findById(id: string): Promise<User | undefined> {
    return userAccountDb.find((u) => u.id === id);
  }

  async findByEmail(email: string): Promise<User | undefined> {
    return userAccountDb.find((u) => u.email === email);
  }

  async insert(user: User): Promise<void> {
    userAccountDb.push(user);
  }

  async save(user: User): Promise<void> {
    const index = userAccountDb.findIndex((u) => u.id === user.id);
    if (index !== -1) userAccountDb[index] = user;
  }

  async deleteById(id: string): Promise<boolean> {
    const index = userAccountDb.findIndex((u) => u.id === id);
    if (index === -1) return false;
    userAccountDb.splice(index, 1);
    return true;
  }
}

export class InMemoryRequestRepository implements RequestRepository {
  async findAll(): Promise<ServiceRequest[]> {
    return serviceRequestDb;
  }

  async findAllByClient(clientId: string): Promise<ServiceRequest[]> {
    return serviceRequestDb.filter((r) => r.client_id === clientId);
  }

  async findAllByEngineer(engineerId: string): Promise<ServiceRequest[]> {
    return serviceRequestDb.filter((r) => r.assigned_engineer_id === engineerId);
  }

  async findById(id: string): Promise<ServiceRequest | undefined> {
    return serviceRequestDb.find((r) => r.id === id);
  }

  async insert(request: ServiceRequest): Promise<void> {
    serviceRequestDb.push(request);
  }

  async save(request: ServiceRequest): Promise<void> {
    const index = serviceRequestDb.findIndex((r) => r.id === request.id);
    if (index !== -1) serviceRequestDb[index] = request;
  }

  async deleteById(id: string): Promise<boolean> {
    const index = serviceRequestDb.findIndex((r) => r.id === id);
    if (index === -1) return false;
    serviceRequestDb.splice(index, 1);
    return true;
  }
}

export class InMemoryCommentRepository implements CommentRepository {
  async findAllForRequest(requestId: string): Promise<RequestComment[]> {
    return requestCommentDb.filter((c) => c.request_id === requestId);
  }

  async insert(comment: RequestComment): Promise<void> {
    requestCommentDb.push(comment);
  }
}

// Defaults the core services fall back to when nothing's injected — same
// idea as `db = dbPool` in src/services/*.ts.
export const userRepository = new InMemoryUserRepository();
export const requestRepository = new InMemoryRequestRepository();
export const commentRepository = new InMemoryCommentRepository();
