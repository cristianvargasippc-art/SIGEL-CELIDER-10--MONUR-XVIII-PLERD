-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

DO $$
BEGIN
  CREATE TYPE "role" AS ENUM ('superadmin', 'regional', 'distrito', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "estado_user" AS ENUM ('activo', 'inactivo');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "presente_estado" AS ENUM ('presente_votando', 'ausente');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "estado_evento" AS ENUM ('borrador', 'activo', 'cerrado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "modo_asignacion" AS ENUM ('individual', 'duplas');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE "comisiones" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "evento_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modo_asignacion" "modo_asignacion" NOT NULL DEFAULT 'individual',

    CONSTRAINT "comisiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distritos" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(10) NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "distritos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(180) NOT NULL,
    "fecha" TIMESTAMP(3),
    "distrito_id" INTEGER NOT NULL,
    "estado" "estado_evento" NOT NULL DEFAULT 'borrador',
    "created_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "role" NOT NULL,
    "comision_id" INTEGER,
    "distrito_id" INTEGER,
    "ultimo_login" TIMESTAMP(3),
    "estado" "estado_user" NOT NULL DEFAULT 'activo',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delegados" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "designacion" VARCHAR(255),
    "apellido" VARCHAR(120),
    "evento_id" INTEGER,
    "comision_id" INTEGER,
    "asistencia" "presente_estado" NOT NULL DEFAULT 'presente_votando',
    "avanza_etapa" BOOLEAN NOT NULL DEFAULT false,
    "asignacion_grupo" VARCHAR(80),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delegados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calificaciones" (
    "id" SERIAL NOT NULL,
    "delegado_id" INTEGER NOT NULL,
    "oratoria" INTEGER,
    "argumentacion" INTEGER,
    "negociacion" INTEGER,
    "liderazgo" INTEGER,
    "redaccion" INTEGER,
    "ponderada" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "presente_estado" "presente_estado",
    "pasa_minume_xvii" BOOLEAN,
    "mencion" TEXT,
    "feedback" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audits" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" INTEGER,
    "changes" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "value" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comisiones_evento_id_idx" ON "comisiones"("evento_id");

-- CreateIndex
CREATE UNIQUE INDEX "comisiones_nombre_evento_id_key" ON "comisiones"("nombre", "evento_id");

-- CreateIndex
CREATE UNIQUE INDEX "distritos_codigo_key" ON "distritos"("codigo");

-- CreateIndex
CREATE INDEX "eventos_distrito_id_idx" ON "eventos"("distrito_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_distrito_id_idx" ON "users"("distrito_id");

-- CreateIndex
CREATE INDEX "delegados_evento_id_idx" ON "delegados"("evento_id");

-- CreateIndex
CREATE INDEX "delegados_comision_id_idx" ON "delegados"("comision_id");

-- CreateIndex
CREATE INDEX "delegados_nombre_idx" ON "delegados"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "calificaciones_delegado_id_key" ON "calificaciones"("delegado_id");

-- CreateIndex
CREATE INDEX "calificaciones_delegado_id_idx" ON "calificaciones"("delegado_id");

-- CreateIndex
CREATE INDEX "calificaciones_ponderada_idx" ON "calificaciones"("ponderada");

-- CreateIndex
CREATE INDEX "audits_user_id_idx" ON "audits"("user_id");

-- CreateIndex
CREATE INDEX "audits_created_at_idx" ON "audits"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "config_key_key" ON "config"("key");

-- AddForeignKey
ALTER TABLE "comisiones" ADD CONSTRAINT "comisiones_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "eventos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_distrito_id_fkey" FOREIGN KEY ("distrito_id") REFERENCES "distritos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_comision_id_fkey" FOREIGN KEY ("comision_id") REFERENCES "comisiones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_distrito_id_fkey" FOREIGN KEY ("distrito_id") REFERENCES "distritos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegados" ADD CONSTRAINT "delegados_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "eventos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegados" ADD CONSTRAINT "delegados_comision_id_fkey" FOREIGN KEY ("comision_id") REFERENCES "comisiones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calificaciones" ADD CONSTRAINT "calificaciones_delegado_id_fkey" FOREIGN KEY ("delegado_id") REFERENCES "delegados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audits" ADD CONSTRAINT "audits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

