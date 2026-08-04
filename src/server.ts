import app from "./app";
import { env } from "./config/env.config";
import http from "node:http";

// create the HTTP server
const server = http.createServer(app);

// Process entry point: keeps network bootstrap separate from the app
// definition (src/app.ts), so tests can import `app` without opening a
// real port.
server.listen(env.PORT, () => {
  console.log(`[Success] Server running at: http://localhost:${env.PORT}`);
  console.log(
    `[Documentation]: OpenAPI docs available at http://localhost:${env.PORT}/api-docs`,
  );
});

// Server shutdown handling
function gracefulShutdown(signal: string) {
  console.log(`Received ${signal}. Shutting down the HTTP server`);
  server.close(() => {
    console.log("Connections closed. Server shut down cleanly");
    process.exit(0);
  });
}

// Catch OS shutdown signals and shut down cleanly
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
