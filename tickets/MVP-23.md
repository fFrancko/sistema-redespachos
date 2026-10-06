# MVP-23 — Plantillas de email parametrizables

- **Carril:** B · Plataforma y circuito
- **Agente:** Claude Code · **Modelo:** Sonnet 5.5 · **Esfuerzo:** high
- **Auditor:** Gemini · auditoría estándar + intento de inyección (HTML, helpers de Handlebars, variables fuera del catálogo)
- **Rama:** `mvp-23-email-templates`
- **Depende de:** MVP-22 y MVP-09 mergeados.

## Contexto a leer
- `docs/arquitectura-v3.md`: §3.4 (punto Parametrización), §2.5 (`plantillas_email`), §2.2 (`email_config`), §3.8 (fila `emailTemplates.upsert`), D16, §6.1 (fila de plantillas editables).
- `docs/documentacion-funcional.md`: §7.7.
- `packages/shared`: `schemas/emails.ts`, `schemas/suppliers.ts`.

## Alcance
1. **`emailTemplates.upsert`** (`ADMIN`, `ATENCION_PROVEEDOR`): valida con el esquema; compila el `asunto` y el `cuerpo_html` con Handlebars y **rechaza cualquier variable fuera del catálogo** (`proveedor.razon_social`, `lote.id`, `fecha`, `resumen.cantidad`, `resumen.neto`, `resumen.iva`, `resumen.total`), helpers, parciales y triple llave `{{{ }}}`; columnas del adjunto solo del catálogo de §2.5; una sola plantilla `es_default`. Con `withAudit`.
2. **Resolución de destinatarios** como función pura y probada: `email_contacto` del proveedor + `para_extra`, `cc` y `cco` de la plantilla y del proveedor, sin duplicados; `email_config.plantilla_id` reemplaza a la plantilla por defecto.
3. **Vista previa** con datos de ejemplo, obligatoria antes de guardar (la UI no habilita Guardar sin una vista previa de la versión actual).
4. **Web:** lista y editor de plantillas; selector de plantilla en el formulario de proveedor (habilita lo que MVP-09 dejó vacío).

## Archivos permitidos
`apps/functions/src/callables/emailTemplates/**`, el `index.ts` del dominio `emailTemplates`, `apps/functions/src/emails/render/**` (nuevo, usado por MVP-24), `apps/web/src/features/proformas/plantillas/**`, `apps/web/src/features/proveedores/**` (solo el selector), tests junto al código, este ticket.

## Archivos prohibidos
Todo lo demás.

## Criterio de aceptación
Literal de la arquitectura §4: **"Cambiar el CC o las columnas de una plantilla cambia el siguiente email sin desplegar código; una variable fuera del catálogo se rechaza."**

Agregados:
1. Test: `{{proveedor.cuit}}`, `{{#each}}`, `{{> parcial}}` y `{{{resumen.total}}}` se rechazan.
2. Test: un valor con `<script>` en `razon_social` sale escapado en el HTML.
3. Test de la resolución de destinatarios: duplicados entre proveedor y plantilla aparecen una sola vez.
4. Test: guardar una segunda plantilla `es_default` desmarca la anterior en la misma transacción.
5. Secuencia de `AGENTS.md` §5.5 y tests con emuladores en verde, con la salida pegada.

## Plan
<lo completa el agente antes de codear; Franco da el OK>

## PREGUNTAS
<dudas del agente>

---

## Nota de entrega
Usar la plantilla de `tickets/_TEMPLATE.md`.
