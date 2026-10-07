import { showToast } from './toast.js';

export let labelConfig = {
    widthMm: 50,
    heightMm: 30,
    paddingMm: 2,
    fontSizePt: 10
};

export function loadSavedSettings(onUpdateCallback) {
    const saved = localStorage.getItem('printlabel_config');
    if (saved) {
        try {
            labelConfig = JSON.parse(saved);
            const wInput = document.getElementById('setting-width');
            const hInput = document.getElementById('setting-height');
            const pInput = document.getElementById('setting-padding');
            const fInput = document.getElementById('setting-fontsize');

            if (wInput) wInput.value = labelConfig.widthMm;
            if (hInput) hInput.value = labelConfig.heightMm;
            if (pInput) pInput.value = labelConfig.paddingMm;
            if (fInput) fInput.value = labelConfig.fontSizePt;
        } catch (e) {
            console.error('Error al cargar configuración:', e);
        }
    }
    if (typeof onUpdateCallback === 'function') onUpdateCallback();
}

export function saveSettings(onUpdateCallback) {
    labelConfig.widthMm = parseFloat(document.getElementById('setting-width')?.value) || 50;
    labelConfig.heightMm = parseFloat(document.getElementById('setting-height')?.value) || 30;
    labelConfig.paddingMm = parseFloat(document.getElementById('setting-padding')?.value) || 2;
    labelConfig.fontSizePt = parseFloat(document.getElementById('setting-fontsize')?.value) || 10;

    localStorage.setItem('printlabel_config', JSON.stringify(labelConfig));
    if (typeof onUpdateCallback === 'function') onUpdateCallback();
}

export function applyPreset(w, h, onUpdateCallback) {
    const wInput = document.getElementById('setting-width');
    const hInput = document.getElementById('setting-height');
    if (wInput) wInput.value = w;
    if (hInput) hInput.value = h;

    saveSettings(onUpdateCallback);
    showToast(`Formato cambiado a ${w}x${h} mm`, 'success');
}
