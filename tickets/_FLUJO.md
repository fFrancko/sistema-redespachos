# Flujo Ola 1 — qué corre en paralelo

Cada fila es un paso. Los dos tickets de la misma fila se pueden largar juntos. Un paso arranca cuando lo de "Requiere mergeado" está en `main`.

| Paso | Carril A (Gemini) | Carril B (Claude) | Requiere mergeado |
| --- | --- | --- | --- |
| 0 | — | — | Commit y push de `tickets/` y `AGENTS.md` |
| 1 | MVP-13 | CR-01 | — |
| 2 | MVP-14 | CR-03 | A: 13 · B: CR-01 |
| 3 | MVP-15 | MVP-31 | A: 14 · B: CR-01 |
| 4 | CR-02 | MVP-05 | B: CR-03 |
| 5 | ⏸ espera | MVP-32 | B: 31 y 05 |
| 6 | ⏸ espera | MVP-08 | B: 31 |
| 7 | ⏸ espera | MVP-06 | B: 05 y 08 |
| 8 | ⏸ espera | MVP-07 | B: 06 |
| 9 | MVP-10 | MVP-30 | A: 31, 07, 08 · B: 06, 07 |
| 10 | ⏸ espera | MVP-09 | B: 07, 08 |
| 11 | MVP-11 | CR-04 | A: 10 y 09 · B: 09 |
| 12 | MVP-12 | MVP-22 | A: 11 · B: CR-04 |
| 13 | MVP-16 | MVP-23 | A: 12 y 14 · B: 22 y 09 |
| 14 | MVP-17 | MVP-24 | A: 10, CR-02, 07, 30 · B: 23 (con datos sembrados) |
| 15 | MVP-18 | MVP-25 | A: 14 y 17 · B: 24 |
| 16 | MVP-19 | MVP-26 | A: 18 · B: 25 y CR-02 |
| 17 | MVP-20 | MVP-27 | A: 18 · B: 26 |
| 18 | MVP-21 | — | A: 19 → **cierre del Hito 1A (modo sombra)** |
| 19 | — | — | MVP-28 y MVP-29 los conducís vos → **cierre del Hito 1B** |

## Reglas
1. **Nunca dos tickets del mismo carril a la vez:** cada uno espera la auditoría y el merge del anterior.
2. **Entre carriles, sí en paralelo**, salvo en las filas con ⏸.
3. **Los ⏸ de A (pasos 5 a 8 y 10)** son esperas a la infraestructura de B. Gemini no queda ocioso: en esos pasos audita los tickets de B.
4. **Auditorías:** cuando un ticket termina, abrí la auditoría en una conversación nueva del otro agente aunque ese agente esté con su propio ticket. Son conversaciones independientes.
5. **Archivos compartidos** (CR-01, CR-03, MVP-31, MVP-32, CR-04, CR-02 y el `vitest.config.ts` de MVP-14): el que se mergea segundo hace rebase antes de entregar.
6. **Si un ticket se atrasa,** buscá su fila: todo lo que dice "Requiere" ese ticket se corre un paso; lo demás sigue.
