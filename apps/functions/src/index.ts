// Índice raíz de Functions: una línea por dominio de la arquitectura v3 §3.8. No se edita más;
// cada carril edita el index.ts de sus dominios. globalOptions.js tiene que ir primero.
import './globalOptions.js';

export * as auth from './auth/index.js';
export * as admin from './admin/index.js';
export * as postalRouter from './postalRouter/index.js';
export * as suppliers from './suppliers/index.js';
export * as tariffs from './tariffs/index.js';
export * as emailTemplates from './emailTemplates/index.js';
export * as orders from './orders/index.js';
export * as proformas from './proformas/index.js';
export * as emails from './emails/index.js';
export * as settlement from './settlement/index.js';
export * as purchaseOrders from './purchaseOrders/index.js';
export * as reports from './reports/index.js';
export { helloWorld } from './callables/helloWorld.js';
