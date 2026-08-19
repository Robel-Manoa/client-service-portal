export type UserRole = "client" | "engineer" | "admin";
export type RequestPriority = "low" | "medium" | "high";
export type RequestStatus =
  | "open"
  | "in_progress"
  | "pending_client"
  | "resolved"
  | "closed";

export interface User {
  id: string;
  name: string;
  email: string;
  // Optional, not required: UserService.sanitizeUser strips this before a
  // user ever reaches the API response, so the same type has to describe
  // both a freshly-loaded row (has it) and a sanitized one (doesn't).
  password?: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StatusHistory {
  status: RequestStatus;
  at: string;
}

export interface ServiceRequest {
  id: string;
  client_id: string;
  title: string;
  description: string;
  priority: RequestPriority;
  status: RequestStatus;
  created_at: string;
  updated_at: string;
  status_history: StatusHistory[];
  assigned_engineer_id?: string;
}

export type CommentVisibility = "public" | "internal";

export interface RequestComment {
  id: string;
  request_id: string;
  author_id: string;
  body: string;
  visibility: CommentVisibility;
  created_at: string;
}
