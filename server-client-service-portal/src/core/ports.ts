// What core/*.service.ts needs from storage. Services only ever import
// these interfaces, never database.ts or a driver — swap the adapter,
// nothing else changes.
import { RequestComment, ServiceRequest, User } from "./types";

export interface UserRepository {
  findAll(): Promise<User[]>;
  findById(id: string): Promise<User | undefined>;
  findByEmail(email: string): Promise<User | undefined>;
  insert(user: User): Promise<void>;
  // Don't mutate the object findById returned and assume it sticks — that
  // only works for the in-memory adapter. Call save() to persist changes.
  save(user: User): Promise<void>;
  deleteById(id: string): Promise<boolean>;
}

export interface RequestRepository {
  findAll(): Promise<ServiceRequest[]>;
  findAllByClient(clientId: string): Promise<ServiceRequest[]>;
  findAllByEngineer(engineerId: string): Promise<ServiceRequest[]>;
  findById(id: string): Promise<ServiceRequest | undefined>;
  insert(request: ServiceRequest): Promise<void>;
  save(request: ServiceRequest): Promise<void>;
  deleteById(id: string): Promise<boolean>;
}

export interface CommentRepository {
  findAllForRequest(requestId: string): Promise<RequestComment[]>;
  insert(comment: RequestComment): Promise<void>;
}
