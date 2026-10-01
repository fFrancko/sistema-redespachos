# Firebase Configuración y Emulador

## Descripción

Firebase Firestore + Emulator Suite para desarrollo local. El emulador permite probar Firestore, Auth, Functions y Storage sin tocar proyectos reales.

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

Firestore MVP Phase 1 cuenta con estas colecciones (stubs):

| Colección | Uso | Campos clave |
| --- | --- | --- |
| `usuarios` | Perfil y rol | `uid`, `email`, `rol`, `sucursales[]` |
| `proveedores` | Expresos y configuración | `id_proveedor`, `razon_social`, `iva_porcentaje`, `aplica_seguro` |
| `tarifarios` | Versión de tarifas por proveedor | `id_proveedor`, `version`, `vigencia_desde`, `estado` |
| `reglas_tarifa` | Filas del tarifario (tramos) | `tarifario_id`, `tipo_regla`, `codigo_postal_destino`, `precio_tramo` |
| `pedidos` | Pedidos importados y cotizados | `nro_pedido`, `estado`, `cotizacion`, `confirmacion` |
| `canalizador_cp` | Código postal → zona y cobertura | `cp`, `localidad`, `zona`, `cobertura_qx` |
| `proformas` | Proforma por proveedor y lote | `lote_id`, `id_proveedor`, `totales`, `estado` |
| `liquidaciones` | Reportes de liquidación | `fecha`, `monto`, `cantidad_pedidos` |

## Deploy a producción

### Primer deploy (setup)

```bash
# Loguear con Google Cloud
firebase login

# Seleccionar proyecto prod
firebase use prod

# Deploy Firestore rules
firebase deploy --only firestore:rules
```

### Deploy posterior

```bash
# Desde la rama main o tag de release
firebase use prod
firebase deploy --only firestore:rules --project proyecto-qx-prod
```

## Firestore Security Rules

**Desarrollo (emulator):** `allow read, write: if true` (abierto para testing)

**Producción (fase actual):** `allow read, write: if request.auth != null` (solo autenticado)

**Fase 2 (MVP-09):** Reglas por rol (ADMIN, ATENCION_PROVEEDOR, ANALISTA, BACKOFFICE, ADMINISTRACION)

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
- [Proyecto Firebase Dev](https://console.firebase.google.com/project/proyecto-qx-dev)
- [Proyecto Firebase Prod](https://console.firebase.google.com/project/proyecto-qx-prod)
