import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import { env } from "./config/env.config";

// documentation de l'app
import swaggerUi from "swagger-ui-express";
import { generateOpenAPIDocument } from "./config/docs.config";

// Import de la partie de connexion
import { loginSchema } from "./delivery/schemas/auth.schema";

// Import des middlewares d'authentification et d'autorisation
import {
  authentificate,
  requireRole,
} from "./delivery/middlewares/auth.middleware";

//import des controlleurs pour le service demande
import {
  getAllRequests,
  getRequestById,
  createRequest,
  updateRequest,
  updateRequestStatus,
  assignEngineer,
  getComments,
  createComment,
  deleteRequest,
} from "./delivery/request.controller";

// Import pour les controlleurs utilisateurs
import {
  loginUser,
  createUser,
  getAllUser,
  getUserById,
  updateUser,
  deleteUser,
} from "./delivery/user.controller";

// Import pour la validation et du middleware
import { valides } from "./delivery/middlewares/validate.middleware";
import {
  createUserSchema,
  updateUserSchema,
} from "./delivery/schemas/user.schema";
import {
  createRequestSchema,
  updateRequestSchema,
  updateRequestStatusSchema,
  assignEngineerSchema,
} from "./delivery/schemas/request.schema";
import { createCommentSchema } from "./delivery/schemas/comment.schema";

// Initialisation du projet avec express

const app = express();

// Mise en place de la sécurité du serveur
// Activation de Helmet
app.use(helmet());

// Configuration du cors
app.use(
  cors({
    origin:
      env.NODE_ENV === "development"
        ? "*" // Tout autoriser en développement locale
        : `https://${env.URL_SITE}`,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  }),
);

// Limitation des requêtes Par IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Trop de requêtes. Veuillez réessayer plus tard" },
});

app.use(limiter);

// Middleware de base
// Permission au serveur de comprendre le format JSON dans les requêtes entrantes
app.use(express.json());

// Documentation OpenAPI / swagger
const openApiDocument = generateOpenAPIDocument();

// ROUTES PUBLIQUE
// Route pour consulter la documentation
app.get("/api-docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(openApiDocument);
});

// Interface interactive
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

// Vérification des routes, et l'état de santé du serveur

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "UP",
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// Route de connexion
app.post("/api/auth/login", valides(loginSchema), loginUser);

// ROUTES PROTEGEES
// authentificate doit TOUJOURS précéder requireRole : c'est authentificate qui
// pose req.user à partir du token, requireRole ne fait que le relire.

// Route pour CRUD des demandes (request)
// GET filtre par rôle au niveau du controller : client -> les siennes,
// engineer -> celles qui lui sont assignées, admin -> toutes.
app.get("/api/requests", authentificate, getAllRequests);
app.get("/api/requests/:id", authentificate, getRequestById);
// Création réservée aux clients : ce sont eux qui soumettent des demandes,
// pas le staff.
app.post(
  "/api/requests",
  authentificate,
  requireRole("client"),
  valides(createRequestSchema),
  createRequest,
);
// Mise à jour du CONTENU (titre/description/priorité) : propriétaire ou staff,
// vérifié dans le controller.
app.put(
  "/api/requests/:id",
  authentificate,
  valides(updateRequestSchema),
  updateRequest,
);
// Changement de STATUT, avec règles de transition par rôle (voir controller) :
// client jamais, engineer seulement open->resolved, admin toute transition.
app.patch(
  "/api/requests/:id",
  authentificate,
  valides(updateRequestStatusSchema),
  updateRequestStatus,
);
app.delete(
  "/api/requests/:id",
  authentificate,
  requireRole("admin"),
  deleteRequest,
);

// Assignation d'un engineer à une demande (réservé aux admins)
app.post(
  "/api/requests/:id/assignments",
  authentificate,
  requireRole("admin"),
  valides(assignEngineerSchema),
  assignEngineer,
);

// Commentaires sur une demande : accès ouvert à tout authentifié, filtrage
// (propriétaire/visibilité) géré dans le controller.
app.get("/api/requests/:id/comments", authentificate, getComments);
app.post(
  "/api/requests/:id/comments",
  authentificate,
  valides(createCommentSchema),
  createComment,
);

// Route pour CRUD des utilisateurs (User)
// Réservé aux admins : l'annuaire complet des utilisateurs n'est pas
// nécessaire aux engineers pour faire leur travail sur les demandes.
app.get("/api/users", authentificate, requireRole("admin"), getAllUser);
app.get(
  "/api/users/:id",
  authentificate,
  requireRole("admin", "engineer"),
  getUserById,
);
app.post(
  "/api/users",
  authentificate,
  requireRole("admin"),
  valides(createUserSchema),
  createUser,
);
// Réservé aux admins, y compris pour son propre profil : pas de self-service.
app.patch(
  "/api/users/:id",
  authentificate,
  requireRole("admin"),
  valides(updateUserSchema),
  updateUser,
);
app.delete("/api/users/:id", authentificate, requireRole("admin"), deleteUser);

// Gestion des erreurs
// La gestion des erreurs de routes, ce bloque gère proprement les routes innexistante que les utilisateurs essayeront d'y acceder

app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({
    error: "Ressources non trouvée",
  });
});

// Global Error Handler
// Middleware pour rebustesse. Si une erreur imprévue survient dans le code ce bloque l'attrape, évite que le serveur ne crashe et renvoie une erreure

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("[Erreur Serveur]:", err.stack);
  res.status(500).json({
    error: "Une erreur interne est survenue sur le serveur",
  });
});

// app.listen() est fait dans server.ts, pas ici : ça permet aux tests
// d'importer `app` sans ouvrir un vrai port.
export default app;
