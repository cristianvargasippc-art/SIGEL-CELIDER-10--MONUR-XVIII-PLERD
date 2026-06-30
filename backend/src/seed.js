import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "./db.js";

const comisiones = ["Asamblea General", "Consejo de Seguridad", "Derechos Humanos"];

async function main() {
  for (const nombre of comisiones) {
    await prisma.comision.upsert({
      where: { nombre },
      update: {},
      create: { nombre }
    });
  }

  const email = process.env.SUPERADMIN_EMAIL || "superadmin@celider10.edu.do";
  const password = process.env.SUPERADMIN_PASSWORD || "TemporalPassword123";
  const hash = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS || 10));
  await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash: hash,
      role: "superadmin",
      estado: "activo",
      deletedAt: null
    },
    create: {
      email,
      passwordHash: hash,
      role: "superadmin"
    }
  });

  await prisma.config.upsert({
    where: { key: "publish_status" },
    update: {},
    create: { key: "publish_status", value: "false" }
  });

  console.log("Seed completado");
  console.log(`Email: ${email}`);
  console.log(`Password temporal: ${password}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
