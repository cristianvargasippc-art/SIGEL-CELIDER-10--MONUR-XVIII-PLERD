import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "./db.js";

const comisiones = ["Asamblea General", "Consejo de Seguridad", "Derechos Humanos"];
const distritos = ["10-01", "10-02", "10-03", "10-04", "10-05", "10-06", "10-07"];

async function main() {
  for (const codigo of distritos) {
    await prisma.distrito.upsert({
      where: { codigo },
      update: {},
      create: { codigo, nombre: `Distrito ${codigo}` }
    });
  }

  for (const nombre of comisiones) {
    const exists = await prisma.comision.findFirst({ where: { nombre, eventoId: null } });
    if (!exists) await prisma.comision.create({ data: { nombre } });
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
