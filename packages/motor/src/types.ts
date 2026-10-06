import type {
  Order,
  TariffRule,
  PostalRouterEntry,
  Supplier,
  Tariff,
  QuoteAlternative,
} from '@sistema-redespachos/shared';

export type MotorOrderInput = Pick<
  Order,
  'cp_destino_norm' | 'localidad_destino_norm' | 'provincia_destino_norm' | 'codigo_postal_origen'
>;

export interface MotorContext {
  canalizador: PostalRouterEntry[];
  proveedores: Supplier[];
  tarifarios: Array<{ id: string } & Tariff>;
  reglas: TariffRule[];
  fecha_referencia: string;
  origen_estricto: boolean;
}

export type Candidate = Pick<TariffRule, 'id_proveedor' | 'variante_id' | 'tarifario_id'> & {
  variante: QuoteAlternative['variante'];
  reglas_peso: TariffRule[];
  reglas_volumen: TariffRule[];
};

export type CandidateSelection = Partial<Pick<Order, 'provincia_origen' | 'localidad_origen'>> & {
  canalizador: NonNullable<Order['canalizador']>;
  observaciones: Order['observaciones'];
  candidatas: Candidate[];
};
