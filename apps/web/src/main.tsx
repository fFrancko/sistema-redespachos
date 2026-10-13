import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { accessListFromEnv, hostedDomain } from './auth/accessList';
import { createFirebaseGateway } from './auth/firebaseGateway';
import { auth } from './firebase';
import './index.css';

const accessList = accessListFromEnv({
  VITE_ALLOWED_EMAILS: import.meta.env.VITE_ALLOWED_EMAILS,
  VITE_ALLOWED_DOMAINS: import.meta.env.VITE_ALLOWED_DOMAINS,
});
const gateway = createFirebaseGateway(auth, hostedDomain(accessList));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App gateway={gateway} accessList={accessList} />
  </React.StrictMode>,
);
