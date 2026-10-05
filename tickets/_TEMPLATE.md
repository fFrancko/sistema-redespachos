# MVP-XX — <título>

- **Carril:** A | B | Ola 0
- **Agente:** Claude Code | Gemini
- **Rama:** `mvp-XX-<slug>`
- **Depende de:** <tickets>

## Contexto a leer
- `docs/arquitectura-v3.md`: §<…>, decisiones <D…>
- Código previo: <rutas>
- Fixtures: <rutas>

## Alcance
<qué se construye, en una lista corta>

## Archivos permitidos
<rutas o carpetas>

## Archivos prohibidos
Todo lo que no figure arriba. Lo compartido requiere un PR `CR:` (ver `AGENTS.md` §3).

## Criterio de aceptación
<copiar literal de la arquitectura v3, §4. Si se recorta algo, decir a qué ticket va>

## Plan
<lo completa el agente antes de codear, con la lista de archivos a tocar; Franco da el OK>

## PREGUNTAS
<dudas, contradicciones entre fuentes, datos que faltan>

---

## Nota de entrega (la completa el agente al terminar)
- **Qué se hizo:** <3 a 6 líneas>
- **Commit:** <hash en la rama `mvp-XX-<slug>`; sin push ni PR>
- **Archivos tocados:** <lista, y la salida de `git diff --stat origin/main...HEAD`>
- **Cómo probarlo:** <comandos exactos>
- **Resultado de la verificación:** <pegar la salida real de la secuencia de `AGENTS.md` §5.5: install congelado, `Build shared`, lint, typecheck, test y build>
- **Consumo real:** <si otro paquete importa tu código o corre en Node: cómo lo probaste; si no aplica, "no aplica">
- **Evidencia del criterio de aceptación:** <test o comando que lo prueba>
- **Decisiones tomadas:** <las que no estaban en la arquitectura>
- **Supuestos:** <los que tomaste sin respuesta de Franco>
- **Fuera de alcance:** <lo que quedó afuera y el ticket al que va, o "sin ticket">
- **Riesgos y deuda:** <lo que el auditor debería mirar primero>
