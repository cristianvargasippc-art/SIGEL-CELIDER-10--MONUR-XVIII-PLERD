import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { adminsRouter } from "./routes/admins.js";
import { auditRouter } from "./routes/audit.js";
import { authRouter } from "./routes/auth.js";
import { calificacionesRouter } from "./routes/calificaciones.js";
import { configRouter } from "./routes/config.js";
import { delegadosRouter } from "./routes/delegados.js";
import { exportRouter } from "./routes/export.js";
import { rankingRouter } from "./routes/ranking.js";
import { prisma } from "./db.js";
import { logger } from "./utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 3000);

function wrapAsyncRoutes(router) {
  for (const layer of router.stack) {
    const routeStack = layer.route?.stack;
    if (!routeStack) continue;

    for (const routeLayer of routeStack) {
      const handler = routeLayer.handle;
      if (handler.length > 3) continue;
      routeLayer.handle = (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
    }
  }
  return router;
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.APP_URL || "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => res.json({ status: "OK", app: "SIGEL CELIDER 10" }));
app.get("/api/health/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ status: "OK", database: "connected" });
  } catch (error) {
    logger.error("Database health check failed", { error: error.message, code: error.code });
    return res.status(500).json({
      error: "No se pudo conectar con la base de datos",
      detail: error.message,
      code: error.code || null
    });
  }
});
app.use("/api/auth", wrapAsyncRoutes(authRouter));
app.use("/api/delegados", wrapAsyncRoutes(delegadosRouter));
app.use("/api/calificaciones", wrapAsyncRoutes(calificacionesRouter));
app.use("/api/ranking", wrapAsyncRoutes(rankingRouter));
app.use("/api/audit", wrapAsyncRoutes(auditRouter));
app.use("/api/admins", wrapAsyncRoutes(adminsRouter));
app.use("/api/config", wrapAsyncRoutes(configRouter));
app.use("/api/export", wrapAsyncRoutes(exportRouter));
app.use("/api", (_req, res) => res.status(404).json({ error: "Ruta API no encontrada" }));

const frontendPath = join(__dirname, "../../frontend/dist");
app.use(express.static(frontendPath));
app.get("*", (_req, res) => {
  res.sendFile(join(frontendPath, "index.html"));
});

app.use((err, _req, res, _next) => {
  logger.error("Unhandled error", { error: err.message, stack: err.stack });
  return res.status(500).json({
    error: "Error interno del servidor",
    detail: err.message,
    code: err.code || null
  });
});

function startServer(currentPort) {
  const server = app.listen(currentPort, () => {
    logger.info("SIGEL API iniciada", { port: currentPort });
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      const fallbackPort = currentPort + 1;
      logger.warn(`Puerto ${currentPort} en uso, intentando con ${fallbackPort}`);
      startServer(fallbackPort);
      return;
    }
    logger.error("Error al iniciar el servidor", { error: error.message, stack: error.stack });
    process.exit(1);
  });
}

startServer(port);
