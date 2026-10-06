import { describe, it, expect } from 'vitest';
import {
  orderSchema,
  tariffRuleSchema,
  postalRouterEntrySchema,
  supplierSchema,
  tariffSchema,
} from '@sistema-redespachos/shared';
import { seleccionarCandidatas } from './candidatas.js';
import type { MotorOrderInput, MotorContext } from './types.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Paso 2: seleccionarCandidatas', () => {
  const createCanalizador = (overrides: Record<string, unknown>) =>
    postalRouterEntrySchema.parse({
      cp: '2000',
      localidad: 'ROSARIO',
      provincia: 'SANTA FE',
      partido: 'ROSARIO',
      zona: 'Z1',
      cabecera: 'CAB1',
      subzona: 'SUB1',
      zona_tarifario: 'ZT1',
      cobertura_qx: true,
      version: 1,
      ...overrides,
    });

  const createProveedor = (overrides: Record<string, unknown>) =>
    supplierSchema.parse({
      id_proveedor: 'PROV1',
      razon_social: 'Prov 1',
      cuit: '30700000008', // CUIT válido (ejemplo sintético)
      email_contacto: ['a@a.com'],
      telefono: '123',
      estado: 'ACTIVO',
      condicion_pago: '30',
      iva_porcentaje: '21',
      aplica_seguro: false,
      creado_por: 'U1',
      creado_en: '2026-10-06T00:00:00.000Z',
      actualizado_por: 'U1',
      actualizado_en: '2026-10-06T00:00:00.000Z',
      ...overrides,
    });

  const createTarifario = (overrides: Record<string, unknown>) => {
    const data = tariffSchema.parse({
      id_proveedor: 'PROV1',
      version: 1,
      vigencia_desde: '2026-01-01',
      vigencia_hasta: null,
      estado: 'VIGENTE',
      creado_por: 'U1',
      creado_en: '2026-10-06T00:00:00.000Z',
      ...overrides,
    });
    return { id: overrides.id || 'TAR1', ...data };
  };

  const createRegla = (overrides: Record<string, unknown>) =>
    tariffRuleSchema.parse({
      tarifario_id: 'TAR1',
      id_proveedor: 'PROV1',
      tipo_regla: 'PESO',
      provincia_origen: 'SANTA FE',
      provincia_destino: 'SANTA FE',
      localidad_destino: 'ROSARIO',
      codigo_postal_destino: '2000',
      zona_destino: 'Z1',
      variante_id: '2000|ROSARIO|Z1',
      kg_min: '0',
      kg_max: '10',
      m3_min: null,
      m3_max: null,
      precio_tramo: '100',
      costo_base_viaje: '0',
      aplica_colecta: false,
      vigencia_desde: '2026-01-01',
      vigencia_hasta: null,
      estado: 'VIGENTE',
      creado_por: 'U1',
      creado_en: '2026-10-06T00:00:00.000Z',
      actualizado_por: 'U1',
      actualizado_en: '2026-10-06T00:00:00.000Z',
      ...overrides,
    });

  const baseOrder = {
    nro_pedido: '1',
    peso_kgs: '10',
    volumen_m3: '1',
    peso_aforado: '10',
    cantidad_bultos: 1,
    fecha_interfaz: '2026-10-06',
    zona_origen: 'Z',
    cabecera_origen: 'C',
    codigo_postal_origen: '1000',
    codigo_postal: '2000',
    localidad: 'ROSARIO',
    provincia: 'SANTA FE',
    origen_tms: {},
    sucursal_id: 'SUC1',
    lote_id: 'LOTE1',
    importado_por: 'U1',
    importado_en: '2026-10-06T00:00:00.000Z',
    observaciones: [],
    cp_destino_norm: '2000',
    provincia_destino_norm: 'SANTA FE',
    localidad_destino_norm: 'ROSARIO',
    estado: 'VALIDADO' as const,
    errores: [],
  };

  const getMotorInput = (order: Record<string, unknown>): MotorOrderInput => {
    const validOrder = orderSchema.parse(order);
    return {
      cp_destino_norm: validOrder.cp_destino_norm,
      localidad_destino_norm: validOrder.localidad_destino_norm,
      provincia_destino_norm: validOrder.provincia_destino_norm,
      codigo_postal_origen: validOrder.codigo_postal_origen,
    };
  };

  const baseContext: MotorContext = {
    canalizador: [
      createCanalizador({
        cp: '1000',
        localidad: 'ORIGEN',
        provincia: 'BUENOS AIRES',
        subzona: 'SUB1',
        cabecera: 'CAB1',
        zona: 'Z1',
        partido: 'P1',
        zona_tarifario: 'ZT1',
      }),
      createCanalizador({
        cp: '2000',
        localidad: 'ROSARIO',
        provincia: 'SANTA FE',
        subzona: 'SUB1',
        cabecera: 'CAB1',
        zona: 'Z1',
        partido: 'P1',
        zona_tarifario: 'ZT1',
      }),
    ],
    proveedores: [createProveedor({})],
    tarifarios: [createTarifario({})],
    reglas: [],
    fecha_referencia: '2026-10-06',
    origen_estricto: false,
  };

  it('Test precedencia origen y ausencia de caída (origen_estricto=false)', () => {
    // Si origen_estricto=false, precedencia es localidad -> *
    // "Si el grupo más específico existe, se usa ese y nunca se cae a uno más general"
    const ctx = {
      ...baseContext,
      reglas: [
        createRegla({
          localidad_origen: 'ORIGEN',
          provincia_origen: 'BUENOS AIRES',
          kg_min: '10',
          kg_max: '20',
        }), // Específico (pero tramo no cubrirá 0-10 en MVP-14)
        createRegla({ provincia_origen: '*', kg_min: '0', kg_max: '100' }), // General (cubre)
      ],
    };
    const res = seleccionarCandidatas(getMotorInput(baseOrder), ctx);

    // Solo debe estar la regla específica, no hay fallback a * aunque no haya tramo de 0 a 10
    expect(res.candidatas[0].reglas_peso).toHaveLength(1);
    expect(res.candidatas[0].reglas_peso[0].localidad_origen).toBe('ORIGEN');
  });

  it('Test origen_estricto=true, provincia coincide', () => {
    const ctx = {
      ...baseContext,
      origen_estricto: true,
      reglas: [
        createRegla({ provincia_origen: 'BUENOS AIRES' }),
        createRegla({ provincia_origen: '*' }),
      ],
    };
    const res = seleccionarCandidatas(getMotorInput(baseOrder), ctx);
    expect(res.candidatas[0].reglas_peso).toHaveLength(1);
    expect(res.candidatas[0].reglas_peso[0].provincia_origen).toBe('BUENOS AIRES');
  });

  it('Test origen_estricto=true, provincia no coincide', () => {
    const ctx = {
      ...baseContext,
      origen_estricto: true,
      reglas: [
        createRegla({ provincia_origen: 'CORDOBA' }),
        createRegla({ provincia_origen: '*' }),
      ],
    };
    const res = seleccionarCandidatas(getMotorInput(baseOrder), ctx);
    // Solo aplica *
    expect(res.candidatas[0].reglas_peso[0].provincia_origen).toBe('*');
  });

  it('Test vigencia bordes', () => {
    const ctx = { ...baseContext, reglas: [createRegla({})] };

    // Igual a vigencia_desde
    ctx.tarifarios = [createTarifario({ vigencia_desde: '2026-10-06' })];
    let res = seleccionarCandidatas(getMotorInput(baseOrder), ctx);
    expect(res.candidatas).toHaveLength(1);

    // Igual a vigencia_hasta
    ctx.tarifarios = [
      createTarifario({ vigencia_desde: '2026-10-01', vigencia_hasta: '2026-10-06' }),
    ];
    res = seleccionarCandidatas(getMotorInput(baseOrder), ctx);
    expect(res.candidatas).toHaveLength(1);

    // Un dia despues de vigencia_hasta
    ctx.tarifarios = [
      createTarifario({ vigencia_desde: '2026-10-01', vigencia_hasta: '2026-10-05' }),
    ];
    res = seleccionarCandidatas(getMotorInput(baseOrder), ctx);
    expect(res.candidatas).toHaveLength(0);
  });

  it('Test CP con varias variantes (misma provincia y distinta)', () => {
    const ctx = {
      ...baseContext,
      reglas: [
        createRegla({ localidad_destino: 'ROSARIO', variante_id: '2000|ROSARIO|Z1' }),
        createRegla({ localidad_destino: 'OTRA', variante_id: '2000|OTRA|Z1' }), // Misma prov
        createRegla({
          localidad_destino: 'OTRA2',
          provincia_destino: 'CORDOBA',
          variante_id: '2000|OTRA2|Z1',
        }), // Distinta prov
      ],
    };
    const res = seleccionarCandidatas(getMotorInput(baseOrder), ctx);
    // Destino pedido: SANTA FE. Se conservan solo las de SANTA FE
    expect(res.candidatas).toHaveLength(2);
    expect(res.candidatas.map((c) => c.variante.localidad).sort()).toEqual(['OTRA', 'ROSARIO']);
    expect(res.observaciones).not.toContain('PROVINCIA_DIFIERE');
  });

  it('Test proveedor INACTIVO con tarifario vigente no aparece', () => {
    const ctx = {
      ...baseContext,
      proveedores: [createProveedor({ estado: 'INACTIVO' })],
      reglas: [createRegla({})],
    };
    const res = seleccionarCandidatas(getMotorInput(baseOrder), ctx);
    expect(res.candidatas).toHaveLength(0);
  });

  it('Test el pedido usa solo los _norm', () => {
    // Para el test 3 de aceptación: construí el pedido con orderSchema.parse() y cambiá los crudos después del parse.
    const validOrder = orderSchema.parse(baseOrder);

    // extraemos la entrada para el motor
    const inputNormal = {
      cp_destino_norm: validOrder.cp_destino_norm,
      localidad_destino_norm: validOrder.localidad_destino_norm,
      provincia_destino_norm: validOrder.provincia_destino_norm,
      codigo_postal_origen: validOrder.codigo_postal_origen,
    };

    const res1 = seleccionarCandidatas(inputNormal, { ...baseContext, reglas: [createRegla({})] });

    const inputModificado = { ...inputNormal };
    // Cambiar los "crudos" acá en el tipo de entrada del motor (si existieran) no tendría efecto
    // porque ni siquiera se los pasamos a seleccionarCandidatas.
    // Para demostrarlo, llamamos con el mismo inputNormal modificado con as any:
    const res2 = seleccionarCandidatas(
      {
        ...inputModificado,
        codigo_postal: 'MAL',
        localidad: 'PEOR',
        provincia: 'DISTINTA',
      } as unknown as MotorOrderInput,
      { ...baseContext, reglas: [createRegla({})] },
    );

    expect(res1.candidatas).toEqual(res2.candidatas);
  });

  it('Test alias de provincia: pedido CABA contra regla CAPITAL FEDERAL', () => {
    const pedido = getMotorInput({
      ...baseOrder,
      provincia: 'CABA',
      provincia_destino_norm: 'BUENOS AIRES',
    });
    const ctx = {
      ...baseContext,
      reglas: [
        createRegla({
          provincia_destino: 'CAPITAL FEDERAL',
          localidad_destino: 'RETIRO',
          variante_id: '2000|RETIRO|Z1',
        }),
      ],
    };
    const res = seleccionarCandidatas(pedido, ctx);
    // normProvincia('CAPITAL FEDERAL', { contraCanalizador: true }) es 'BUENOS AIRES',
    // que coincide con pedido.provincia_destino_norm ('BUENOS AIRES')
    expect(res.candidatas).toHaveLength(1);
  });

  it('Test CP ausente del canalizador', () => {
    const pedido = getMotorInput({ ...baseOrder, codigo_postal: '9999', cp_destino_norm: '9999' });
    const ctx = {
      ...baseContext,
      reglas: [createRegla({ codigo_postal_destino: '9999', variante_id: '9999|ROSARIO|Z1' })],
    };
    const res = seleccionarCandidatas(pedido, ctx);
    expect(res.canalizador.cobertura_qx).toBe('DESCONOCIDA');
    expect(res.observaciones).toContain('CP_NO_EN_CANALIZADOR');
    expect(res.candidatas).toHaveLength(1); // La selección sigue por CP
  });

  it('Determinismo: no hay Date.now ni new Date en src', () => {
    const srcDestino = readFileSync(join(__dirname, 'destino.ts'), 'utf-8');
    const srcCandidatas = readFileSync(join(__dirname, 'candidatas.ts'), 'utf-8');

    expect(srcDestino).not.toMatch(/Date\.now/);
    expect(srcDestino).not.toMatch(/new Date/);
    expect(srcCandidatas).not.toMatch(/Date\.now/);
    expect(srcCandidatas).not.toMatch(/new Date/);
  });

  it('Falla si hay dos tarifarios vigentes', () => {
    const ctx = {
      ...baseContext,
      tarifarios: [createTarifario({ id: 'TAR1' }), createTarifario({ id: 'TAR2' })],
    };
    expect(() => seleccionarCandidatas(getMotorInput(baseOrder), ctx)).toThrowError(
      /Proveedor PROV1 tiene más de un tarifario vigente/,
    );
  });
});
