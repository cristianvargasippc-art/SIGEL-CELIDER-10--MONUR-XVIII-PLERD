import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";
import { adminsRouter } from "./routes/admins.js";
import { auditRouter } from "./routes/audit.js";
import { authRouter } from "./routes/auth.js";
import { calificacionesRouter } from "./routes/calificaciones.js";
import { configRouter } from "./routes/config.js";
import { delegadosRouter } from "./routes/delegados.js";
import { eventosRouter } from "./routes/eventos.js";
import { exportRouter } from "./routes/export.js";
import { rankingRouter } from "./routes/ranking.js";
import { encuestasRouter } from "./routes/encuestas.js";
import { prisma } from "./db.js";
import { logger } from "./utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const requiredEnvVars = ["DATABASE_URL", "JWT_SECRET"];
const missingVars = requiredEnvVars.filter((v) => !process.env[v]);
if (missingVars.length > 0) {
  console.error(`❌ FATAL: Missing required environment variables: ${missingVars.join(", ")}`);
  process.exit(1);
}

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

const allowedOrigins = (process.env.APP_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https://flagcdn.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", ...allowedOrigins, "http://localhost:3000", "http://localhost:5173"]
    }
  }
}));

app.use(cors({
  origin(origin, callback) {
    const cleanOrigin = origin ? origin.trim().replace(/\/$/, "") : null;
    if (!cleanOrigin || allowedOrigins.includes(cleanOrigin) || cleanOrigin.startsWith("http://localhost:")) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true
}));
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
      ...(process.env.NODE_ENV !== "production" ? { detail: error.message, code: error.code || null } : {})
    });
  }
});
app.use("/api/auth", wrapAsyncRoutes(authRouter));
app.use("/api/delegados", wrapAsyncRoutes(delegadosRouter));
app.use("/api/eventos", wrapAsyncRoutes(eventosRouter));
app.use("/api/calificaciones", wrapAsyncRoutes(calificacionesRouter));
app.use("/api/ranking", wrapAsyncRoutes(rankingRouter));
app.use("/api/audit", wrapAsyncRoutes(auditRouter));
app.use("/api/admins", wrapAsyncRoutes(adminsRouter));
app.use("/api/config", wrapAsyncRoutes(configRouter));
app.use("/api/export", wrapAsyncRoutes(exportRouter));
app.use("/api/encuestas", wrapAsyncRoutes(encuestasRouter));
app.use("/api", (_req, res) => res.status(404).json({ error: "Ruta API no encontrada" }));

function getCandidateFrontendPaths() {
  const paths = [];
  if (process.env.FRONTEND_DIST) paths.push(process.env.FRONTEND_DIST);
  if (process.env.PUBLIC_DIR) paths.push(process.env.PUBLIC_DIR);
  if (process.env.STATIC_PATH) paths.push(process.env.STATIC_PATH);

  // Direct paths relative to server.js (__dirname = backend/src)
  paths.push(join(__dirname, "public"));
  paths.push(join(__dirname, "dist"));
  paths.push(join(__dirname, "../public"));
  paths.push(join(__dirname, "../dist"));

  const bases = [__dirname, process.cwd(), join(__dirname, ".."), join(process.cwd(), "..")];
  
  for (const base of bases) {
    if (!base) continue;
    let curr = base;
    for (let i = 0; i < 5; i++) {
      paths.push(join(curr, "frontend/dist"));
      paths.push(join(curr, "dist"));
      paths.push(join(curr, "public"));
      paths.push(join(curr, "public_html"));
      paths.push(join(curr, "public_html/frontend/dist"));
      paths.push(join(curr, "public_html/dist"));
      paths.push(join(curr, "backend/dist"));
      paths.push(join(curr, "backend/public"));
      paths.push(join(curr, "backend/src/public"));
      paths.push(join(curr, "backend/src/dist"));
      paths.push(join(curr, "src/dist"));
      paths.push(join(curr, "src/public"));
      const parent = join(curr, "..");
      if (parent === curr) break;
      curr = parent;
    }
  }
  return [...new Set(paths)];
}

function resolveFrontendPath() {
  const candidates = getCandidateFrontendPaths();
  for (const p of candidates) {
    if (existsSync(join(p, "index.html"))) {
      return p;
    }
  }
  return candidates[0] || join(__dirname, "../dist");
}

const candidatePaths = getCandidateFrontendPaths();
candidatePaths.forEach((p) => {
  if (existsSync(p)) {
    app.use(express.static(p));
  }
});

const frontendPath = resolveFrontendPath();
app.use(express.static(frontendPath));

app.get("*", (_req, res) => {
  const activePath = resolveFrontendPath();
  const indexPath = join(activePath, "index.html");
  if (existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  return res.status(404).type("html").send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>SIGEL CELIDER 10 - Sistema Activo</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1rem; }
        .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 2rem; max-width: 650px; width: 100%; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }
        h1 { color: #38bdf8; margin-top: 0; font-size: 1.5rem; }
        p { line-height: 1.6; color: #94a3b8; }
        code { background: #0f172a; color: #f43f5e; padding: 0.2rem 0.4rem; border-radius: 4px; font-size: 0.85em; word-break: break-all; }
        .status { display: inline-block; background: #0369a1; color: #e0f2fe; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.85rem; font-weight: 600; margin-bottom: 1rem; }
        .help { background: #0f172a; padding: 1rem; border-radius: 8px; border-left: 4px solid #38bdf8; margin-top: 1rem; font-size: 0.85rem; max-height: 200px; overflow-y: auto; }
      </style>
    </head>
    <body>
      <div class="card">
        <span class="status">Backend Activo (API OK)</span>
        <h1>SIGEL CELIDER 10 - Servidor En Ejecución</h1>
        <p>El servicio API del Backend está funcionando correctamente. Para visualizar la interfaz de usuario, se requiere compilar el frontend ejecutando:</p>
        <p><code>npm run build</code></p>
        <div class="help">
          <strong>Rutas escaneadas para index.html:</strong><br>
          ${candidatePaths.map(p => `• <code>${p}</code>`).join('<br>')}
        </div>
      </div>
    </body>
    </html>
  `);
});

app.use((err, _req, res, _next) => {
  logger.error("Unhandled error", { error: err.message, stack: err.stack });
  return res.status(500).json({
    error: "Ocurrió una eventualidad en la plataforma. Se ha emitido una notificación de alerta.",
    detail: err.message,
    alert: true,
    code: err.code || null
  });
});

function startServer(currentPort) {
  const server = app.listen(currentPort, () => {
    logger.info("SIGEL API iniciada", { port: currentPort });
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      if (process.env.NODE_ENV === "production") {
        logger.error("El puerto configurado ya esta en uso", { port: currentPort });
        process.exit(1);
      }
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
