import type {
  Order,
  TariffRule,
  PostalRouterEntry,
  Supplier,
  Tariff,
  OrderStatus,
  Quote,
  QuoteAlternative,
  QuoteDiscard,
} from '@sistema-redespachos/shared';

export type MotorOrderInput = Pick<
  Order,
  'cp_destino_norm' | 'localidad_destino_norm' | 'provincia_destino_norm' | 'codigo_postal_origen'
>;

// Entrada de `cotizar`: lo que usan los pasos 1 y 2 más las magnitudes y el valor declarado.
export type MotorQuoteInput = MotorOrderInput &
  Pick<Order, 'peso_kgs' | 'volumen_m3' | 'valor_declarado'>;

export interface MotorContext {
  canalizador: PostalRouterEntry[];
  proveedores: Supplier[];
  tarifarios: Array<{ id: string } & Tariff>;
  reglas: Array<{ id: string } & TariffRule>;
  fecha_referencia: string;
  origen_estricto: boolean;
}

export type Candidate = Pick<TariffRule, 'id_proveedor' | 'variante_id' | 'tarifario_id'> & {
  variante: QuoteAlternative['variante'];
  reglas_peso: Array<{ id: string } & TariffRule>;
  reglas_volumen: Array<{ id: string } & TariffRule>;
};

export type CandidateSelection = Partial<Pick<Order, 'provincia_origen' | 'localidad_origen'>> & {
  canalizador: NonNullable<Order['canalizador']>;
  observaciones: Order['observaciones'];
  candidatas: Candidate[];
};

// La cotización del motor: `quoteSchema` sin `origen` ni `calculado_en`, que agrega MVP-18.
export type MotorQuote = Omit<Quote, 'origen' | 'calculado_en' | 'justificacion'>;

// Estado que el motor sugiere (§3.3 paso 7); la transición la aplica MVP-18.
export type SuggestedStatus = Extract<OrderStatus, 'VALORIZADO' | 'COBERTURA_QX' | 'SIN_COBERTURA'>;

export type QuoteResult = Omit<CandidateSelection, 'candidatas'> & {
  estado_sugerido: SuggestedStatus;
  cotizacion: MotorQuote | null;
  alternativas: QuoteAlternative[];
  descartes: QuoteDiscard[];
};
