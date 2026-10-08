import { showToast } from './toast.js';

export let labelConfig = {
    widthMm: 55,
    heightMm: 44,
    paddingMm: 2,
    fontSizePt: 10,
    barcodeHeight: 55,      // porcentaje de altura (25% a 80%)
    barcodeWidth: 2.0,      // grosor de barra (1.0 a 3.0)
    spacingTitle: 2.0,      // separación título-código en mm (0 a 15)
    spacingFooter: 2.0,     // separación código-pie en mm (0 a 15)
    verticalAlign: 'center' // 'center' | 'space-between' | 'flex-start'
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

    // Cargar y sincronizar sliders de espaciado
    ['single', 'settings'].forEach(ctx => {
        const titleInp = document.getElementById(`setting-spacing-title-${ctx}`);
        const footerInp = document.getElementById(`setting-spacing-footer-${ctx}`);
        const titleBadge = document.getElementById(`spacing-title-val-${ctx}`);
        const footerBadge = document.getElementById(`spacing-footer-val-${ctx}`);

        if (titleInp) titleInp.value = labelConfig.spacingTitle ?? 2.0;
        if (footerInp) footerInp.value = labelConfig.spacingFooter ?? 2.0;
        if (titleBadge) titleBadge.innerText = `${(labelConfig.spacingTitle ?? 2.0).toFixed(1)} mm`;
        if (footerBadge) footerBadge.innerText = `${(labelConfig.spacingFooter ?? 2.0).toFixed(1)} mm`;
    });

    updateVerticalAlignUI();

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

export function syncSpacingInputs(type, val, onUpdateCallback) {
    const num = parseFloat(val) || 0;
    if (type === 'title') {
        labelConfig.spacingTitle = num;
        ['single', 'settings'].forEach(ctx => {
            const el = document.getElementById(`setting-spacing-title-${ctx}`);
            const badge = document.getElementById(`spacing-title-val-${ctx}`);
            if (el) el.value = num;
            if (badge) badge.innerText = `${num.toFixed(1)} mm`;
        });
    } else if (type === 'footer') {
        labelConfig.spacingFooter = num;
        ['single', 'settings'].forEach(ctx => {
            const el = document.getElementById(`setting-spacing-footer-${ctx}`);
            const badge = document.getElementById(`spacing-footer-val-${ctx}`);
            if (el) el.value = num;
            if (badge) badge.innerText = `${num.toFixed(1)} mm`;
        });
    }

    localStorage.setItem('printlabel_config', JSON.stringify(labelConfig));
    if (typeof onUpdateCallback === 'function') onUpdateCallback();
}

export function setVerticalAlign(align, onUpdateCallback) {
    labelConfig.verticalAlign = align;
    updateVerticalAlignUI();
    localStorage.setItem('printlabel_config', JSON.stringify(labelConfig));
    if (typeof onUpdateCallback === 'function') onUpdateCallback();
}

export function updateVerticalAlignUI() {
    const align = labelConfig.verticalAlign || 'center';
    const alignTypes = ['center', 'space-between', 'flex-start'];
    
    alignTypes.forEach(type => {
        ['single', 'settings'].forEach(context => {
            const btn = document.getElementById(`valign-${type}-${context}-btn`);
            if (btn) {
                if (type === align) {
                    btn.className = 'valign-btn py-1.5 px-3 rounded-lg border text-xs font-bold bg-indigo-600 text-white border-indigo-600 shadow-sm transition';
                } else {
                    btn.className = 'valign-btn py-1.5 px-3 rounded-lg border text-xs font-medium bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 transition';
                }
            }
        });
    });
}

export function applyPreset(w, h, onUpdateCallback) {
    const wInput = document.getElementById('setting-width');
    const hInput = document.getElementById('setting-height');
    if (wInput) wInput.value = w;
    if (hInput) hInput.value = h;

    saveSettings(onUpdateCallback);
    showToast(`Formato cambiado a ${w}x${h} mm`, 'success');
}
