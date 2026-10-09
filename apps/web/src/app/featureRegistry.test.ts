import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FEATURES } from './featureRegistry';

// AGENTS.md §3: Carril A y Carril B (con `auditoria` y `parametros`, decisión del 5/10).
const EXPECTED = [
  'cotizacion',
  'pedidos',
  'tarifas',
  'canalizador',
  'usuarios',
  'proveedores',
  'sucursales',
  'proformas',
  'liquidacion',
  'oc',
  'auditoria',
  'parametros',
];

describe('registro de features', () => {
  it('tiene exactamente las 12 features de AGENTS.md §3, sin repetidos', () => {
    const ids = FEATURES.map((feature) => feature.id);
    expect(ids).toEqual(EXPECTED);
    expect(new Set(ids).size).toBe(12);
  });

  it('coincide con las carpetas de src/features (agregar o quitar una sin registrarla falla)', () => {
    const dir = fileURLToPath(new URL('../features', import.meta.url));
    const folders = readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    expect([...folders].sort()).toEqual([...EXPECTED].sort());
  });

  it('cada feature es visible al menos para ADMIN', () => {
    for (const feature of FEATURES) expect(feature.roles).toContain('ADMIN');
  });
});
