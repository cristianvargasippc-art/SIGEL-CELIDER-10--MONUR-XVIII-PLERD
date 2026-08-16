ALTER TABLE "calificaciones"
  ALTER COLUMN "oratoria" TYPE DOUBLE PRECISION USING "oratoria"::double precision,
  ALTER COLUMN "argumentacion" TYPE DOUBLE PRECISION USING "argumentacion"::double precision,
  ALTER COLUMN "negociacion" TYPE DOUBLE PRECISION USING "negociacion"::double precision,
  ALTER COLUMN "liderazgo" TYPE DOUBLE PRECISION USING "liderazgo"::double precision,
  ALTER COLUMN "redaccion" TYPE DOUBLE PRECISION USING "redaccion"::double precision;
