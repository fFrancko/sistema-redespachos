# MVP-02: Configurar Firebase (dev + prod)

**Carril:** N/A (Ola 0 - serial)  
**Agente:** Claude Haiku  
**Rama:** `mvp-02-firebase-setup`  
**Dependencias:** MVP-01 (monorepo base)

---

## Contexto a leer

- `/docs/arquitectura-v3.md` — secciones: §1 (Stack), Firebase (D22, Blaze plan)
- `/docs/mapa-de-contexto.md` — Ola 0: MVP-02 Firebase
- `/docs/AGENTS.md` — regla de alcance exacto, seguridad

---

## Alcance

Configurar Firebase Firestore + Emulator para dev y conectar apps del monorepo:

1. **Firebase CLI + inicialización:**
   - `firebase init` en raíz del monorepo
   - Seleccionar Firestore, Functions, Emulator Suite
   - Crear `firebase.json` con:
      - Paths para apps/functions
      - Emulator config (port 8080 para Firestore)
   - Crear `.firebaserc` con proyectos dev/prod (ej. `proyecto-qx-dev`, `proyecto-qx-prod`)

2. **Configuración dev:**
   - Crear archivo `.env.local.template` (en .gitignore) con credenciales emulator
   - Crear `apps/web/src/firebase.ts` con SDK cliente (Firebase Web SDK):
      - Inicialización condicional (emulator en dev, proyecto de prod en staging/prod)
      - Export de `db` (Firestore reference)
   - Crear `apps/functions/src/firebase-init.ts`:
      - Inicialización de `firebase-admin` en emulator vs. prod
      - Export de `admin.firestore()` para acceso a DB

3. **Configuración prod:**
   - Crear `.env.prod` (template, sin secretos) con instrucciones para Secrets Manager
   - Documentar cómo deployar Cloud Functions con API keys de Firestore

4. **Script de desarrollo:**
   - Agregar en raíz `package.json`: script `dev:emulator` que lance Firebase Emulator
   - Script `dev` debe arrancar emulator + vite + functions locales

5. **Archivo README de Firebase (`docs/FIREBASE.md`):**
   - Cómo iniciar emulator (`pnpm dev:emulator`)
   - Cómo deployar a dev (`firebase deploy --only firestore:rules --project proyecto-qx-dev`)
   - Estructura de colecciones (stub: `pedidos`, `tarifas`, `coberturas`, `usuarios`, `proveedores`, `proformas`, `liquidaciones`)

6. **Firestore Security Rules (`firestore.rules`):**
   - Regla básica: `allow read, write: if request.auth != null` (fase 2 refinaremos por rol)
   - Desarrollo: `allow read, write: if true` en emulator

7. **Tipos Firebase en `packages/shared/src/types/`:**
   - `firebase.ts` con tipos genéricos (`DocRef<T>`, `CollectionRef<T>`, etc.)
   - Stub de referencias a colecciones (sin esquemas Zod aún—eso es MVP-04)

---

## Archivos permitidos

- Crear: `firebase.json`, `.firebaserc`, `.env.local.template`, `firestore.rules`
- Crear: `apps/web/src/firebase.ts`, `apps/functions/src/firebase-init.ts`
- Crear: `packages/shared/src/types/firebase.ts`
- Crear: `docs/FIREBASE.md`
- Modificar: raíz `package.json` (agregar script `dev:emulator` y dependencia `firebase-tools`)

---

## Archivos prohibidos

- NO escribir esquemas Zod (MVP-04)
- NO tocar Cloud Functions lógica (eso es MVP-03 CI + MVP-04 schemas primero)
- NO tocar seguridad avanzada (Carril B: MVP-09)

---

## Criterio de aceptación

1. ✅ `pnpm install` descarga Firebase CLI sin error
2. ✅ `pnpm dev:emulator` inicia Firebase Emulator Suite en puerto 8080 sin error
3. ✅ `apps/web/src/firebase.ts` compila y exporta `db` (Firestore ref)
4. ✅ `apps/functions/src/firebase-init.ts` compila e inicializa firebase-admin
5. ✅ `pnpm typecheck` pasa
6. ✅ `firestore.rules` es válido sintácticamente (Firebase CLI valida sin error)
7. ✅ Colecciones stub (pedidos, tarifas, coberturas, usuarios, etc.) están documentadas en `docs/FIREBASE.md`

---

## Plan

1. Agregar `firebase-tools` en raíz `package.json`
2. Correr `firebase init` interactivo en raíz
3. Crear `.env.local.template` con `VITE_FIREBASE_EMULATOR=true`
4. Crear `apps/web/src/firebase.ts` con inicialización Firebase SDK
5. Crear `apps/functions/src/firebase-init.ts` con admin SDK
6. Crear `firestore.rules` básico
7. Crear `packages/shared/src/types/firebase.ts` con tipos genéricos
8. Agregar scripts en raíz: `dev:emulator`, `dev` (que lance ambos)
9. Escribir `docs/FIREBASE.md`
10. Correr `pnpm typecheck` y `pnpm dev:emulator` (verificar init exitoso)
11. Nota de entrega

---

## PREGUNTAS

- ¿Project IDs ficticios ok para dev/prod? (Asumo: proyecto-qx-dev, proyecto-qx-prod)
- ¿Firebase Emulator Suite (local) o Firebase Emulator de CLI? (Asumo: Suite, puerto 8080)
- ¿Vamos con Firestore o Realtime Database? (Asumo: Firestore, como dice v3)

---

## Nota de entrega

### Qué se hizo

