import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  signOut, 
  onAuthStateChanged,
  type User 
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import type { UserSession } from '../components/AuthGate';

export const SESSION_STORAGE_KEY = 'optirutas_session';
export const MASTER_ADMIN_PIN = '1234'; // Backup fallback PIN for emergency offline access

export interface AdminUserData {
  uid: string;
  email: string;
  role: 'admin';
  createdAt: number;
  lastLoginAt: number;
}

/**
 * Format Firebase Auth errors into clear, actionable Spanish messages
 */
export const formatAuthError = (errorCode: string): string => {
  switch (errorCode) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Correo o contraseña incorrectos. Verifica tus datos.';
    case 'auth/invalid-email':
      return 'El formato del correo electrónico no es válido.';
    case 'auth/user-disabled':
      return 'Esta cuenta de administrador ha sido deshabilitada.';
    case 'auth/email-already-in-use':
      return 'Este correo ya está registrado. Por favor inicia sesión.';
    case 'auth/weak-password':
      return 'La contraseña es muy débil. Debe tener al menos 6 caracteres.';
    case 'auth/operation-not-allowed':
      return 'La autenticación por correo/contraseña aún no está habilitada en la consola de Firebase.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos fallidos. Por seguridad, espera unos minutos o restablece tu contraseña.';
    case 'auth/network-request-failed':
      return 'Error de conexión. Verifica tu conexión a internet.';
    default:
      return 'Ocurrió un error al autenticar con Firebase. Intenta nuevamente.';
  }
};

/**
 * Sign in Admin with Email & Password
 */
export const signInAdmin = async (email: string, pass: string): Promise<UserSession> => {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), pass);
  const user = credential.user;

  // Record login timestamp in Firestore admins collection (best-effort)
  try {
    const adminRef = doc(db, 'admins', user.uid);
    await setDoc(
      adminRef, 
      { 
        email: user.email, 
        role: 'admin', 
        lastLoginAt: Date.now() 
      }, 
      { merge: true }
    );
  } catch (e) {
    console.warn('Could not update admin login metadata:', e);
  }

  const session: UserSession = {
    role: 'admin',
    adminEmail: user.email || email.trim(),
    adminUid: user.uid,
    loginTime: Date.now()
  };

  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  return session;
};

/**
 * Register a new Admin account in Firebase Auth & Firestore
 */
export const signUpAdmin = async (email: string, pass: string): Promise<UserSession> => {
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  const user = credential.user;

  // Register in Firestore admins collection
  try {
    const adminRef = doc(db, 'admins', user.uid);
    await setDoc(adminRef, {
      uid: user.uid,
      email: user.email,
      role: 'admin',
      createdAt: Date.now(),
      lastLoginAt: Date.now()
    });
  } catch (e) {
    console.warn('Could not create admin document:', e);
  }

  const session: UserSession = {
    role: 'admin',
    adminEmail: user.email || email.trim(),
    adminUid: user.uid,
    loginTime: Date.now()
  };

  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  return session;
};

/**
 * Send password recovery email
 */
export const resetAdminPassword = async (email: string): Promise<void> => {
  await sendPasswordResetEmail(auth, email.trim());
};

/**
 * Sign out user from Firebase Auth & clear local session
 */
export const signOutAdmin = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn('Sign out error:', e);
  }
  localStorage.removeItem(SESSION_STORAGE_KEY);
};

/**
 * Subscribe to Firebase Auth state changes
 */
export const subscribeToAuth = (onSession: (session: UserSession | null) => void) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      const session: UserSession = {
        role: 'admin',
        adminEmail: user.email || undefined,
        adminUid: user.uid,
        loginTime: Date.now()
      };
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      onSession(session);
    }
  });
};
