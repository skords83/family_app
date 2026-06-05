# ============================================================
# Builder stage
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /repo

# Workspace-Manifeste (frontend-package.json wird mitgekopiert,
# weil npm sonst die in workspaces deklarierte frontend/ vermisst)
COPY package.json package-lock.json* ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# tsconfigs (falls vorhanden — vorausschauend kopiert)
COPY shared/tsconfig.json* ./shared/
COPY backend/tsconfig.json* ./backend/

# Install aller Workspace-Deps. Ja, frontend-Deps werden hier auch gezogen —
# der Builder-Layer ist disposable, dafür braucht's keine Workspace-Surgery.
RUN npm install

# Sources kopieren (frontend braucht's hier nicht — wird im anderen Image gebaut)
COPY shared/ ./shared/
COPY backend/ ./backend/

# Build-Reihenfolge: shared muss vor backend kompiliert sein,
# damit backend die Type-Deklarationen aus shared/dist findet.
RUN npm run --workspace=@family/shared build
RUN npm run --workspace=backend build


# ============================================================
# Runner stage
# ============================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Minimales Root-package.json OHNE frontend-Workspace —
# verhindert dass npm install im Runner Next.js & Co. zieht.
RUN echo '{"name":"family-organizer-backend-runtime","private":true,"workspaces":["backend","shared"]}' > package.json

# Workspace-Manifeste
COPY --from=builder /repo/shared/package.json ./shared/
COPY --from=builder /repo/backend/package.json ./backend/

# Production-only Install — nur backend + shared Runtime-Deps,
# legt /app/node_modules/@family/shared als Symlink nach ../shared.
RUN npm install --omit=dev

# Kompilierte Outputs aus dem Builder
COPY --from=builder /repo/shared/dist ./shared/dist
COPY --from=builder /repo/backend/dist ./backend/dist

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

WORKDIR /app/backend

# Migrate-on-Startup: schema.ts ist idempotent (CREATE/ALTER IF NOT EXISTS),
# also sicheres Re-Run bei jedem Container-Start. Wenn Migrate failed → Container failed.
# Hinweis: direkter node-Aufruf statt `npm run migrate`, weil das Script ts-node nutzt
# (devDep, nicht im Production-Image verfügbar).
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]