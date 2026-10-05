import { describe, expect, it } from 'vitest';
import {
  TMS_ALL_COLUMNS,
  TMS_COLUMNS,
  TMS_COLUMN_BY_KEY,
  TMS_OPTIONAL_COLUMNS,
  normalizeHeader,
  resolveTmsHeaders,
} from './headers.js';

const EXPECTED_47 = [
  'Código de Empresa',
  'Código ERP',
  'Tipo de Operación',
  'Nro Pedido',
  'Tipo de Servicio',
  'Categoría',
  'Sub Categoria',
  'Código de Referencia',
  'Peso Kgs',
  'Volumen M3',
  'Peso Aforado',
  'Cantidad de Bultos',
  'Valor Declarado',
  'Valor Contra Reembolso',
  'Tipo de Vehículo',
  'Nro de Liquidación',
  'Fecha de Liquidación',
  'Id Tarifa',
  'Valor Calculado Tarifa',
  'Valor Calculado Seguro',
  'Valor Calculado Reembolso',
  'Total a Facturar',
  'Status',
  'Fecha Status',
  'Fecha de Interfaz',
  'Zona Origen',
  'Cabecera Origen',
  'Destinatario',
  'Dirección',
  'Número',
  'Código Postal',
  'Localidad',
  'Provincia',
  'Zona Destino',
  'Cabecera',
  'Fecha de Alta',
  'Representante',
  'Código de Dock',
  'Codigo de Expreso',
  'Nro Carta Porte',
  'Fecha de Carta de Porte',
  'Transporte',
  'Chofer',
  'Patente',
  'Usuario Liquidación',
  'IdLiquidacion',
  'Código Postal Origen',
];

describe('normalizeHeader', () => {
  it.each([
    ['Nro Pedido:', 'nro pedido'],
    ['Nro Pedido', 'nro pedido'],
    ['  Código Postal Origen : ', 'codigo postal origen'],
    ['CÓDIGO POSTAL:', 'codigo postal'],
    ['Dirección:', 'direccion'],
    ['Tipo de Vehículo::', 'tipo de vehiculo'],
    ['﻿Código de Empresa:', 'codigo de empresa'],
    ['Peso   Kgs', 'peso kgs'],
    ['alto_cm', 'alto_cm'],
  ])('%j → %j', (input, expected) => {
    expect(normalizeHeader(input)).toBe(expected);
  });

  it('ignora el : final, las tildes y las mayúsculas a la vez', () => {
    expect(normalizeHeader('Código de Empresa:')).toBe(normalizeHeader('CODIGO DE EMPRESA'));
  });

  it('distingue Cabecera de Cabecera Origen y Código Postal de Código Postal Origen', () => {
    expect(normalizeHeader('Cabecera:')).not.toBe(normalizeHeader('Cabecera Origen:'));
    expect(normalizeHeader('Código Postal:')).not.toBe(normalizeHeader('Código Postal Origen:'));
  });
});

