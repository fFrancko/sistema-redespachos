import { describe, it, expect } from 'vitest';
import {
  orderSchema,
  tariffRuleSchema,
  postalRouterEntrySchema,
  supplierSchema,
  tariffSchema,
  Tariff,
  TariffRule,
} from '@sistema-redespachos/shared';
import { seleccionarCandidatas } from './candidatas.js';
import type { MotorOrderInput, MotorContext } from './types.js';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

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

  const createTarifario = (overrides: Record<string, unknown>): { id: string } & Tariff => {
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
    return { id: String(overrides.id ?? 'TAR1'), ...data };
  };

  const createRegla = (overrides: Record<string, unknown>): { id: string } & TariffRule => {
    const data = tariffRuleSchema.parse({
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
    return { id: String(overrides.id ?? 'REGLA1'), ...data };
  };

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

  it('Test precedencia origen: localidad -> provincia -> * y ausencia de caída', () => {
    // La precedencia es localidad -> provincia -> *
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
    // Para demostrarlo, llamamos con el mismo inputNormal modificado con:
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

  it('Falla si hay dos tarifarios vigentes', () => {
    const ctx = {
      ...baseContext,
      tarifarios: [createTarifario({ id: 'TAR1' }), createTarifario({ id: 'TAR2' })],
    };
    expect(() => seleccionarCandidatas(getMotorInput(baseOrder), ctx)).toThrowError(
      /Proveedor PROV1 tiene más de un tarifario vigente/,
    );
  });

  it('Dos proveedores con el mismo variante_id dan dos candidatas', () => {
    const ctx = {
      ...baseContext,
      proveedores: [
        createProveedor({ id_proveedor: 'PROV1' }),
        createProveedor({ id_proveedor: 'PROV2', cuit: '30700000008' }),
      ],
      tarifarios: [
        createTarifario({ id: 'TAR1', id_proveedor: 'PROV1' }),
        createTarifario({ id: 'TAR2', id_proveedor: 'PROV2' }),
      ],
      reglas: [
        createRegla({ id_proveedor: 'PROV1', tarifario_id: 'TAR1', kg_max: '10' }),
        createRegla({ id_proveedor: 'PROV2', tarifario_id: 'TAR2', kg_max: '20' }),
      ],
    };
    const res = seleccionarCandidatas(getMotorInput(baseOrder), ctx);
    expect(res.candidatas).toHaveLength(2);
    expect(res.candidatas[0].id_proveedor).toBe('PROV1');
    expect(res.candidatas[0].reglas_peso).toHaveLength(1);
    expect(res.candidatas[1].id_proveedor).toBe('PROV2');
    expect(res.candidatas[1].reglas_peso).toHaveLength(1);
  });

  it('Una regla "* / ROSARIO" no se toma como *', () => {
    const ctx = {
      ...baseContext,
      reglas: [createRegla({ provincia_origen: '*', localidad_origen: 'ROSARIO' })],
    };
    // El pedido base tiene origen BUENOS AIRES (por canalizador CP 1000)
    // Entonces esta regla no debería matchear ni como * ni como localidad
    const res = seleccionarCandidatas(getMotorInput(baseOrder), ctx);
    expect(res.candidatas[0].reglas_peso).toHaveLength(0);
  });

  it('origen_estricto=false: reglas solo de BUENOS AIRES para origen SANTA FE', () => {
    // Pedido origen CP 2000 -> SANTA FE / ROSARIO
    const pedido = getMotorInput({ ...baseOrder, codigo_postal_origen: '2000' });
    const ctx = {
      ...baseContext,
      origen_estricto: false,
      reglas: [createRegla({ provincia_origen: 'BUENOS AIRES', localidad_origen: undefined })],
    };
    const res = seleccionarCandidatas(pedido, ctx);
    // Debe tomar las reglas de BUENOS AIRES
    expect(res.candidatas[0].reglas_peso).toHaveLength(1);
    expect(res.candidatas[0].reglas_peso[0].provincia_origen).toBe('BUENOS AIRES');

    const ctxEstricto = { ...ctx, origen_estricto: true };
    const resEstricto = seleccionarCandidatas(pedido, ctxEstricto);
    // Con true no hay reglas
    expect(resEstricto.candidatas[0].reglas_peso).toHaveLength(0);
  });

  it('origen_estricto=false: reglas de dos provincias distintas de la del pedido -> ninguna', () => {
    const pedido = getMotorInput({ ...baseOrder, codigo_postal_origen: '2000' }); // SANTA FE
    const ctx = {
      ...baseContext,
      origen_estricto: false,
      reglas: [
        createRegla({
          provincia_origen: 'BUENOS AIRES',
          localidad_origen: undefined,
          kg_max: '10',
        }),
        createRegla({ provincia_origen: 'CORDOBA', localidad_origen: undefined, kg_max: '20' }),
      ],
    };
    const res = seleccionarCandidatas(pedido, ctx);
    // No toma ninguna por ambigüedad
    expect(res.candidatas[0].reglas_peso).toHaveLength(0);
  });

  it('origen_estricto=false: no devuelve reglas de otra localidad', () => {
    const pedido = getMotorInput({ ...baseOrder, codigo_postal_origen: '2000' });
    const ctx = {
      ...baseContext,
      origen_estricto: false,
      reglas: [createRegla({ provincia_origen: 'BUENOS AIRES', localidad_origen: 'LA PLATA' })],
    };
    const res = seleccionarCandidatas(pedido, ctx);
    expect(res.candidatas[0].reglas_peso).toHaveLength(0);
  });

  it('origen_estricto=false: toma provincia si se mezcla con otra', () => {
    const pedido = getMotorInput({ ...baseOrder, codigo_postal_origen: '2000' });
    const ctx = {
      ...baseContext,
      origen_estricto: false,
      reglas: [
        createRegla({ provincia_origen: 'BUENOS AIRES', localidad_origen: undefined }),
        createRegla({ provincia_origen: 'CORDOBA', localidad_origen: 'RIO CUARTO' }),
      ],
    };
    // Las reglas de otras provincias sin localidad_origen son solo BUENOS AIRES.
    // La regla de CORDOBA tiene localidad, por ende se ignora en el fallback.
    // Luego provinciasDistintas.size === 1 (BUENOS AIRES). Toma las de BUENOS AIRES.
    const res = seleccionarCandidatas(pedido, ctx);
    expect(res.candidatas[0].reglas_peso).toHaveLength(1);
    expect(res.candidatas[0].reglas_peso[0].provincia_origen).toBe('BUENOS AIRES');
  });

  it('origen_estricto=false: CP desconocido solo aplica *', () => {
    const pedido = getMotorInput({ ...baseOrder, codigo_postal_origen: '9999' });
    const ctx = {
      ...baseContext,
      origen_estricto: false,
      reglas: [createRegla({ provincia_origen: 'BUENOS AIRES', localidad_origen: undefined })],
    };
    // Origen desconocido -> provincia_origen es undefined. El fallback requiere provincia_origen !== undefined.
    const res = seleccionarCandidatas(pedido, ctx);
    expect(res.candidatas[0].reglas_peso).toHaveLength(0);
  });

  it('Test alias de provincia: pedido RIOJA contra regla LA RIOJA', () => {
    const pedido = getMotorInput({
      ...baseOrder,
      provincia: 'RIOJA',
      provincia_destino_norm: 'LA RIOJA',
    });
    const ctx = {
      ...baseContext,
      reglas: [
        createRegla({
          provincia_destino: 'RIOJA',
          localidad_destino: 'RIOJA',
          variante_id: '2000|RIOJA|Z1',
        }),
        createRegla({
          provincia_destino: 'CORDOBA',
          localidad_destino: 'CORDOBA',
          variante_id: '2000|CORDOBA|Z1',
        }),
      ],
    };
    const res = seleccionarCandidatas(pedido, ctx);
    expect(res.candidatas).toHaveLength(1);
    expect(res.candidatas[0].variante_id).toBe('2000|RIOJA|Z1');
    expect(res.observaciones).not.toContain('PROVINCIA_DIFIERE');
  });

  it('Test alias CABA: pedido CABA contra regla CAPITAL FEDERAL con variante extra', () => {
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
        createRegla({
          provincia_destino: 'CORDOBA',
          localidad_destino: 'CORDOBA',
          variante_id: '2000|CORDOBA|Z1',
        }),
      ],
    };
    const res = seleccionarCandidatas(pedido, ctx);
    expect(res.candidatas).toHaveLength(1);
    expect(res.candidatas[0].variante_id).toBe('2000|RETIRO|Z1');
    expect(res.observaciones).not.toContain('PROVINCIA_DIFIERE');
  });

  it('Test precedencia: L1 vs L2 vs *', () => {
    const pedido = getMotorInput(baseOrder);
    const ctx = {
      ...baseContext,
      reglas: [
        createRegla({ id: 'R1', localidad_origen: 'ORIGEN', provincia_origen: 'BUENOS AIRES' }),
        createRegla({ id: 'R2', localidad_origen: undefined, provincia_origen: 'BUENOS AIRES' }),
        createRegla({ id: 'R3', localidad_origen: undefined, provincia_origen: '*' }),
      ],
    };
    const res = seleccionarCandidatas(pedido, ctx);
    expect(res.candidatas[0].reglas_peso).toHaveLength(1);
    expect(res.candidatas[0].reglas_peso[0].id).toBe('R1');
  });

  it('Test precedencia: regla con localidad de origen correcta pero OTRA provincia vs L2', () => {
    const pedido = getMotorInput(baseOrder);
    const ctx = {
      ...baseContext,
      reglas: [
        createRegla({ id: 'R1', localidad_origen: 'ORIGEN', provincia_origen: 'CORDOBA' }),
        createRegla({ id: 'R2', localidad_origen: undefined, provincia_origen: 'BUENOS AIRES' }),
      ],
    };
    const res = seleccionarCandidatas(pedido, ctx);
    expect(res.candidatas[0].reglas_peso).toHaveLength(1);
    expect(res.candidatas[0].reglas_peso[0].id).toBe('R2');
  });

  it('Determinismo: dos corridas con misma entrada', () => {
    const pedido = getMotorInput(baseOrder);
    const ctx = {
      ...baseContext,
      reglas: [
        createRegla({ id: 'R1', variante_id: '2000|ROSARIO|Z1' }),
        createRegla({ id: 'R2', variante_id: '2000|ROSARIO|Z1' }),
      ],
    };
    const res1 = seleccionarCandidatas(pedido, ctx);
    const res2 = seleccionarCandidatas(pedido, ctx);
    expect(res1).toStrictEqual(res2);
  });

  it('Test PROVINCIA_DIFIERE: dos variantes de otra provincia', () => {
    const pedido = getMotorInput({ ...baseOrder, provincia_destino_norm: 'SANTA FE' });
    const ctx = {
      ...baseContext,
      proveedores: [
        createProveedor({ id_proveedor: 'P1' }),
        createProveedor({ id_proveedor: 'P2', cuit: '30700000008' }),
      ],
      tarifarios: [
        createTarifario({ id_proveedor: 'P1', id: 'T1' }),
        createTarifario({ id_proveedor: 'P2', id: 'T2' }),
      ],
      reglas: [
        createRegla({
          id_proveedor: 'P1',
          tarifario_id: 'T1',
          provincia_destino: 'CORDOBA',
          localidad_destino: 'CORDOBA',
          variante_id: '2000|CORDOBA|Z1',
        }),
        createRegla({
          id_proveedor: 'P2',
          tarifario_id: 'T2',
          provincia_destino: 'MENDOZA',
          localidad_destino: 'MENDOZA',
          variante_id: '2000|MENDOZA|Z1',
        }),
      ],
    };
    const res = seleccionarCandidatas(pedido, ctx);
    expect(res.candidatas).toHaveLength(2);
    expect(res.observaciones.filter((o: string) => o === 'PROVINCIA_DIFIERE')).toHaveLength(1);
  });

  it('Test origen desconocido con regla * (H-7)', () => {
    const pedido = getMotorInput({ ...baseOrder, codigo_postal_origen: '9999' });
    const ctx = {
      ...baseContext,
      origen_estricto: false,
      reglas: [
        createRegla({ id: 'R1', provincia_origen: 'BUENOS AIRES', localidad_origen: undefined }),
        createRegla({ id: 'R2', provincia_origen: '*', localidad_origen: undefined }),
      ],
    };
    const res = seleccionarCandidatas(pedido, ctx);
    expect(res.candidatas[0].reglas_peso).toHaveLength(1);
    expect(res.candidatas[0].reglas_peso[0].id).toBe('R2');

    const ctxEstricto = { ...ctx, origen_estricto: true };
    const resEstricto = seleccionarCandidatas(pedido, ctxEstricto);
    expect(resEstricto.candidatas[0].reglas_peso).toHaveLength(1);
    expect(resEstricto.candidatas[0].reglas_peso[0].id).toBe('R2');
  });

  it('Test vigencia: HISTORICO y BORRADOR', () => {
    const pedido = getMotorInput(baseOrder);
    const baseRegla = createRegla({ id: 'R1', tarifario_id: 'T1' });

    let ctx = {
      ...baseContext,
      tarifarios: [
        createTarifario({
          id: 'T1',
          estado: 'HISTORICO',
          vigencia_desde: '2026-01-01',
          vigencia_hasta: '2026-12-31',
        }),
      ],
      reglas: [baseRegla],
    };
    expect(seleccionarCandidatas(pedido, ctx).candidatas).toHaveLength(1);

    const regla2 = createRegla({ id: 'R2', tarifario_id: 'T2' });
    ctx = {
      ...baseContext,
      tarifarios: [
        createTarifario({
          id: 'T1',
          estado: 'HISTORICO',
          vigencia_desde: '2025-01-01',
          vigencia_hasta: '2026-10-05',
        }),
        createTarifario({ id: 'T2', estado: 'VIGENTE', vigencia_desde: '2026-10-06' }),
      ],
      reglas: [baseRegla, regla2],
    };
    const res2 = seleccionarCandidatas(pedido, ctx);
    expect(res2.candidatas).toHaveLength(1);
    expect(res2.candidatas[0].tarifario_id).toBe('T2');

    ctx = {
      ...baseContext,
      tarifarios: [createTarifario({ id: 'T1', estado: 'BORRADOR' })],
      reglas: [baseRegla],
    };
    expect(seleccionarCandidatas(pedido, ctx).candidatas).toHaveLength(0);
  });

  it('Test id en reglas (D-3)', () => {
    const pedido = getMotorInput(baseOrder);
    const ctx = {
      ...baseContext,
      reglas: [
        createRegla({ id: 'REGLA_CON_ID_1', tipo_regla: 'PESO' }),
        createRegla({
          id: 'REGLA_CON_ID_2',
          tipo_regla: 'VOLUMEN',
          kg_min: null,
          kg_max: null,
          m3_min: '0',
          m3_max: '10',
        }),
      ],
    };
    const res = seleccionarCandidatas(pedido, ctx);
    expect(res.candidatas[0].reglas_peso[0].id).toBe('REGLA_CON_ID_1');
    expect(res.candidatas[0].reglas_volumen[0].id).toBe('REGLA_CON_ID_2');
  });

  it('Determinismo: no hay Date.now ni new Date en src', () => {
    function getFiles(dir: string): string[] {
      const subdirs = readdirSync(dir);
      const files = subdirs.map((subdir: string) => {
        const res = resolve(dir, subdir);
        return statSync(res).isDirectory() ? getFiles(res) : res;
      });
      return files.reduce((a: string[], f: string | string[]) => a.concat(f), []);
    }

    const srcFiles = getFiles(__dirname).filter(
      (f: string) => f.endsWith('.ts') && !f.endsWith('.test.ts'),
    );

    for (const f of srcFiles) {
      const fc = readFileSync(f, 'utf-8');
      expect(fc).not.toMatch(/Date\.now/);
      expect(fc).not.toMatch(/new Date/);
    }
  });
});
