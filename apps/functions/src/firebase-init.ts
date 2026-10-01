import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
// In emulator mode, the SDK connects to local emulators
// In production, it uses credentials from GOOGLE_APPLICATION_CREDENTIALS env var
admin.initializeApp({
  projectId: process.env.GCLOUD_PROJECT || 'proyecto-qx-dev',
});

const db = admin.firestore();
const auth = admin.auth();

// Development: connect to emulator if FUNCTIONS_EMULATOR is set
if (process.env.FUNCTIONS_EMULATOR === 'true') {
  const firestoreEmulatorHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  process.env.FIRESTORE_EMULATOR_HOST = firestoreEmulatorHost;
}

export { admin, db, auth };
