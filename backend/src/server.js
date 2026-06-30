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
import { logger } from "./utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.APP_URL || "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => res.json({ status: "OK", app: "SIGEL CELIDER 10" }));
app.use("/api/auth", authRouter);
app.use("/api/delegados", delegadosRouter);
app.use("/api/calificaciones", calificacionesRouter);
app.use("/api/ranking", rankingRouter);
app.use("/api/audit", auditRouter);
app.use("/api/admins", adminsRouter);
app.use("/api/config", configRouter);
app.use("/api/export", exportRouter);
app.use("/api", (_req, res) => res.status(404).json({ error: "Ruta API no encontrada" }));

const frontendPath = join(__dirname, "../../frontend/dist");
app.use(express.static(frontendPath));
app.get("*", (_req, res) => {
  res.sendFile(join(frontendPath, "index.html"));
});

app.use((err, _req, res, _next) => {
  logger.error("Unhandled error", { error: err.message, stack: err.stack });
  return res.status(500).json({ error: "Error interno del servidor" });
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
