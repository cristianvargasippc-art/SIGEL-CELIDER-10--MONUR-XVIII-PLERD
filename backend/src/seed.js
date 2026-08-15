import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "./db.js";

const comisiones = ["Asamblea General", "Consejo de Seguridad", "Derechos Humanos"];
const distritos = ["10-01", "10-02", "10-03", "10-04", "10-05", "10-06", "10-07"];

async function main() {
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction && (!process.env.SUPERADMIN_EMAIL || !process.env.SUPERADMIN_PASSWORD)) {
    throw new Error("SUPERADMIN_EMAIL y SUPERADMIN_PASSWORD son requeridos para ejecutar seed en produccion.");
  }

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

  const testEmail = process.env.LOCAL_TEST_EMAIL || "prueba@celider10.local";
  const testPassword = process.env.LOCAL_TEST_PASSWORD || "PruebaLocal123";
  if (!isProduction) {
    const testHash = await bcrypt.hash(testPassword, Number(process.env.BCRYPT_ROUNDS || 10));
    const distrito = await prisma.distrito.findUnique({ where: { codigo: "10-01" } });
    await prisma.user.upsert({
      where: { email: testEmail },
      update: {
        passwordHash: testHash,
        role: "distrito",
        distritoId: distrito?.id || null,
        estado: "activo",
        deletedAt: null
      },
      create: {
        email: testEmail,
        passwordHash: testHash,
        role: "distrito",
        distritoId: distrito?.id || null
      }
    });
  }

  await prisma.config.upsert({
    where: { key: "publish_status" },
    update: {},
    create: { key: "publish_status", value: "false" }
  });

  console.log("Seed completado");
  console.log(`Email: ${email}`);
  if (!isProduction) {
    console.log(`Password temporal: ${password}`);
    console.log(`Usuario local: ${testEmail}`);
    console.log(`Password local: ${testPassword}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
