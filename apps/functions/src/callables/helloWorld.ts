import { onCall } from 'firebase-functions/v2/https';
import { ORDER_STATUSES } from '@sistema-redespachos/shared';

// Callable de ejemplo y smoke test del deploy (MVP-31): prueba que la función es de 2ª gen, que
// toma la región global y que @sistema-redespachos/shared llega empaquetado al runtime.
export const helloWorld = onCall(() => ({
  message: 'Hello from Firebase Cloud Functions',
  estados_pedido: [...ORDER_STATUSES],
}));
