import { Router } from "express";
import { prisma } from "../db.js";
import { authorize, verifyToken } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { publishSchema } from "../schemas.js";

export const configRouter = Router();

async function getPublished() {
  const config = await prisma.config.findUnique({ where: { key: "publish_status" } });
  return config?.value === "true";
}

configRouter.get("/publish-status", async (_req, res) => {
  return res.json({ published: await getPublished() });
});

configRouter.patch("/publish", verifyToken, authorize("superadmin"), validate(publishSchema), async (req, res) => {
  await prisma.config.upsert({
    where: { key: "publish_status" },
    update: { value: String(req.body.publish) },
    create: { key: "publish_status", value: String(req.body.publish) }
  });
  await prisma.audit.create({
    data: {
      userId: req.user.id,
      action: req.body.publish ? "calificaciones_publicadas" : "calificaciones_ocultadas",
      entityType: "config",
      changes: { publish: req.body.publish }
    }
  });
  return res.json({ success: true });
});

export { getPublished };
