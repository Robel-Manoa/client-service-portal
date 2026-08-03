import { serviceRequestDb } from "./database";
import { ServiceRequest, RequestPriority, RequestStatus } from "./types";
import { generateId } from "./id.util";
import { formatDate } from "./date.util";

export class RequestService {
  // Formate les dates pour l'API (DD-MM-YYYY HH:mm) sans toucher au stockage
  // interne, qui reste en ISO 8601 (tri chronologique fiable).
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

  // Récupération de toutes les demandes
  static async getAll(): Promise<ServiceRequest[]> {
    return serviceRequestDb.map(this.formatRequest);
  }

  // Récupération des demandes d'un client précis (un client ne voit que les siennes)
  static async getAllForClient(clientId: string): Promise<ServiceRequest[]> {
    return serviceRequestDb
      .filter((r) => r.client_id === clientId)
      .map(this.formatRequest);
  }

  // Récupération des demandes assignées à un engineer précis
  static async getAllForEngineer(engineerId: string): Promise<ServiceRequest[]> {
    return serviceRequestDb
      .filter((r) => r.assigned_engineer_id === engineerId)
      .map(this.formatRequest);
  }

  // Récupérer une demande par ID
  static async getById(id: string): Promise<ServiceRequest | null> {
    const request = serviceRequestDb.find((r) => r.id === id);
    return request ? this.formatRequest(request) : null;
  }

  // Création d'une demande
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

  // Mise à jour du contenu d'une demande (titre/description/priorité).
  // Le statut ne passe plus par ici : voir updateStatus, séparé pour que les
  // règles de transition (qui a le droit de passer de quel statut à quel
  // autre) restent isolées de la simple édition de contenu.
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

  // Changement de statut d'une demande, avec historisation.
  // La validation de la transition (qui a le droit de faire quel changement)
  // est de la responsabilité de l'appelant (controller) : le service applique
  // seulement le changement demandé.
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

  // Assigne un engineer à une demande
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

  // Supprimer une demande
  static async delete(id: string): Promise<boolean> {
    const index = serviceRequestDb.findIndex((r) => r.id === id);
    if (index === -1) return false;

    serviceRequestDb.splice(index, 1);
    return true;
  }
}
