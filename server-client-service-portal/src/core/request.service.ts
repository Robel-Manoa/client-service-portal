import { ServiceRequest, RequestPriority, RequestStatus } from "./types";
import { generateId } from "./id.util";
import { formatDate } from "./date.util";
import type { RequestRepository } from "./ports";
import { requestRepository as defaultRequests } from "./in-memory.repositories";

export class RequestService {
  // Mirrors UserService.sanitizeUser: storage stays ISO 8601, formatting
  // only happens here on the way out.
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

  static async getAll(requests: RequestRepository = defaultRequests): Promise<ServiceRequest[]> {
    return (await requests.findAll()).map(this.formatRequest);
  }

  // Clients only ever get their own requests — never the whole table.
  static async getAllForClient(
    clientId: string,
    requests: RequestRepository = defaultRequests,
  ): Promise<ServiceRequest[]> {
    return (await requests.findAllByClient(clientId)).map(this.formatRequest);
  }

  static async getAllForEngineer(
    engineerId: string,
    requests: RequestRepository = defaultRequests,
  ): Promise<ServiceRequest[]> {
    return (await requests.findAllByEngineer(engineerId)).map(this.formatRequest);
  }

  static async getById(
    id: string,
    requests: RequestRepository = defaultRequests,
  ): Promise<ServiceRequest | null> {
    const request = await requests.findById(id);
    return request ? this.formatRequest(request) : null;
  }

  static async create(
    data: {
      client_id: string;
      title: string;
      description: string;
      priority: RequestPriority;
    },
    requests: RequestRepository = defaultRequests,
  ): Promise<ServiceRequest> {
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

    await requests.insert(newRequest);
    return this.formatRequest(newRequest);
  }

  // No status field here — see updateStatus for that. Keeps the transition
  // rules (who can move a request from which status to which) separate from
  // plain content edits.
  static async update(
    id: string,
    updates: {
      title?: string;
      description?: string;
      priority?: RequestPriority;
    },
    requests: RequestRepository = defaultRequests,
  ): Promise<ServiceRequest | null> {
    const requestUpdate = await requests.findById(id);

    if (!requestUpdate) {
      return null;
    }

    if (updates.title) requestUpdate.title = updates.title;
    if (updates.description) requestUpdate.description = updates.description;
    if (updates.priority) requestUpdate.priority = updates.priority;

    requestUpdate.updated_at = new Date().toISOString();

    await requests.save(requestUpdate);
    return this.formatRequest(requestUpdate);
  }

  // No permission checks here — the controller decides who's allowed to
  // make this transition, this just applies it and logs it to history.
  static async updateStatus(
    id: string,
    status: RequestStatus,
    requests: RequestRepository = defaultRequests,
  ): Promise<ServiceRequest | null> {
    const request = await requests.findById(id);
    if (!request) return null;

    if (status !== request.status) {
      const now = new Date().toISOString();
      request.status_history.push({ status, at: now });
      request.status = status;
      request.updated_at = now;
    }

    await requests.save(request);
    return this.formatRequest(request);
  }

  static async assignEngineer(
    id: string,
    engineerId: string,
    requests: RequestRepository = defaultRequests,
  ): Promise<ServiceRequest | null> {
    const request = await requests.findById(id);
    if (!request) return null;

    request.assigned_engineer_id = engineerId;
    request.updated_at = new Date().toISOString();

    await requests.save(request);
    return this.formatRequest(request);
  }

  static async delete(
    id: string,
    requests: RequestRepository = defaultRequests,
  ): Promise<boolean> {
    return requests.deleteById(id);
  }
}
