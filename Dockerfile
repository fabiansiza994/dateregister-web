# ===== STAGE 1: build =====
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Fuerza build prod
RUN npm run build -- --configuration production

# ===== STAGE 2: nginx =====
FROM nginx:1.27-alpine

# Config SPA (fallback a index.html)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Limpia html por defecto (para no ver "Welcome to nginx!")
RUN rm -rf /usr/share/nginx/html/*

# COPIA build Angular:
# 1) Angular >=16/17: dist/<app-name>/browser/*
# 2) Angular <16:     dist/*
# Usamos dos COPY con --chown y `|| true` para no fallar si una no existe.
# (alpine busybox no soporta "|| true" en COPY, así que hacemos dos COPY independientes; la que no matchee será ignorada).

COPY --from=builder /app/dist/*/browser/ /usr/share/nginx/html/
COPY --from=builder /app/dist/ /usr/share/nginx/html/

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
