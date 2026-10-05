import { describe, expect, it } from 'vitest';
import { COLLECTION_NAMES, collectionSchemas } from './firebase.js';

describe('colecciones de la Fase 1 (§2.1)', () => {
  it('son exactamente 19, sin repetidos', () => {
    expect(COLLECTION_NAMES).toHaveLength(19);
    expect(new Set(COLLECTION_NAMES).size).toBe(19);
  });

  it('cada colección tiene su esquema y no sobran', () => {
    expect(Object.keys(collectionSchemas).sort()).toEqual([...COLLECTION_NAMES].sort());
  });

  it('no incluye las colecciones inventadas por los placeholders', () => {
    for (const invented of ['tarifas', 'coberturas', 'liquidaciones']) {
      expect(COLLECTION_NAMES).not.toContain(invented);
    }
  });

  it('incluye los nombres literales de la arquitectura', () => {
    expect([...COLLECTION_NAMES]).toEqual([
      'usuarios',
      'solicitudes_acceso',
      'sucursales',
      'canalizador_cp',
      'solicitudes_cp',
      'proveedores',
      'indice_cuit',
      'tarifarios',
      'reglas_tarifa',
      'lotes_importacion',
      'pedidos',
      'plantillas_email',
      'proformas',
      'emails_salida',
      'respuestas_proveedor',
      'reportes_liquidacion',
      'reportes_oc',
      'auditoria',
      'parametros',
    ]);
  });
});
