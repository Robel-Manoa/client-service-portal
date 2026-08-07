import { serviceRequestDb } from "./database";
import { ServiceRequest, RequestPriority, RequestStatus } from "./types";
import { generateId } from "./id.util";
import { formatDate } from "./date.util";

export class RequestService {
  // Keeps storage in ISO 8601 and only formats dates for the API response —
  // same reasoning as UserService.sanitizeUser.
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

  static async getAll(): Promise<ServiceRequest[]> {
    return serviceRequestDb.map(this.formatRequest);
  }

  // Clients only ever get their own requests — never the whole table.
  static async getAllForClient(clientId: string): Promise<ServiceRequest[]> {
    return serviceRequestDb
      .filter((r) => r.client_id === clientId)
      .map(this.formatRequest);
  }

  static async getAllForEngineer(engineerId: string): Promise<ServiceRequest[]> {
    return serviceRequestDb
      .filter((r) => r.assigned_engineer_id === engineerId)
      .map(this.formatRequest);
  }

  static async getById(id: string): Promise<ServiceRequest | null> {
    const request = serviceRequestDb.find((r) => r.id === id);
    return request ? this.formatRequest(request) : null;
  }

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

  // Status isn't handled here on purpose — see updateStatus. Splitting them
  // keeps the transition rules (who can move a request from which status to
  // which) out of plain content edits.
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

  // No permission checks here — the controller decides who's allowed to
  // make this transition, this just applies it and logs it to history.
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

  static async delete(id: string): Promise<boolean> {
    const index = serviceRequestDb.findIndex((r) => r.id === id);
    if (index === -1) return false;

    serviceRequestDb.splice(index, 1);
    return true;
  }
}
