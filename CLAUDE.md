# CLAUDE.md

Leé y seguí `AGENTS.md` completo; es la fuente de reglas para este repo.

Específico de Claude Code:
- Una conversación por ticket. Al terminar, cerrá con la nota de entrega y no abras otro ticket.
- Antes de editar, listá los archivos que vas a tocar, verificá que estén en tu carril y esperá el OK de Franco sobre el plan.
- Corré los comandos de verificación vos mismo (secuencia de `AGENTS.md` §5.5, empezando por `Build shared`) y pegá la salida real en la nota de entrega; no afirmes "pasa" sin haberlo corrido.
- Commiteá en la rama del ticket. No pushees, no abras PR, no hagas force-push ni borres ramas o tags: eso lo decide Franco.
- No toques `packages/shared` ni ningún archivo compartido: si hace falta, escribí el `CR` en PREGUNTAS y frená.
- Si el ticket es de auditoría, usá solo lectura y comandos de prueba: no edites código del autor. Los archivos de prueba propios van fuera del repo o sin commitear.
