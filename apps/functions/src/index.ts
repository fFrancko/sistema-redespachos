import * as functions from 'firebase-functions';

export const helloWorld = functions.https.onCall(() => {
  return { message: 'Hello from Firebase Cloud Functions' };
});
