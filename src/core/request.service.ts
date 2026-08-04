import { serviceRequestDb } from "./database";
import { ServiceRequest, RequestPriority, RequestStatus } from "./types";
import { generateId } from "./id.util";
import { formatDate } from "./date.util";

export class RequestService {
  // Formats dates for the API (DD-MM-YYYY HH:mm) without touching internal
  // storage, which stays in ISO 8601 (reliable chronological sorting).
  private static formatRequest(request: ServiceRequest): ServiceRequest {
    return {
      ...request,
      created_at: formatDate(request.created_at),
      updated_at: formatDate(request.updated_at),
      status_history: request.status_history.map((h) => ({
        status: h.status,
        at: formatDate(h.at),
      })),
    };
  }

  // Fetch every request
  static async getAll(): Promise<ServiceRequest[]> {
    return serviceRequestDb.map(this.formatRequest);
  }

  // Fetch the requests belonging to a given client (a client only sees their own)
  static async getAllForClient(clientId: string): Promise<ServiceRequest[]> {
    return serviceRequestDb
      .filter((r) => r.client_id === clientId)
      .map(this.formatRequest);
  }

  // Fetch the requests assigned to a given engineer
  static async getAllForEngineer(engineerId: string): Promise<ServiceRequest[]> {
    return serviceRequestDb
      .filter((r) => r.assigned_engineer_id === engineerId)
      .map(this.formatRequest);
  }

  // Fetch a single request by ID
  static async getById(id: string): Promise<ServiceRequest | null> {
    const request = serviceRequestDb.find((r) => r.id === id);
    return request ? this.formatRequest(request) : null;
  }

  // Create a request
  static async create(data: {
    client_id: string;
    title: string;
    description: string;
    priority: RequestPriority;
  }): Promise<ServiceRequest> {
    const now = new Date().toISOString();

    const newRequest: ServiceRequest = {
      id: generateId(),
      client_id: data.client_id,
      title: data.title,
      description: data.description,
      priority: data.priority,
      status: "open",
      created_at: now,
      updated_at: now,
      status_history: [{ status: "open", at: now }],
    };

    serviceRequestDb.push(newRequest);
    return this.formatRequest(newRequest);
  }

  // Update a request's content (title/description/priority).
  // Status changes no longer go through here: see updateStatus, kept
  // separate so transition rules (who's allowed to move from which status
  // to which other) stay isolated from plain content edits.
  static async update(
    id: string,
    updates: {
      title?: string;
      description?: string;
      priority?: RequestPriority;
    },
  ): Promise<ServiceRequest | null> {
    const requestUpdate = serviceRequestDb.find((r) => r.id === id);

    if (!requestUpdate) {
      return null;
    }

    if (updates.title) requestUpdate.title = updates.title;
    if (updates.description) requestUpdate.description = updates.description;
    if (updates.priority) requestUpdate.priority = updates.priority;

    requestUpdate.updated_at = new Date().toISOString();

    return this.formatRequest(requestUpdate);
  }

  // Change a request's status, with history tracking.
  // Validating the transition (who's allowed to make which change) is the
  // caller's responsibility (controller) — the service just applies the
  // requested change.
  static async updateStatus(
    id: string,
    status: RequestStatus,
  ): Promise<ServiceRequest | null> {
    const request = serviceRequestDb.find((r) => r.id === id);
    if (!request) return null;

    if (status !== request.status) {
      const now = new Date().toISOString();
      request.status_history.push({ status, at: now });
      request.status = status;
      request.updated_at = now;
    }

    return this.formatRequest(request);
  }

  // Assign an engineer to a request
  static async assignEngineer(
    id: string,
    engineerId: string,
  ): Promise<ServiceRequest | null> {
    const request = serviceRequestDb.find((r) => r.id === id);
    if (!request) return null;

    request.assigned_engineer_id = engineerId;
    request.updated_at = new Date().toISOString();

    return this.formatRequest(request);
  }

  // Delete a request
  static async delete(id: string): Promise<boolean> {
    const index = serviceRequestDb.findIndex((r) => r.id === id);
    if (index === -1) return false;

    serviceRequestDb.splice(index, 1);
    return true;
  }
}
