import { describe, it, expect } from 'vitest';
import * as motor from './index';

describe('Motor root exports', () => {
  it('should export cotizarPlaceholder from cotizacion', () => {
    expect(motor.cotizarPlaceholder).toBeDefined();
  });

  it('should export procesarTarifasPlaceholder from tarifas', () => {
    expect(motor.procesarTarifasPlaceholder).toBeDefined();
  });

  it('should export schemaPlaceholder from schemas', () => {
    expect(motor.schemaPlaceholder).toBeDefined();
  });
});
