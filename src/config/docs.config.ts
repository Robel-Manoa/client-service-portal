// Génération du document OpenAPI
// C'est dans ce fichier que l'on trouvera les informations générales sur l'API
// Les schéma de sécurité
// Les path avec leurs méthodes HTTP

import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";
import {
  UserSchema,
  createUserSchema,
  updateUserSchema,
} from "../delivery/schemas/user.schema";
import { loginSchema } from "./../delivery/schemas/auth.schema";
import { z } from "zod";
import {
  requestSchema,
  createRequestSchema,
  updateRequestSchema,
  updateRequestStatusSchema,
  assignEngineerSchema,
} from "../delivery/schemas/request.schema";
import {
  commentSchema,
  createCommentSchema,
} from "../delivery/schemas/comment.schema";

// Paramètre de chemin ":id", réutilisé sur toutes les routes /xxx/:id
const idParam = (example: string) =>
  z.object({ id: z.string().openapi({ example }) });

// Création du registre OpenAPI
export const registry = new OpenAPIRegistry();

// Déclaration du système d'authentification
const bearerAuth = registry.registerComponent("securitySchemes", "BearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description: "Entrer le token JWT au format : Bearer <token>",
});

// Enregistrement des routes : Auth
registry.registerPath({
  method: "post",
  path: "/api/auth/login",
  summary: "Connexion utilisateur",
  description:
    "Authentifie un utilisateur et retourne un token JWT valide pendant 2 heures",
  request: {
    body: {
      content: {
        "application/json": {
          schema: loginSchema.shape.body,
        },
      },
    },
  },

  responses: {
    200: {
      description: "Connexion réussie",
      content: {
        "application/json": {
          schema: z.object({
            token: z.string().openapi({ example: "eyoinyziryoezyrno..." }),
          }),
        },
      },
    },

    400: { description: "Donnée invalide" },
    404: { description: "Indentifiant incorrecte" },
  },
});

