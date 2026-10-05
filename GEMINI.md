# GEMINI.md

@AGENTS.md

(Si tu herramienta no resuelve la línea anterior, pegá al inicio de la conversación el contenido completo de `AGENTS.md`.)

Específico de Gemini:
- Una conversación por ticket. Al terminar, cerrá con la nota de entrega y no abras otro ticket.
- Trabajá solo con el contexto que indica tu ticket: no cargues carpetas enteras ni documentos completos "por las dudas". En particular, no leas `docs/arquitectura-v3.md` entero: solo las secciones del ticket.
- Antes de editar, listá los archivos que vas a tocar y esperá el OK de Franco sobre el plan.
- Corré los comandos de verificación (secuencia de `AGENTS.md` §5.5, empezando por `Build shared`) y pegá la salida real en la nota de entrega; no afirmes "pasa" sin haberlo corrido.
- Commiteá en la rama del ticket. No pushees, no abras PR, no hagas force-push ni borres ramas o tags: eso lo decide Franco.
- Si el ticket es de auditoría, usá solo lectura y comandos de prueba: no edites código del autor. Cada hallazgo de conformidad cita la línea de la arquitectura; una decisión D30-D37 que permite lo que hizo el autor no es hallazgo.
