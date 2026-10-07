import { describe, expect, it } from 'vitest';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { ORDER_STATUSES } from '@sistema-redespachos/shared';
import * as functionsIndex from './index.js';

// Dominios de la arquitectura v3 §3.8, en el orden del índice raíz.
const DOMAINS = [
  'auth',
  'admin',
  'postalRouter',
  'suppliers',
  'tariffs',
  'emailTemplates',
  'orders',
  'proformas',
  'emails',
  'settlement',
  'purchaseOrders',
  'reports',
];

describe('índice raíz de Functions', () => {
  it('exporta exactamente un namespace por dominio de §3.8 más helloWorld', () => {
    expect(Object.keys(functionsIndex).sort()).toEqual([...DOMAINS, 'helloWorld'].sort());
    for (const domain of DOMAINS) {
      expect(typeof functionsIndex[domain as keyof typeof functionsIndex]).toBe('object');
    }
  });
});

describe('helloWorld', () => {
  // __endpoint es API interna de firebase-functions: es lo que lee el CLI para armar el manifiesto
  // del deploy. No es parte del contrato público, así que si cambia en una versión nueva del SDK
  // este test falla y hay que revisarlo (no relajarlo).
  it('es una callable de 2ª gen en southamerica-east1', () => {
    const endpoint = functionsIndex.helloWorld.__endpoint;
    expect(endpoint.platform).toBe('gcfv2');
    expect(endpoint.region).toEqual(['southamerica-east1']);
    expect(endpoint.callableTrigger).toEqual({});
  });

  it('responde con los estados de pedido de @sistema-redespachos/shared', async () => {
    const response = await functionsIndex.helloWorld.run({ data: {} } as CallableRequest);
    expect(response).toEqual({
      message: 'Hello from Firebase Cloud Functions',
      estados_pedido: [...ORDER_STATUSES],
    });
  });
});
