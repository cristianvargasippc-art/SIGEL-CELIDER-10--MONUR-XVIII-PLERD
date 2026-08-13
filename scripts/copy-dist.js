const fs = require("fs");
const path = require("path");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

try {
  const frontendDist = path.join(__dirname, "..", "frontend", "dist");
  const backendDist = path.join(__dirname, "..", "backend", "dist");
  const backendPublic = path.join(__dirname, "..", "backend", "public");

  if (fs.existsSync(frontendDist)) {
    copyDir(frontendDist, backendDist);
    copyDir(frontendDist, backendPublic);
    console.log("✅ Frontend dist copiado exitosamente a backend/dist y backend/public");
  } else {
    console.warn("⚠️ frontend/dist no existe aún.");
  }
} catch (err) {
  console.error("Error al copiar dist:", err.message);
}