// Enregistrement des routes : Users
registry.registerPath({
  method: "get",
  path: "/api/users",
  summary: "Liste de tous les users",
  description: "La liste de tous les utilisateurs, réservé aux admins",
  // La route nécessite un token JWT
  security: [{ [bearerAuth.name]: [] }],

  responses: {
    200: {
      description: "Utilisateurs récupérée avec succès",
      content: { "application/json": { schema: z.array(UserSchema) } },
    },
    401: { description: "Non authentifier" },
    403: { description: "Accès refusé" },
    404: { description: "donnée introuvable" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/users/{id}",
  summary: "Récupération d'un utilisateur par ID",
  description: "Réservé aux rôles admin et engineer",
  security: [{ [bearerAuth.name]: [] }],
  request: { params: idParam("8f14e45f-ceea-4c9c-8f1e-000000000001") },
  responses: {
    200: {
      description: "Utilisateur récupéré avec succès",
      content: { "application/json": { schema: UserSchema } },
    },
    401: { description: "Non authentifier" },
    403: { description: "Accès refusé" },
    404: { description: "Utilisateur introuvable" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/users",
  summary: "Création d'un utilisateur",
  description:
    "Réservé aux admins. role/is_active sont optionnels : par défaut un compte créé est un client actif.",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    body: {
      content: {
        "application/json": { schema: createUserSchema.shape.body },
      },
    },
  },
  responses: {
    201: {
      description: "Utilisateur créé avec succès",
      content: { "application/json": { schema: UserSchema } },
    },
    400: { description: "Donnée invalide" },
    401: { description: "Non authentifier" },
    403: { description: "Accès refusé" },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/users/{id}",
  summary: "Mise à jour d'un utilisateur",
  description:
    "Réservé aux admins, y compris pour son propre profil (pas de self-service).",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: idParam("8f14e45f-ceea-4c9c-8f1e-000000000001"),
    body: {
      content: {
        "application/json": { schema: updateUserSchema.shape.body },
      },
    },
  },
  responses: {
    200: {
      description: "Utilisateur mis à jour avec succès",
      content: { "application/json": { schema: UserSchema } },
    },
    400: { description: "Donnée invalide" },
    401: { description: "Non authentifier" },
    403: { description: "Accès refusé" },
    404: { description: "Utilisateur introuvable" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/users/{id}",
  summary: "Suppression d'un utilisateur",
  description: "Réservé aux admins",
  security: [{ [bearerAuth.name]: [] }],
  request: { params: idParam("8f14e45f-ceea-4c9c-8f1e-000000000001") },
  responses: {
    204: { description: "Utilisateur supprimé avec succès" },
    401: { description: "Non authentifier" },
    403: { description: "Accès refusé" },
    404: { description: "Utilisateur introuvable" },
  },
});

// Routes de récupération : Requests
registry.registerPath({
  method: "get",
  path: "/api/requests",
  summary: "Tous les demandes",
  description:
    "Client : ses propres demandes. Engineer : les demandes qui lui sont assignées. Admin : toutes les demandes.",
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: { description: "Liste de toutes les demandes" },
    401: { description: "Utilisateur non authentifier" },
    403: { description: "Accès refusé" },
    404: { description: "Donnée introuvable" },
    500: { description: "Problème de serveur" },
  },
});

// Route de récupération d'une demande particulière : Request/id
registry.registerPath({
  method: "get",
  path: "/api/requests/{id}",
  summary: "Récupération d'une demande par ID",
  description:
    "Un client ne peut voir que ses propres demandes. Le staff (admin/engineer) voit toutes les demandes.",
  security: [{ [bearerAuth.name]: [] }],
  request: { params: idParam("8f14e45f-ceea-4c9c-8f1e-000000000010") },
  responses: {
    200: {
      description: "Demande récupérée avec succès",
      content: { "application/json": { schema: requestSchema } },
    },
    401: { description: "Utilisateur non authentifier" },
    403: { description: "Accès refusé" },
    404: { description: "Demande introuvable" },
  },
});

// Routes pour publier : Requests
registry.registerPath({
  method: "post",
  path: "/api/requests",
  summary: "Création d'une nouvelle demande",
  description: "Réservé aux clients (le staff ne soumet pas de demandes).",
  security: [{ [bearerAuth.name]: [] }],

  request: {
    body: {
      content: {
        "application/json": { schema: createRequestSchema.shape.body },
      },
    },
  },

  responses: {
    201: {
      description: "Demande créer avec succès",
      content: { "application/json": { schema: requestSchema } },
    },
    400: { description: "Erreur de validiter" },
    403: { description: "Problème d'accès" },
  },
});

registry.registerPath({
  method: "put",
  path: "/api/requests/{id}",
  summary: "Mise à jour du contenu d'une demande",
  description:
    "Titre/description/priorité uniquement — le statut a son propre endpoint (PATCH). Accès : propriétaire (client) ou staff (admin/engineer).",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: idParam("8f14e45f-ceea-4c9c-8f1e-000000000010"),
    body: {
      content: {
        "application/json": { schema: updateRequestSchema.shape.body },
      },
    },
  },
  responses: {
    200: {
      description: "Demande mise à jour avec succès",
      content: { "application/json": { schema: requestSchema } },
    },
    400: { description: "Donnée invalide" },
    401: { description: "Utilisateur non authentifier" },
    403: { description: "Accès refusé" },
    404: { description: "Demande introuvable" },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/requests/{id}",
  summary: "Changement de statut d'une demande",
  description:
    "Client : jamais (403). Engineer : uniquement la transition open -> resolved. Admin : n'importe quelle transition, y compris vers closed.",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: idParam("8f14e45f-ceea-4c9c-8f1e-000000000010"),
    body: {
      content: {
        "application/json": { schema: updateRequestStatusSchema.shape.body },
      },
    },
  },
  responses: {
    200: {
      description: "Statut mis à jour avec succès",
      content: { "application/json": { schema: requestSchema } },
    },
    400: { description: "Donnée invalide" },
    401: { description: "Utilisateur non authentifier" },
    403: { description: "Transition non autorisée pour ce rôle" },
    404: { description: "Demande introuvable" },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/requests/{id}",
  summary: "Suppression d'une demande",
  description: "Réservé aux admins",
  security: [{ [bearerAuth.name]: [] }],
  request: { params: idParam("8f14e45f-ceea-4c9c-8f1e-000000000010") },
  responses: {
    204: { description: "Demande supprimée avec succès" },
    401: { description: "Utilisateur non authentifier" },
    403: { description: "Accès refusé" },
    404: { description: "Demande introuvable" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/requests/{id}/assignments",
  summary: "Assignation d'un engineer à une demande",
  description:
    "Réservé aux admins. engineer_id doit correspondre à un utilisateur ayant le rôle engineer.",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: idParam("8f14e45f-ceea-4c9c-8f1e-000000000010"),
    body: {
      content: {
        "application/json": { schema: assignEngineerSchema.shape.body },
      },
    },
  },
  responses: {
    201: {
      description: "Engineer assigné avec succès",
      content: { "application/json": { schema: requestSchema } },
    },
    400: { description: "engineer_id invalide ou utilisateur non-engineer" },
    401: { description: "Utilisateur non authentifier" },
    403: { description: "Accès refusé" },
    404: { description: "Demande introuvable" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/requests/{id}/comments",
  summary: "Liste des commentaires d'une demande",
  description:
    "Client : commentaires publics de ses propres demandes uniquement. Staff (admin/engineer) : tous les commentaires, y compris internes, sur n'importe quelle demande.",
  security: [{ [bearerAuth.name]: [] }],
  request: { params: idParam("8f14e45f-ceea-4c9c-8f1e-000000000010") },
  responses: {
    200: {
      description: "Commentaires récupérés avec succès",
      content: { "application/json": { schema: z.array(commentSchema) } },
    },
    401: { description: "Utilisateur non authentifier" },
    403: { description: "Accès refusé" },
    404: { description: "Demande introuvable" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/requests/{id}/comments",
  summary: "Ajout d'un commentaire sur une demande",
  description:
    "Client : uniquement en visibilité publique, sur ses propres demandes. Staff (admin/engineer) : sur n'importe quelle demande, visibilité publique ou interne.",
  security: [{ [bearerAuth.name]: [] }],
  request: {
    params: idParam("8f14e45f-ceea-4c9c-8f1e-000000000010"),
    body: {
      content: {
        "application/json": { schema: createCommentSchema.shape.body },
      },
    },
  },
  responses: {
    201: {
      description: "Commentaire créé avec succès",
      content: { "application/json": { schema: commentSchema } },
    },
    400: { description: "Donnée invalide" },
    401: { description: "Utilisateur non authentifier" },
    403: { description: "Accès refusé" },
    404: { description: "Demande introuvable" },
  },
});

// Génération du document JSON OpenAPI
export function generateOpenAPIDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: "3.0.3",
    info: {
      title: "Client Service Portal API",
      version: "1.0.0",
    },
    servers: [{ url: "/" }],
  });
}
