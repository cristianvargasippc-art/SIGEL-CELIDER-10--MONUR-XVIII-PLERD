# SISTEMA SIGEL MONUR XVIII R-10

Aplicacion web para calificacion de delegados del Modelo de Naciones Unidas MONUR XVIII.

## Estructura

- `frontend/`: React + Vite, interfaz en espanol con el logo institucional adaptado en formato circular.
- `backend/`: Express + Prisma, API base con autenticacion JWT, validacion y calculo de ponderada.
- `imagenes/`: logo original del Club Escolar R-10.

## Inicio rapido

```bash
npm install
npm run dev:frontend
```

Para el backend:

```bash
cd backend
cp .env.example .env
npm run dev
```

Antes de produccion, configura `DATABASE_URL`, `JWT_SECRET`, SMTP y Upstash Redis en `backend/.env`.
