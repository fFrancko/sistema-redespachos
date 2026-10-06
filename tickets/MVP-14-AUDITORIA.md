# Auditoría cruzada - MVP-14

## Verificación

Se corrió la secuencia de verificación desde la rama `mvp-14-motor-calculo` en un estado limpio:
- `pnpm install --frozen-lockfile` -> OK
- `pnpm format:check` -> OK
- `pnpm ci:run` -> OK (583 tests pasaron, build correcto)
- `pnpm test:coverage --filter @sistema-redespachos/motor` (ejecutado a nivel paquete) -> OK (99.77% líneas, 96.27% ramas). El umbral en `vitest.config.ts` corta si baja del 90%.
- Búsqueda manual de `Number`, `parseFloat`, `km`, `parada` en `src` -> Ninguna coincidencia.

## Criterio de aceptación

1. **Cobertura de tests de 90% o más:** Cumplido (99.77%).
2. **Caso de referencia 1 exacto $4.139,20 y 2 da flete de $530.000,00:** Cumplido, comprobado empíricamente en el consumo desde `dist`.
3. **Ningún cálculo usa `number` para dinero:** Cumplido, se utiliza la librería `decimal.js` y las variables tipadas a `cents` y `dec`.
4. **No existe variable de km ni paradas:** Cumplido.
5. **Agregado 1 a 10 del ticket:** Todos cumplidos, el autor detalla e implementa todas las casuísticas de `descartes`, los resultados esperados (`COBERTURA_QX`, `VALORIZADO`, `SIN_COBERTURA`), el redondeo half-up a centavos para cada componente, etc.

## Conformidad con la arquitectura

Se respetan los nombres de campos, estados y fórmulas según `docs/arquitectura-v3.md §3.3`. 
Se tomó en cuenta la regla `CP_AMBIGUO` interpretada a nivel proveedor, la regla de seguro solo si el proveedor lo exige, y la excepciòn de desempate por tipo de tramo si uno tiene reglas y el otro no (R7). 

## Auditoría adicional del motor

Se validaron lógicamente los flujos de cálculo, los tests rigurosos implementados en `packages/motor/src/calculo.test.ts` y las pruebas de los bordes. El cálculo de los casos base da el mismo resultado que la implementación manual estricta del documento de arquitectura.

## Hallazgos

No se registraron hallazgos que incumplan la arquitectura, que produzcan fallos en casos de borde, ni errores de diseño. Se solucionó satisfactoriamente la deuda técnica arrastrada de H-4(a) en el PR anterior.

## Veredicto final

**APROBADO.**

- **Código:** `packages/motor` en la rama `mvp-14-motor-calculo`.
- **Decisiones para Franco:** 
  - Generar el CR de documentación para `docs/arquitectura-v3.md` (Paso 5 de §3.3) que formalice la excepción del empate entre criterios introducida por R7 (cuando `costo_peso == costo_volumen`, si uno de los dos no tiene reglas, gana el criterio que SÍ tiene reglas).
