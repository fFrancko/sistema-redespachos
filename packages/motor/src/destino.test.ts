import { describe, it, expect } from 'vitest';
import { orderSchema, postalRouterEntrySchema } from '@sistema-redespachos/shared';
import { resolverDestinoYOrigen } from './destino.js';
import type { MotorOrderInput } from './types.js';

describe('Paso 1: resolverDestinoYOrigen', () => {
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

  it('Resuelve destino correctamente (coincidencia exacta)', () => {
    const pedido = getMotorInput(baseOrder);
    const canalizador = [createCanalizador({ cp: '2000' }), createCanalizador({ cp: '1000' })];

    const result = resolverDestinoYOrigen(pedido, { canalizador });
    expect(result.canalizador.cobertura_qx).toBe('SI');
    expect(result.canalizador.zona).toBe('Z1');
    expect(result.observaciones).toEqual([]);
  });

  it('CP destino ausente del canalizador', () => {
    const pedido = getMotorInput(baseOrder);
    const result = resolverDestinoYOrigen(pedido, { canalizador: [] });

    expect(result.canalizador.cobertura_qx).toBe('DESCONOCIDA');
    expect(result.observaciones).toContain('CP_NO_EN_CANALIZADOR');
  });

  it('CP con varios registros, ninguno coincide localidad y provincia. Se toma el de provincia si es unico', () => {
    const pedido = getMotorInput({
      ...baseOrder,
      localidad: 'OTRA',
      localidad_destino_norm: 'OTRA',
    });
    const canalizador = [
      createCanalizador({
        cp: '2000',
        localidad: 'A',
        provincia: 'SANTA FE',
        cabecera: 'CAB_PROV',
      }),
      createCanalizador({ cp: '2000', localidad: 'B', provincia: 'CORDOBA', cabecera: 'CAB_OTRA' }),
    ];

    const result = resolverDestinoYOrigen(pedido, { canalizador });
    expect(result.canalizador.cabecera).toBe('CAB_PROV');
    expect(result.canalizador.cobertura_qx).toBe('SI');
  });

  it('CP origen ausente', () => {
    const pedido = getMotorInput({ ...baseOrder, codigo_postal_origen: '9999' });
    const canalizador = [createCanalizador({ cp: '2000' })];

    const result = resolverDestinoYOrigen(pedido, { canalizador });
    expect(result.provincia_origen).toBeUndefined();
    expect(result.localidad_origen).toBeUndefined();
    expect(result.observaciones).toContain('CP_NO_EN_CANALIZADOR');
  });

  it('Test 4: alias de provincia (CABA contra canalizador)', () => {
    const pedido = getMotorInput({
      ...baseOrder,
      provincia: 'CABA',
      provincia_destino_norm: 'BUENOS AIRES',
      localidad: 'RETIRO',
      localidad_destino_norm: 'RETIRO',
    });
    const canalizador = [
      createCanalizador({
        cp: '2000',
        localidad: 'RETIRO',
        provincia: 'CAPITAL FEDERAL',
        cabecera: 'CAB_CABA',
      }),
      createCanalizador({
        cp: '2000',
        localidad: 'OTRA',
        provincia: 'CORDOBA',
        cabecera: 'CAB_CORDOBA',
      }),
    ];

    const result = resolverDestinoYOrigen(pedido, { canalizador });
    expect(result.canalizador.cabecera).toBe('CAB_CABA');
  });

  it('Test alias de provincia: RIOJA contra canalizador', () => {
    const pedido = getMotorInput({
      ...baseOrder,
      provincia: 'RIOJA',
      provincia_destino_norm: 'LA RIOJA',
      localidad: 'LA RIOJA',
      localidad_destino_norm: 'LA RIOJA',
    });
    const canalizador = [
      createCanalizador({
        cp: '2000',
        localidad: 'LA RIOJA',
        provincia: 'RIOJA',
        cabecera: 'CAB_RIOJA',
      }),
      createCanalizador({
        cp: '2000',
        localidad: 'OTRA',
        provincia: 'CORDOBA',
        cabecera: 'CAB_CORDOBA',
      }),
    ];

    const result = resolverDestinoYOrigen(pedido, { canalizador });
    expect(result.canalizador.cabecera).toBe('CAB_RIOJA');
  });

  it('CP con varios registros, ninguno coincide provincia y hay varios -> DESCONOCIDA', () => {
    const pedido = getMotorInput({
      ...baseOrder,
      provincia_destino_norm: 'SANTA FE',
    });
    const canalizador = [
      createCanalizador({
        cp: '1000',
        localidad: 'ORIGEN',
        provincia: 'BUENOS AIRES',
        cabecera: 'CAB_ORIGEN',
      }),
      createCanalizador({
        cp: '2000',
        localidad: 'A',
        provincia: 'MENDOZA',
        cabecera: 'CAB_MENDOZA',
      }),
      createCanalizador({
        cp: '2000',
        localidad: 'B',
        provincia: 'CORDOBA',
        cabecera: 'CAB_CORDOBA',
      }),
    ];

    const result = resolverDestinoYOrigen(pedido, { canalizador });
    expect(result.canalizador.cobertura_qx).toBe('DESCONOCIDA');
    expect(result.observaciones).not.toContain('CP_NO_EN_CANALIZADOR');
  });
});
