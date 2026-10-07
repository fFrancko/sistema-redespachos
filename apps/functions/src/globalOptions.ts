import { setGlobalOptions } from 'firebase-functions/v2';

// Opciones comunes a todas las Functions de 2ª gen (arquitectura v3 §1).
// Va en un módulo propio que index.ts importa primero: en ESM los imports se evalúan antes que el
// cuerpo del módulo, y onCall copia las opciones globales al definirse. Un setGlobalOptions en el
// cuerpo de index.ts llegaría tarde y las funciones quedarían sin región.
setGlobalOptions({ region: 'southamerica-east1' });
