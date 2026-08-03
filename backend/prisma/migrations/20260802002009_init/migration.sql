-- CreateTable
CREATE TABLE "comisiones" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "evento_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modo_asignacion" TEXT NOT NULL DEFAULT 'individual',
    CONSTRAINT "comisiones_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "eventos" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "distritos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "eventos" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "fecha" DATETIME,
    "distrito_id" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "created_by_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "eventos_distrito_id_fkey" FOREIGN KEY ("distrito_id") REFERENCES "distritos" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "eventos_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "comision_id" INTEGER,
    "distrito_id" INTEGER,
    "ultimo_login" DATETIME,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    CONSTRAINT "users_comision_id_fkey" FOREIGN KEY ("comision_id") REFERENCES "comisiones" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "users_distrito_id_fkey" FOREIGN KEY ("distrito_id") REFERENCES "distritos" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "delegados" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "designacion" TEXT,
    "apellido" TEXT,
    "evento_id" INTEGER,
    "comision_id" INTEGER,
    "asistencia" TEXT NOT NULL DEFAULT 'presente_votando',
    "avanza_etapa" BOOLEAN NOT NULL DEFAULT false,
    "asignacion_grupo" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "delegados_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "eventos" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "delegados_comision_id_fkey" FOREIGN KEY ("comision_id") REFERENCES "comisiones" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "calificaciones" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "delegado_id" INTEGER NOT NULL,
    "oratoria" INTEGER,
    "argumentacion" INTEGER,
    "negociacion" INTEGER,
    "liderazgo" INTEGER,
    "redaccion" INTEGER,
    "ponderada" REAL NOT NULL DEFAULT 0,
    "presente_estado" TEXT,
    "pasa_minume_xvii" BOOLEAN,
    "mencion" TEXT,
    "feedback" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "calificaciones_delegado_id_fkey" FOREIGN KEY ("delegado_id") REFERENCES "delegados" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audits" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" INTEGER,
    "changes" JSONB,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "config" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "value" TEXT,
    "updated_at" DATETIME NOT NULL
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
