// Inicialização do Firebase. Em `npm run dev` conecta ao Emulator, a não ser que
// VITE_USAR_EMULADOR=false esteja no .env.local.
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

export const usandoEmulador =
  import.meta.env.DEV && import.meta.env.VITE_USAR_EMULADOR !== 'false';

// Projetos com prefixo "demo-" rodam no Emulator sem projeto real no console.
const PROJETO_DEMO = 'demo-painel-nf-mo';

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'chave-emulador',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: usandoEmulador ? PROJETO_DEMO : import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

export const auth = getAuth(app);
export const db = getFirestore(app);

if (usandoEmulador) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
