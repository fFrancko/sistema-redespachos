import { describe, it, expect } from 'vitest';
import * as motor from './index.js';
import { casoReferencia1 } from '../test/fixtures/motor.js';

describe('API pública de @sistema-redespachos/motor', () => {
  it('exporta cotizar, MOTOR_VERSION y las funciones de MVP-13', () => {
    expect(motor.MOTOR_VERSION).toBe('1.0.0');
    expect(typeof motor.cotizar).toBe('function');
    expect(typeof motor.seleccionarCandidatas).toBe('function');
    expect(typeof motor.resolverDestinoYOrigen).toBe('function');
  });

  it('cotizar desde el índice da el total del caso de referencia 1', () => {
    const { pedido, contexto } = casoReferencia1();
    expect(motor.cotizar(pedido, contexto).cotizacion?.total).toBe(413920);
  });
});