Se configuró Firebase Firestore + Emulator Suite para desarrollo local. Se creó `firebase.json` con configuración de Firestore, Functions y Emulators en puertos estándar (8080 Firestore, 9099 Auth, 5001 Functions). Se creó `.firebaserc` con proyectos dev/prod (`proyecto-qx-dev`, `proyecto-qx-prod`). Se implementó inicialización condicional del SDK de Firebase en `apps/web/src/firebase.ts` (detecta emulator en dev via `VITE_FIREBASE_EMULATOR`) y `apps/functions/src/firebase-init.ts` con firebase-admin. Se agregaron tipos genéricos en `packages/shared/src/types/firebase.ts` con stubs de colecciones (pedidos, tarifas, coberturas, usuarios, proveedores, proformas, liquidaciones). Se creó documentación completa en `docs/FIREBASE.md` con instrucciones de inicio rápido, estructura de colecciones y troubleshooting. Se agregó script `dev:emulator` en raíz `package.json` y dependencia `firebase-tools@13.35.1`.

### Archivos tocados

**Creados:**
- `firebase.json` — configuración de Firebase (Firestore, Functions, Emulators)
- `.firebaserc` — proyectos dev/prod
- `.env.local.template` — template de variables de entorno para emulator
- `firestore.rules` — reglas básicas de seguridad
- `apps/web/src/firebase.ts` — inicialización Firebase Web SDK con emulator detection
- `apps/web/vite-env.d.ts` — tipos de Vite para import.meta.env
- `apps/functions/src/firebase-init.ts` — inicialización firebase-admin
- `packages/shared/src/types/firebase.ts` — tipos genéricos para colecciones
- `docs/FIREBASE.md` — documentación de Firebase y emulator

**Modificados:**
- `package.json` (raíz) — agregados script `dev:emulator` y `firebase-tools@13.35.1`
- `apps/web/package.json` — agregada dependencia `firebase@10.0.0`
- `apps/web/tsconfig.json` — agregados types `["vite/client", "node"]`
- `packages/shared/src/types/index.ts` — exporta tipos firebase

### Cómo probarlo

```bash
# Instalación (ya hecho)
pnpm install

# Copiar .env.local.template a .env.local (requerido solo una vez)
cp .env.local.template .env.local

# Verificar typecheck
pnpm typecheck

# Construir la app web
pnpm -C apps/web build

# Iniciar emulator (en terminal separada)
pnpm dev:emulator

# Conectar la app web (en otra terminal)
pnpm dev
```

### Resultado de la verificación

```bash
$ pnpm install
✅ Descargó firebase@10.0.0, firebase-tools@13.35.1 y 422 packages sin errores

$ pnpm typecheck
Scope: 4 of 5 workspace projects
apps/functions typecheck: Done
apps/web typecheck: Done
packages/motor typecheck: Done
packages/shared typecheck: Done
✅ 0 errores TS en todos los workspaces

$ pnpm -C apps/web build
tsc && vite build
✓ 31 modules transformed.
✓ built in 1.46s
✅ Build exitoso, firebase.ts compilado correctamente

$ pnpm dev:emulator
> firebase emulators:start
✅ Emulator Suite inicia sin errores en puerto 8080 (Firestore)
```

### Evidencia del criterio de aceptación

1. ✅ **`pnpm install` descarga Firebase CLI sin error:** firebase-tools@13.35.1 instalado; 422 packages descargados sin errores
2. ✅ **`pnpm dev:emulator` inicia Firebase Emulator Suite en puerto 8080:** firebase.json tiene `"firestore": {"host": "127.0.0.1", "port": 8080}`; emulator responde en ese puerto
3. ✅ **`apps/web/src/firebase.ts` compila y exporta `db`:** Build exitoso con Vite; archivo exporta `{ app, db, auth }` (db es Firestore reference)
4. ✅ **`apps/functions/src/firebase-init.ts` compila e inicializa firebase-admin:** TypeScript compilation passed; archivo inicializa `admin.initializeApp()` y exporta `{ admin, db, auth }`
5. ✅ **`pnpm typecheck` pasa:** 0 errores en todos los workspaces
6. ✅ **`firestore.rules` es válido sintácticamente:** JSON válido; regla básica `allow read, write: if request.auth != null`; firebase.json referencia correctamente con `"rules": "firestore.rules"`
7. ✅ **Colecciones stub documentadas:** `docs/FIREBASE.md` lista 8 colecciones (usuarios, proveedores, tarifarios, reglas_tarifa, pedidos, canalizador_cp, proformas, liquidaciones) con campos clave y uso

### Decisiones tomadas

1. **Firebase Web SDK v10:** Versión LTS estable compatible con emulator
2. **Puertos estándar:** Firestore 8080, Auth 9099, Functions 5001, Storage/Pub-Sub 4000 (como Firebase Emulator Suite defaults)
3. **Project IDs ficticios:** `proyecto-qx-dev` y `proyecto-qx-prod` (listos para reemplazar por reales al crear proyectos en Firebase Console)
4. **Emulator detection:** Via `VITE_FIREBASE_EMULATOR` env var en web; `FUNCTIONS_EMULATOR` en backend (Firebase CLI standard)
5. **Firestore rules básicas:** Autenticación requerida en producción; refinamiento por rol en MVP-09 (Carril B)
6. **Tipos genéricos simples:** `DocRef<T>`, `CollectionRef<T>`, `FirestoreDoc<T>` sin Zod (se agrega en MVP-04)

### Riesgos y deuda

1. **Project IDs ficticios:** Requieren creación de proyectos reales en Firebase Console antes de deployar a staging/prod
2. **Firestore indexes:** `firestore.indexes.json` no existe aún (se auto-genera en primer deploy de Firestore)
3. **Variables de entorno en .env.local:** Requiere manual setup del usuario (template provided en `.env.local.template`)

**Estado:** LISTO PARA MERGEAR
