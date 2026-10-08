import './style.css';
import { showToast } from './modules/toast.js';
import { 
    labelConfig, 
    loadSavedSettings, 
    saveSettings, 
    applyPreset,
    syncSpacingInputs,
    syncMarginInputs,
    syncGapInput,
    syncFeedOffsetInput,
    setFeedMode,
    setVerticalAlign
} from './modules/paperSettings.js';
import { 
    updatePreview, 
    adjustQty, 
    triggerPrintSystem, 
    downloadLabelImage,
    printSingleDirectBT 
} from './modules/singleLabel.js';
import { 
    batchItems, 
    renderBatchTable, 
    addBatchRow, 
    clearBatch, 
    printBatch,
    printBatchBT,
    toggleSelectAll,
    deleteSelectedItems,
    setQtyForSelectedItems
} from './modules/batchPrinting.js';
import { 
    connectBluetoothPrinter, 
    isBluetoothConnected, 
    updateBluetoothUI,
    sendRawToPrinter, 
    buildTSPLCommands,
    feedOneLabelBluetooth
} from './services/bluetooth.js';
import { 
    initFirebase, 
    loginWithGoogle, 
    logoutGoogle, 
    getCurrentUser 
} from './services/firebase.js';
import { 
    listGoogleDriveSheets, 
    loadSpreadsheetMetadata, 
    updateMappingPreview, 
    applyMappingAndImport, 
    switchSpreadsheetTab, 
    closeMappingModal 
} from './services/googleDrive.js';
import { triggerCloudSave } from './services/cloudSync.js';

window.triggerCloudSave = triggerCloudSave;

window.showToast = showToast;
window.switchTab = switchTab;
window.adjustQty = adjustQty;
window.updatePreview = updatePreview;
window.applyPreset = (w, h) => applyPreset(w, h, updatePreview);
window.saveSettings = () => saveSettings(updatePreview);
window.syncMarginInputs = (type, val) => syncMarginInputs(type, val, updatePreview);
window.syncSpacingInputs = (type, val) => syncSpacingInputs(type, val, updatePreview);
window.syncGapInput = (val) => syncGapInput(val, updatePreview);
window.syncFeedOffsetInput = (val) => syncFeedOffsetInput(val, updatePreview);
window.setFeedMode = (mode) => setFeedMode(mode, updatePreview);
window.setVerticalAlign = (align) => setVerticalAlign(align, updatePreview);
window.feedOneLabelBluetooth = feedOneLabelBluetooth;
window.triggerPrintSystem = triggerPrintSystem;
window.downloadLabelImage = downloadLabelImage;
window.printSingleDirectBT = printSingleDirectBT;
window.addBatchRow = addBatchRow;
window.clearBatch = clearBatch;
window.printBatch = printBatch;
window.printBatchBT = printBatchBT;
window.toggleSelectAll = toggleSelectAll;
window.deleteSelectedItems = deleteSelectedItems;
window.setQtyForSelectedItems = setQtyForSelectedItems;
window.connectBluetoothPrinter = connectBluetoothPrinter;
window.openHelpModal = () => document.getElementById('help-modal')?.classList.remove('hidden');
window.closeHelpModal = () => document.getElementById('help-modal')?.classList.add('hidden');
window.openDriveModal = openDriveModal;
window.closeDriveModal = () => document.getElementById('drive-modal')?.classList.add('hidden');
window.updateMappingPreview = updateMappingPreview;
window.applyMappingAndImport = applyMappingAndImport;
window.switchSpreadsheetTab = switchSpreadsheetTab;
window.closeMappingModal = closeMappingModal;
window.installPWA = installPWA;

// PWA Install Prompt
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const btn = document.getElementById('pwa-install-btn');
    if (btn) {
        btn.classList.remove('hidden');
        btn.classList.add('flex');
    }
});

window.addEventListener('appinstalled', () => {
    document.getElementById('pwa-install-btn')?.classList.add('hidden');
    showToast('¡PrintLabel Pro instalada correctamente!', 'success');
    deferredInstallPrompt = null;
});

async function installPWA() {
    if (!deferredInstallPrompt) {
        showToast('Para instalar, pulsa "Instalar" en el menú de tu navegador.', 'info');
        return;
    }
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'accepted') {
        showToast('Instalando app...', 'success');
    }
    deferredInstallPrompt = null;
}

// Navegación de pestañas
export function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => {
        el.classList.remove('active', 'border-indigo-600', 'text-indigo-600');
        el.classList.add('border-transparent', 'text-slate-500');
    });

    const contentEl = document.getElementById(`tab-${tabName}`);
    const btnEl = document.getElementById(`tab-btn-${tabName}`);

    if (contentEl && btnEl) {
        contentEl.classList.remove('hidden');
        btnEl.classList.add('active', 'border-indigo-600', 'text-indigo-600');
        btnEl.classList.remove('border-transparent', 'text-slate-500');
        history.replaceState(null, null, `#${tabName}`);
    }

    if (tabName === 'single') updatePreview();
}

