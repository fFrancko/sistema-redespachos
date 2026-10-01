// Generic Firebase types for Firestore collections and documents

export type DocRef<T> = {
  id: string;
  data: T;
};

export type CollectionRef<T> = {
  name: string;
  type: T;
};

// Firestore document with metadata
export type FirestoreDoc<T> = T & {
  id: string;
  creado_en?: Date;
  actualizado_en?: Date;
};

// Collection references (stubs for future use)
export type Collections = {
  pedidos: FirestoreDoc<PedidoData>;
  tarifas: FirestoreDoc<TarifaData>;
  coberturas: FirestoreDoc<CoberturaData>;
  usuarios: FirestoreDoc<UsuarioData>;
  proveedores: FirestoreDoc<ProveedorData>;
  proformas: FirestoreDoc<ProformaData>;
  liquidaciones: FirestoreDoc<LiquidacionData>;
};

// Stub data types (will be expanded in MVP-04 with Zod schemas)
export type PedidoData = {
  id?: string;
  nro_pedido: string;
  estado?: string;
};

export type TarifaData = {
  id?: string;
  id_proveedor: string;
  vigencia_desde?: string;
};

export type CoberturaData = {
  id?: string;
  cobertura: string;
};

export type UsuarioData = {
  uid: string;
  email?: string;
  rol?: string;
};

export type ProveedorData = {
  id_proveedor: string;
  razon_social: string;
};

export type ProformaData = {
  id?: string;
  proforma_id: string;
  estado?: string;
};

export type LiquidacionData = {
  id?: string;
  fecha?: string;
  monto?: string;
};
