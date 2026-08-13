import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, "..");
const frontendDist = path.join(projectRoot, "frontend", "dist");
const backendDist = path.join(projectRoot, "backend", "dist");
const backendPublic = path.join(projectRoot, "backend", "public");

if (fs.existsSync(frontendDist)) {
  if (fs.existsSync(backendDist)) fs.rmSync(backendDist, { recursive: true, force: true });
  if (fs.existsSync(backendPublic)) fs.rmSync(backendPublic, { recursive: true, force: true });

  fs.mkdirSync(backendDist, { recursive: true });
  fs.cpSync(frontendDist, backendDist, { recursive: true });

  fs.mkdirSync(backendPublic, { recursive: true });
  fs.cpSync(frontendDist, backendPublic, { recursive: true });

  console.log("✅ Frontend dist exitosamente copiado a backend/dist y backend/public");
} else {
  console.warn("⚠️ Advertencia: frontend/dist no existe aún.");
}