// Modal de Google Drive
async function openDriveModal() {
    const modal = document.getElementById('drive-modal');
    const listContainer = document.getElementById('drive-files-list');
    if (!modal || !listContainer) return;

    modal.classList.remove('hidden');
    listContainer.innerHTML = `
        <div class="py-8 text-center text-slate-500 text-xs">
            <i class="fa-solid fa-spinner fa-spin text-xl text-indigo-600 mb-2"></i>
            <p>Buscando hojas de cálculo en tu Google Drive...</p>
        </div>
    `;

    const sheets = await listGoogleDriveSheets();
    if (sheets.length === 0) {
        listContainer.innerHTML = `
            <div class="py-8 text-center text-slate-500 text-xs space-y-2">
                <i class="fa-regular fa-folder-open text-2xl text-slate-400"></i>
                <p>No se encontraron hojas de cálculo o debes iniciar sesión con Google.</p>
                <button onclick="loginWithGoogle()" class="mt-2 bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-lg">Iniciar Sesión</button>
            </div>
        `;
        return;
    }

    listContainer.innerHTML = sheets.map(file => `
        <div class="flex items-center justify-between p-3 border border-slate-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50/50 transition cursor-pointer" onclick="selectDriveSheet('${file.id}', '${encodeURIComponent(file.name)}')">
            <div class="flex items-center space-x-3">
                <i class="fa-solid fa-file-excel text-emerald-600 text-xl"></i>
                <div>
                    <h4 class="text-xs font-bold text-slate-800">${file.name}</h4>
                    <p class="text-[10px] text-slate-400">Modificado: ${new Date(file.modifiedTime).toLocaleDateString()}</p>
                </div>
            </div>
            <button class="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg">
                Seleccionar
            </button>
        </div>
    `).join('');
}

window.selectDriveSheet = async function(fileId, fileName) {
    window.closeDriveModal();
    await loadSpreadsheetMetadata(fileId, decodeURIComponent(fileName));
};

window.loginWithGoogle = async function() {
    await loginWithGoogle();
    openDriveModal();
};

// Eventos de conectividad
function setupNetworkListeners() {
    const badge = document.getElementById('offline-badge');
    function updateStatus() {
        if (navigator.onLine) {
            badge?.classList.add('hidden');
        } else {
            badge?.classList.remove('hidden');
            badge?.classList.add('inline-flex');
        }
    }
    window.addEventListener('online', () => {
        showToast('Conexión restaurada', 'success');
        updateStatus();
    });
    window.addEventListener('offline', () => {
        showToast('Modo sin conexión', 'warning');
        updateStatus();
    });
    updateStatus();
}

// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', () => {
    initFirebase();
    loadSavedSettings(updatePreview);
    renderBatchTable();
    setupNetworkListeners();
    updateBluetoothUI();

    const btProtoSelect = document.getElementById('setting-bt-protocol');
    if (btProtoSelect) {
        btProtoSelect.value = localStorage.getItem('bt_protocol') || 'escpos';
    }

    const initialTab = window.location.hash ? window.location.hash.replace('#', '') : 'single';
    if (['single', 'batch', 'settings'].includes(initialTab)) {
        switchTab(initialTab);
    } else {
        updatePreview();
    }

    // Configurar listeners de inputs en etiqueta única para refresco reactivo
    const inputs = ['inp-title', 'inp-code', 'inp-symbology', 'inp-price', 'inp-currency', 'inp-extra', 
                    'chk-show-title', 'chk-show-price', 'chk-show-extra', 'chk-bold-price'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', updatePreview);
            el.addEventListener('change', () => {
                updatePreview();
                triggerCloudSave();
            });
        }
    });

    // Listener para cambio de protocolo Bluetooth
    const protoSelect = document.getElementById('setting-bt-protocol');
    if (protoSelect) {
        protoSelect.addEventListener('change', () => {
            triggerCloudSave();
        });
    }

    // Listeners para sliders de dimensiones de código
    ['setting-barcode-height', 'setting-barcode-width'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => saveSettings(updatePreview));
        }
    });

    // Detectar si está en modo standalone
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const modeLabel = document.getElementById('display-mode-label');
    if (modeLabel) {
        modeLabel.innerText = isStandalone ? 'App Instalada (Standalone)' : 'Navegador Web';
        if (isStandalone) modeLabel.className = 'font-semibold text-indigo-600';
    }
});
