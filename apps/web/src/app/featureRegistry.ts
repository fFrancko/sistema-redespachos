import type { RouteObject } from 'react-router-dom';
import { ROLES, type Role } from '@sistema-redespachos/shared';
import { routes as cotizacion } from '../features/cotizacion';
import { routes as pedidos } from '../features/pedidos';
import { routes as tarifas } from '../features/tarifas';
import { routes as canalizador } from '../features/canalizador';
import { routes as usuarios } from '../features/usuarios';
import { routes as proveedores } from '../features/proveedores';
import { routes as sucursales } from '../features/sucursales';
import { routes as proformas } from '../features/proformas';
import { routes as liquidacion } from '../features/liquidacion';
import { routes as oc } from '../features/oc';
import { routes as auditoria } from '../features/auditoria';
import { routes as parametros } from '../features/parametros';

// Registro fijo de features (decisión P-07): una entrada por carpeta de AGENTS.md §3.
// src/app queda congelado; cada carril edita solo los index.tsx de sus features.
// `roles` decide la navegación según la matriz de §3.1. La seguridad real está en las reglas y
// las callables.

export interface FeatureEntry {
  id: string;
  label: string;
  roles: readonly Role[];
  routes: RouteObject[];
}

const ADMIN_ONLY: readonly Role[] = ['ADMIN'];
const OPERACION: readonly Role[] = ['ADMIN', 'ANALISTA', 'BACKOFFICE'];
const PROVEEDORES: readonly Role[] = ['ADMIN', 'ATENCION_PROVEEDOR'];

export const FEATURES: readonly FeatureEntry[] = [
  // Carril A
  { id: 'cotizacion', label: 'Cotización', roles: OPERACION, routes: cotizacion },
  { id: 'pedidos', label: 'Pedidos', roles: ROLES, routes: pedidos },
  { id: 'tarifas', label: 'Tarifas', roles: PROVEEDORES, routes: tarifas },
  { id: 'canalizador', label: 'Canalizador', roles: ADMIN_ONLY, routes: canalizador },
  // Carril B
  { id: 'usuarios', label: 'Usuarios', roles: ADMIN_ONLY, routes: usuarios },
  { id: 'proveedores', label: 'Proveedores', roles: PROVEEDORES, routes: proveedores },
  { id: 'sucursales', label: 'Sucursales', roles: ADMIN_ONLY, routes: sucursales },
  { id: 'proformas', label: 'Proformas', roles: ROLES, routes: proformas },
  { id: 'liquidacion', label: 'Liquidación', roles: ROLES, routes: liquidacion },
  { id: 'oc', label: 'Órdenes de compra', roles: ROLES, routes: oc },
  { id: 'auditoria', label: 'Auditoría', roles: ADMIN_ONLY, routes: auditoria },
  { id: 'parametros', label: 'Parámetros', roles: ADMIN_ONLY, routes: parametros },
];

export function featuresForRole(rol: Role): FeatureEntry[] {
  return FEATURES.filter((feature) => feature.roles.includes(rol));
}
