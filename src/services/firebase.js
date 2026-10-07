import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged 
} from 'firebase/auth';
import { showToast } from '../modules/toast.js';

// Configuración leída desde variables de entorno Vite (.env)
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};

let app = null;
let auth = null;
let googleProvider = null;
let currentUser = null;
let googleAccessToken = null;

export function initFirebase() {
    if (!firebaseConfig.apiKey) {
        console.warn('[Firebase] No se detectaron credenciales en .env. La app continuará en modo local.');
        return false;
    }

    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        googleProvider = new GoogleAuthProvider();
        
        // Permisos para leer hojas de cálculo de Drive
        googleProvider.addScope('https://www.googleapis.com/auth/drive.readonly');
        googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets.readonly');

        onAuthStateChanged(auth, (user) => {
            currentUser = user;
            updateAuthUI(user);
        });

        return true;
    } catch (e) {
        console.error('Error inicializando Firebase:', e);
        return false;
    }
}

export async function loginWithGoogle() {
    if (!auth || !googleProvider) {
        showToast('Configura las credenciales de Firebase en .env para iniciar sesión', 'warning');
        return null;
    }

    try {
        const result = await signInWithPopup(auth, googleProvider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        googleAccessToken = credential?.accessToken;
        
        if (googleAccessToken) {
            sessionStorage.setItem('google_access_token', googleAccessToken);
        }

        showToast(`Bienvenido, ${result.user.displayName}`, 'success');
        return result.user;
    } catch (error) {
        console.error('Error en login Google:', error);
        showToast('Error al iniciar sesión con Google', 'error');
        return null;
    }
}

export async function logoutGoogle() {
    if (!auth) return;
    try {
        await signOut(auth);
        sessionStorage.removeItem('google_access_token');
        googleAccessToken = null;
        showToast('Sesión cerrada', 'info');
    } catch (e) {
        console.error(e);
    }
}

export function getGoogleAccessToken() {
    return googleAccessToken || sessionStorage.getItem('google_access_token');
}

export function getCurrentUser() {
    return currentUser;
}

function updateAuthUI(user) {
    const userContainer = document.getElementById('user-auth-status');
    if (!userContainer) return;

    if (user) {
        userContainer.innerHTML = `
            <div class="flex items-center space-x-2">
                <img src="${user.photoURL || ''}" class="w-7 h-7 rounded-full border border-indigo-400" alt="avatar">
                <span class="text-xs font-medium text-slate-200 hidden sm:inline">${user.displayName}</span>
                <button id="btn-logout" class="text-slate-400 hover:text-rose-400 text-xs ml-1" title="Cerrar sesión">
                    <i class="fa-solid fa-arrow-right-from-bracket"></i>
                </button>
            </div>
        `;
        document.getElementById('btn-logout')?.addEventListener('click', logoutGoogle);
    } else {
        userContainer.innerHTML = `
            <button id="btn-login" class="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs px-2.5 py-1.5 rounded-lg transition shadow-sm">
                <i class="fa-brands fa-google text-amber-400"></i>
                <span class="hidden sm:inline">Google Drive</span>
            </button>
        `;
        document.getElementById('btn-login')?.addEventListener('click', loginWithGoogle);
    }
}