describe('columnas del TMS', () => {
  it('son 47 en el orden de §7.4 más 3 opcionales al final', () => {
    expect(TMS_COLUMNS).toHaveLength(47);
    expect(TMS_COLUMNS.map((column) => column.header)).toEqual(EXPECTED_47);
    expect(TMS_OPTIONAL_COLUMNS.map((column) => column.header)).toEqual([
      'alto_cm',
      'ancho_cm',
      'largo_cm',
    ]);
    expect(TMS_ALL_COLUMNS).toHaveLength(50);
    expect(TMS_ALL_COLUMNS.slice(47)).toEqual([...TMS_OPTIONAL_COLUMNS]);
  });

  it('las claves normalizadas no se repiten', () => {
    expect(new Set(TMS_ALL_COLUMNS.map((column) => column.key)).size).toBe(50);
  });

  it('Cabecera y Cabecera Origen se mapean a campos distintos', () => {
    expect(TMS_COLUMN_BY_KEY.get('cabecera')?.field).toBe('cabecera_destino_importada');
    expect(TMS_COLUMN_BY_KEY.get('cabecera origen')?.field).toBe('cabecera_origen');
  });

  it('Código Postal y Código Postal Origen se mapean a campos distintos', () => {
    expect(TMS_COLUMN_BY_KEY.get('codigo postal')?.field).toBe('codigo_postal');
    expect(TMS_COLUMN_BY_KEY.get('codigo postal origen')?.field).toBe('codigo_postal_origen');
  });

  it('mapea las columnas de la tabla de §2.4 a su campo', () => {
    const fieldByHeader = Object.fromEntries(
      TMS_ALL_COLUMNS.filter((column) => column.field !== null).map((column) => [
        column.header,
        column.field,
      ]),
    );
    expect(fieldByHeader).toEqual({
      'Nro Pedido': 'nro_pedido',
      'Peso Kgs': 'peso_kgs',
      'Volumen M3': 'volumen_m3',
      'Peso Aforado': 'peso_aforado',
      'Cantidad de Bultos': 'cantidad_bultos',
      'Valor Declarado': 'valor_declarado',
      'Fecha de Interfaz': 'fecha_interfaz',
      'Zona Origen': 'zona_origen',
      'Cabecera Origen': 'cabecera_origen',
      'Código Postal Origen': 'codigo_postal_origen',
      'Código Postal': 'codigo_postal',
      Localidad: 'localidad',
      Provincia: 'provincia',
      'Zona Destino': 'zona_destino_importada',
      Cabecera: 'cabecera_destino_importada',
      'Codigo de Expreso': 'expreso_manual',
      Destinatario: 'destinatario',
      Dirección: 'direccion',
      Número: 'numero',
      alto_cm: 'alto_cm',
      ancho_cm: 'ancho_cm',
      largo_cm: 'largo_cm',
    });
  });

  it('las columnas que no participan van a origen_tms con su nombre snake_case', () => {
    const origenKeys = TMS_ALL_COLUMNS.filter((column) => column.field === null).map(
      (column) => column.origenKey,
    );
    expect(origenKeys).toHaveLength(28);
    expect(TMS_COLUMN_BY_KEY.get('codigo de empresa')?.origenKey).toBe('codigo_de_empresa');
    expect(TMS_COLUMN_BY_KEY.get('nro de liquidacion')?.origenKey).toBe('nro_de_liquidacion');
    expect(TMS_COLUMN_BY_KEY.get('idliquidacion')?.origenKey).toBe('idliquidacion');
    expect(TMS_COLUMN_BY_KEY.get('sub categoria')?.origenKey).toBe('sub_categoria');
  });

  it('las obligatorias son las de §2.4 con "Oblig. = sí"', () => {
    expect(
      TMS_ALL_COLUMNS.filter((column) => column.required)
        .map((column) => column.field)
        .sort(),
    ).toEqual(
      [
        'nro_pedido',
        'peso_kgs',
        'volumen_m3',
        'peso_aforado',
        'cantidad_bultos',
        'fecha_interfaz',
        'zona_origen',
        'cabecera_origen',
        'codigo_postal_origen',
        'codigo_postal',
        'localidad',
        'provincia',
      ].sort(),
    );
  });
});

describe('resolveTmsHeaders', () => {
  const withColon = EXPECTED_47.map((header) => `${header}:`);

  it('reconoce los 47 encabezados con : final sin errores ni desconocidos', () => {
    const resolution = resolveTmsHeaders(withColon);
    expect(resolution.errores_archivo).toEqual([]);
    expect(resolution.desconocidas).toEqual([]);
    expect(resolution.columnas.size).toBe(47);
  });

  it('acepta las tres columnas opcionales y encabezados sin : o sin tildes', () => {
    const resolution = resolveTmsHeaders([
      ...EXPECTED_47.map((header) => header.toUpperCase()),
      'alto_cm',
      'ancho_cm:',
      'largo_cm',
    ]);
    expect(resolution.errores_archivo).toEqual([]);
    expect(resolution.columnas.size).toBe(50);
  });

  it('una columna obligatoria ausente es un error de archivo, no de fila', () => {
    const resolution = resolveTmsHeaders(withColon.filter((header) => header !== 'Peso Kgs:'));
    expect(resolution.errores_archivo).toEqual([
      {
        campo: 'peso_kgs',
        codigo: 'CAMPO_OBLIGATORIO',
        mensaje: 'Falta una columna obligatoria',
      },
    ]);
  });

  it('Cabecera presente no reemplaza a Cabecera Origen ausente', () => {
    const resolution = resolveTmsHeaders(
      withColon.filter((header) => header !== 'Cabecera Origen:'),
    );
    expect(resolution.errores_archivo.map((error) => error.campo)).toEqual(['cabecera_origen']);
  });

  it('Código Postal presente no reemplaza a Código Postal Origen ausente', () => {
    const resolution = resolveTmsHeaders(
      withColon.filter((header) => header !== 'Código Postal Origen:'),
    );
    expect(resolution.errores_archivo.map((error) => error.campo)).toEqual([
      'codigo_postal_origen',
    ]);
  });

  it('las columnas opcionales ausentes no son error', () => {
    const resolution = resolveTmsHeaders(
      withColon.filter((header) => header !== 'Valor Declarado:'),
    );
    expect(resolution.errores_archivo).toEqual([]);
  });

  it('lista los encabezados desconocidos y marca los repetidos', () => {
    const resolution = resolveTmsHeaders([...withColon, 'Columna Rara:', 'nro pedido']);
    expect(resolution.desconocidas).toEqual(['Columna Rara:']);
    expect(resolution.errores_archivo).toEqual([
      {
        campo: 'nro_pedido',
        codigo: 'FORMATO_INVALIDO',
        mensaje: 'Encabezado repetido',
      },
    ]);
  });
});
