import { DomainError } from './errors.js';
import type { OrderStatus } from './enums.js';
import type { Role } from './roles.js';

export interface OrderTransition {
  to: OrderStatus;
  // Si está presente, solo estos roles pueden hacer la transición.
  roles?: readonly Role[];
}

// §3.7: única tabla de transiciones de pedido (columna "Puede pasar a").
// Cualquier cambio de estado fuera de esta tabla se rechaza con TRANSICION_INVALIDA.
export const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderTransition[]>> = {
  CON_ERROR: [{ to: 'CANCELADO' }],
  VALIDADO: [
    { to: 'VALORIZADO' },
    { to: 'COBERTURA_QX' },
    { to: 'SIN_COBERTURA' },
    { to: 'CANCELADO' },
  ],
  SIN_COBERTURA: [{ to: 'VALORIZADO' }, { to: 'COBERTURA_QX' }, { to: 'CANCELADO' }],
  COBERTURA_QX: [{ to: 'VALORIZADO' }, { to: 'SIN_COBERTURA' }, { to: 'CANCELADO' }],
  VALORIZADO: [
    { to: 'PENDIENTE_CONFIRMACION' },
    { to: 'ERROR_COMUNICACION' },
    { to: 'SIN_COBERTURA' },
    { to: 'COBERTURA_QX' },
    { to: 'CANCELADO' },
  ],
  ERROR_COMUNICACION: [{ to: 'PENDIENTE_CONFIRMACION' }, { to: 'VALORIZADO' }, { to: 'CANCELADO' }],
  PENDIENTE_CONFIRMACION: [{ to: 'ACEPTADO_PROVEEDOR' }, { to: 'EN_DISPUTA' }],
  EN_DISPUTA: [
    { to: 'VALORIZADO' },
    { to: 'SIN_COBERTURA' },
    { to: 'COBERTURA_QX' },
    { to: 'CANCELADO' },
  ],
  ACEPTADO_PROVEEDOR: [{ to: 'LISTO_PARA_OC' }, { to: 'EN_DISPUTA', roles: ['ADMIN'] }],
  LISTO_PARA_OC: [{ to: 'LIQUIDADO' }],
  LIQUIDADO: [],
  CANCELADO: [],
};

export function canTransition(desde: OrderStatus, hacia: OrderStatus, rol?: Role): boolean {
  const transition = ORDER_TRANSITIONS[desde].find((candidate) => candidate.to === hacia);
  if (transition === undefined) return false;
  if (transition.roles === undefined) return true;
  return rol !== undefined && transition.roles.includes(rol);
}

export function assertTransition(desde: OrderStatus, hacia: OrderStatus, rol?: Role): void {
  if (!canTransition(desde, hacia, rol)) {
    throw new DomainError(
      'TRANSICION_INVALIDA',
      `Transición de pedido no permitida: ${desde} → ${hacia}`,
      { desde, hacia, rol: rol ?? null },
    );
  }
}
