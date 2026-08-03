import app from "./app";
import { env } from "./config/env.config";
import http from "node:http";

// création du serveur HTTP
const server = http.createServer(app);

// Point d'entrée du processus : sépare le bootstrap réseau de la définition
// de l'app (src/app.ts), pour pouvoir importer `app` dans les tests sans
// ouvrir de vrai port.
server.listen(env.PORT, () => {
  console.log(`[Success] Le serveur tourne sur : http://localhost:${env.PORT}`);
  console.log(
    `[Documentation]: La documentation OpenAPI est disponible sur http://localhost:${env.PORT}/api-docs`,
  );
});

// Gestion de l'arrêt du serveur
function gracefulShutdown(signal: string) {
  console.log(`Signal ${signal} reçu. Fermeture du serveur HTTP`);
  server.close(() => {
    console.log("Connexion fermée. Le serveur s'est arrêté proprement");
    process.exit(0);
  });
}

// Interception des signaux d'arrêt du système et fermeture propre
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
