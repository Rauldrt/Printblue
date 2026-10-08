import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc 
} from 'firebase/firestore';
import { labelConfig, loadSavedSettings } from '../modules/paperSettings.js';
import { batchItems, setBatchItems } from '../modules/batchPrinting.js';
import { updatePreview } from '../modules/singleLabel.js';
import { showToast } from '../modules/toast.js';

let db = null;
let currentUser = null;
let isApplyingCloudData = false;
let syncTimeout = null;

export function initCloudSync(firestoreInstance) {
    db = firestoreInstance;
}

export function setCloudSyncUser(user) {
    currentUser = user;
    if (user) {
        loadUserDataFromCloud(user);
    } else {
        updateSyncIndicator('offline');
    }
}

export function triggerCloudSave() {
    if (!currentUser || isApplyingCloudData) return;
    updateSyncIndicator('syncing');

    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
        saveUserDataToCloud();
    }, 1000);
}

export async function loadUserDataFromCloud(user) {
    if (!db || !user) return;
    updateSyncIndicator('syncing');

    try {
        const userDocRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            isApplyingCloudData = true;

            // 1. Restaurar configuración de formato de etiqueta
            if (data.settings) {
                Object.assign(labelConfig, data.settings);
                localStorage.setItem('printlabel_config', JSON.stringify(labelConfig));
                loadSavedSettings(updatePreview);
            }

            // 2. Restaurar protocolo Bluetooth preferido
            if (data.btProtocol) {
                localStorage.setItem('bt_protocol', data.btProtocol);
                const protoSel = document.getElementById('setting-bt-protocol');
                if (protoSel) protoSel.value = data.btProtocol;
            }

            // 3. Restaurar productos del lote
            if (Array.isArray(data.batchItems) && data.batchItems.length > 0) {
                setBatchItems(data.batchItems);
            }

            // 4. Restaurar borrador de etiqueta individual
            if (data.singleDraft) {
                restoreSingleDraft(data.singleDraft);
            }

            // 5. Restaurar mapeo de Google Sheets
            if (data.sheetsMapping) {
                localStorage.setItem('sheets_column_mapping', JSON.stringify(data.sheetsMapping));
            }

            updatePreview();
            isApplyingCloudData = false;
            updateSyncIndicator('synced');
            showToast(`¡Configuraciones y productos sincronizados con tu cuenta Google!`, 'success');
        } else {
            // Guardar configuración local actual como estado inicial en Firestore
            await saveUserDataToCloud(true);
            updateSyncIndicator('synced');
            showToast('Configuraciones iniciales respaldadas en tu cuenta Google', 'info');
        }
    } catch (e) {
        console.error('Error cargando datos de la nube:', e);
        updateSyncIndicator('error');
    }
}

export async function saveUserDataToCloud(immediate = false) {
    if (!db || !currentUser || isApplyingCloudData) return;

    try {
        updateSyncIndicator('syncing');
        const userDocRef = doc(db, 'users', currentUser.uid);

        const payload = {
            settings: { ...labelConfig },
            btProtocol: localStorage.getItem('bt_protocol') || 'escpos',
            batchItems: batchItems,
            singleDraft: getSingleDraft(),
            updatedAt: new Date().toISOString()
        };

        const savedMapping = localStorage.getItem('sheets_column_mapping');
        if (savedMapping) {
            try { payload.sheetsMapping = JSON.parse(savedMapping); } catch(e){}
        }

        await setDoc(userDocRef, payload, { merge: true });
        updateSyncIndicator('synced');
    } catch (e) {
        console.error('Error guardando en la nube:', e);
        updateSyncIndicator('error');
    }
}

function getSingleDraft() {
    return {
        title: document.getElementById('inp-title')?.value || '',
        code: document.getElementById('inp-code')?.value || '',
        symbology: document.getElementById('inp-symbology')?.value || 'CODE128',
        price: document.getElementById('inp-price')?.value || '',
        currency: document.getElementById('inp-currency')?.value || '$',
        extra: document.getElementById('inp-extra')?.value || '',
        showTitle: document.getElementById('chk-show-title')?.checked ?? true,
        showPrice: document.getElementById('chk-show-price')?.checked ?? true,
        showExtra: document.getElementById('chk-show-extra')?.checked ?? true,
        boldPrice: document.getElementById('chk-bold-price')?.checked ?? true
    };
}

function restoreSingleDraft(draft) {
    if (!draft) return;
    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
    const setChk = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.checked = val; };

    setVal('inp-title', draft.title);
    setVal('inp-code', draft.code);
    setVal('inp-symbology', draft.symbology);
    setVal('inp-price', draft.price);
    setVal('inp-currency', draft.currency);
    setVal('inp-extra', draft.extra);

    setChk('chk-show-title', draft.showTitle);
    setChk('chk-show-price', draft.showPrice);
    setChk('chk-show-extra', draft.showExtra);
    setChk('chk-bold-price', draft.boldPrice);
}

export function updateSyncIndicator(status) {
    const indicator = document.getElementById('cloud-sync-indicator');
    if (!indicator) return;

    if (status === 'syncing') {
        indicator.innerHTML = '<i class="fa-solid fa-cloud-arrow-up text-amber-400 animate-pulse text-xs" title="Guardando en Google Cloud..."></i>';
    } else if (status === 'synced') {
        indicator.innerHTML = '<i class="fa-solid fa-cloud-check text-emerald-400 text-xs" title="Sincronizado con tu cuenta Google"></i>';
    } else if (status === 'error') {
        indicator.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-rose-400 text-xs" title="Error de sincronización con la nube"></i>';
    } else {
        indicator.innerHTML = '<i class="fa-solid fa-cloud text-slate-500 text-xs" title="Sin cuenta vinculada"></i>';
    }
}
