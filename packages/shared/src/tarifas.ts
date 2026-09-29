/**
 * Contratos de dominio compartidos entre el backend (apps/functions),
 * el frontend (apps/web) y los scripts de ingesta (scripts/).
 *
 * Este archivo no debe importar nada de Node.js: es consumible desde
 * cualquier runtime (Node, Cloud Functions, bundler del navegador).
 */

export type TipoRegla = 'PESO' | 'VOLUMEN';

export type EstadoRegla = 'BORRADOR';

/**
 * Documento plano (desnormalizado) de la colección `reglas_tarifa`.
 *
 * Decisión de diseño: todos los importes y límites son `string` y nunca
 * `number`. En IEEE-754 un `number` no puede representar de forma exacta
 * valores como 1234.56; al venir de un tarifario externo esos valores se
 * pierden antes de llegar a Firestore. El string conserva el texto decimal
 * exacto y además es lo que espera el SDK de Firestore como valor escalar.
 *
 * Los campos opcionales se AUSENTAN del documento cuando no aplican
 * (no se escriben como `null` ni como `""`), para no ensuciar los índices
 * ni las consultas con campos vacíos.
 */
export interface ReglaTarifa {
  /** Identificador del proveedor de transporte. Viene del CLI. */
  id_proveedor: string;
  /** Identificador del tarifario (versión) del que se derivó la regla. */
  tarifario_id: string;
  tipo_regla: TipoRegla;
  provincia_origen: string;
  /** `'*'` cuando la regla aplica a toda la provincia. */
  localidad_origen: string;
  provincia_destino: string;
  localidad_destino: string;
  /** Etiqueta canónica de zona, p. ej. `'Zona facturación 2'`. */
  zona_destino: string;

  // --- Campos según el tipo de regla -------------------------------
  /**
   * Los rangos son intervalos semiabiertos (min, max]: el límite inferior es
   * EXCLUSIVO y el superior INCLUSIVO, de modo que un valor exacto pertenece a
   * un único rango. Ejemplo: `(0;10]`, `(10;25]`. Decimales en string.
   *
   * Filas de excedente (`precio_*_excedente`): `min === max === límite` y la
   * regla aplica a todo lo que SUPERE ese límite.
   */
  kg_min?: string;
  /** Límite superior INCLUSIVO del rango (ver `kg_min`). */
  kg_max?: string;
  m3_min?: string;
  m3_max?: string;

  /**
   * Costo fijo del viaje. `"0"` cuando el tarifario no define viático:
   * el valor por defecto es explícito para que el cálculo downstream
   * pueda sumar sin `undefined`.
   */
  costo_base_viaje: string;

  /** Precio del rango completo (reglas `PESO`). */
  precio_kg_base?: string;
  /** Precio del rango completo (reglas `VOLUMEN`). */
  precio_m3_base?: string;
  /** Precio por unidad que excede el rango (reglas `PESO`). */
  precio_kg_excedente?: string;
  /** Precio por unidad que excede el rango (reglas `VOLUMEN`). */
  precio_m3_excedente?: string;

  aplica_colecta: boolean;
  /** Presente únicamente si `aplica_colecta === true`. */
  costo_colecta?: string;

  estado: EstadoRegla;
}

/**
 * Rango de un tarifario ya normalizado a decimales exactos, con la misma
 * convención (min, max] de `ReglaTarifa`.
 * `esExcedente` marca las filas del tipo `"> 100"`, en las que el valor
 * de la celda no es un precio de rango sino un precio por unidad excedente.
 */
export interface RangoTarifa {
  min: string;
  max: string;
  esExcedente: boolean;
}
