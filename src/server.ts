import app from "./app";
import { env } from "./config/env.config";
import http from "node:http";

// Split from app.ts so tests can import the Express app directly without
// booting a real server on a real port.
const server = http.createServer(app);

server.listen(env.PORT, () => {
  console.log(`[Success] Server running at: http://localhost:${env.PORT}`);
  console.log(
    `[Documentation]: OpenAPI docs available at http://localhost:${env.PORT}/api-docs`,
  );
});

// server.close() instead of process.exit(): lets in-flight requests finish
// instead of dropping them mid-response.
function gracefulShutdown(signal: string) {
  console.log(`Received ${signal}. Shutting down the HTTP server`);
  server.close(() => {
    console.log("Connections closed. Server shut down cleanly");
    process.exit(0);
  });
}

// SIGTERM: sent by process managers/orchestrators on deploy or restart.
// SIGINT: Ctrl+C during local dev.
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
