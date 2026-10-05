# Firebase Configuración y Emulador

## Descripción

Firebase Firestore + Emulator Suite para desarrollo local. El emulador permite probar Firestore, Auth, Functions y Storage sin tocar proyectos reales.

## Requisitos previos

- **Node.js** 22 (ver `engines` en `package.json` y `docs/CI.md`)
- **Java** (JRE/JDK 11 o superior) — requerido por Firebase Emulator Suite
  - Windows: descargar desde [oracle.com](https://www.oracle.com/java/technologies/downloads/) o usar `choco install openjdk11`
  - macOS: `brew install openjdk@11`
  - Linux: `sudo apt install openjdk-11-jre`

## Quick Start

### Emulator local

```bash
# Instalación (una sola vez)
pnpm install

# Copiar .env.local.template a .env.local
cp .env.local.template .env.local

# Iniciar emulador
pnpm dev:emulator
```

Se abre la UI en `http://127.0.0.1:4000`.

### Conectar la app web

```bash
# En otra terminal
pnpm dev
```

La app se conecta al emulator si `VITE_FIREBASE_EMULATOR=true` en `.env.local`.

## Estructura de colecciones

Las colecciones de la Fase 1 son las 19 de `docs/arquitectura-v3.md` §2.1. La lista y los esquemas viven en código, en `packages/shared` (`COLLECTION_NAMES` y `collectionSchemas` en `src/types/firebase.ts` y los esquemas en `src/schemas/`). Esa es la fuente; este documento no las repite para que no se desactualicen.

## Proyectos y deploy

`.firebaserc` declara `dev` = **`qx-redespachos-dev`** (proyecto real "Sistema Expresos", creado el 5/10/2026) y `prod` = `proyecto-qx-prod`, que **todavía es un nombre provisorio**: el proyecto de prod se crea en el Hito 1B.

- El deploy de Hosting y Functions a dev lo hace `deploy.yml` (ver `docs/CI.md`). Hoy se omite por falta de secrets, y `apps/functions` todavía no es desplegable (MVP-31).
- **No despliegues reglas de Firestore ni de Storage a ningún proyecto real, ni a mano.** Las reglas actuales son provisorias (ver abajo). Las reglas por rol y sucursal llegan con MVP-07, con tests en el emulador.
- Deploy a prod: no existe todavía; va por tag y en un ticket propio.

## Firestore Security Rules

**Estado actual (provisorio, solo para el emulador):** `allow read, write: if request.auth != null` sobre todas las colecciones. Es **incompatible con producción**: cualquier cuenta autenticada puede leer y escribir todo, y contradice la regla 4 de `AGENTS.md` (el cliente nunca escribe colecciones de negocio). Hay un `CR` propuesto para dejarlas en *deny-all* hasta MVP-07 (H-04).

**MVP-07 (carril B):** reglas por rol (`ADMIN`, `ATENCION_PROVEEDOR`, `ANALISTA`, `BACKOFFICE`, `ADMINISTRACION`) y por sucursal, `storage.rules` y `firestore.indexes.json` (hoy `firebase.json` lo referencia pero no existe).

## Variables de entorno

Ver `.env.local.template` para la configuración completa.

**Clave:** `VITE_FIREBASE_EMULATOR` activa emulator mode en desarrollo.

## Problemas comunes

### Emulator no inicia en puerto 8080

```bash
# Verificar si el puerto está ocupado
# Windows
netstat -ano | findstr :8080

# Matar proceso
taskkill /PID <PID> /F
```

### "FIRESTORE_EMULATOR_HOST already set"

Firebase CLI detectó que ya hay un emulator corriendo. Detener con Ctrl+C en otra terminal.

## Referencias

- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite)
- [Firestore Local Testing](https://firebase.google.com/docs/firestore/security/test-rules-emulator)
- [Proyecto Firebase Dev](https://console.firebase.google.com/project/qx-redespachos-dev)
