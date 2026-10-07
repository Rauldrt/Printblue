import { showToast } from './toast.js';

export let labelConfig = {
    widthMm: 55,
    heightMm: 44,
    paddingMm: 2,
    fontSizePt: 10,
    barcodeHeight: 55,  // porcentaje de altura (25% a 80%)
    barcodeWidth: 2.0   // grosor de barra (1.0 a 3.0)
};

export function loadSavedSettings(onUpdateCallback) {
    const saved = localStorage.getItem('printlabel_config');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            labelConfig = { ...labelConfig, ...parsed };
        } catch (e) {
            console.error('Error al cargar configuración:', e);
        }
    }

    const wInput = document.getElementById('setting-width');
    const hInput = document.getElementById('setting-height');
    const pInput = document.getElementById('setting-padding');
    const fInput = document.getElementById('setting-fontsize');
    const bHeightInput = document.getElementById('setting-barcode-height');
    const bWidthInput = document.getElementById('setting-barcode-width');
    const bHeightVal = document.getElementById('barcode-height-val');
    const bWidthVal = document.getElementById('barcode-width-val');

    if (wInput) wInput.value = labelConfig.widthMm;
    if (hInput) hInput.value = labelConfig.heightMm;
    if (pInput) pInput.value = labelConfig.paddingMm;
    if (fInput) fInput.value = labelConfig.fontSizePt;
    if (bHeightInput) bHeightInput.value = labelConfig.barcodeHeight;
    if (bWidthInput) bWidthInput.value = labelConfig.barcodeWidth;
    if (bHeightVal) bHeightVal.innerText = `${labelConfig.barcodeHeight}%`;
    if (bWidthVal) bWidthVal.innerText = `${labelConfig.barcodeWidth}x`;

    if (typeof onUpdateCallback === 'function') onUpdateCallback();
}

export function saveSettings(onUpdateCallback) {
    labelConfig.widthMm = parseFloat(document.getElementById('setting-width')?.value) || 55;
    labelConfig.heightMm = parseFloat(document.getElementById('setting-height')?.value) || 44;
    labelConfig.paddingMm = parseFloat(document.getElementById('setting-padding')?.value) || 2;
    labelConfig.fontSizePt = parseFloat(document.getElementById('setting-fontsize')?.value) || 10;
    labelConfig.barcodeHeight = parseInt(document.getElementById('setting-barcode-height')?.value) || 55;
    labelConfig.barcodeWidth = parseFloat(document.getElementById('setting-barcode-width')?.value) || 2.0;

    const bHeightVal = document.getElementById('barcode-height-val');
    const bWidthVal = document.getElementById('barcode-width-val');
    if (bHeightVal) bHeightVal.innerText = `${labelConfig.barcodeHeight}%`;
    if (bWidthVal) bWidthVal.innerText = `${labelConfig.barcodeWidth}x`;

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
