import { showToast } from './toast.js';
import { triggerCloudSave } from '../services/cloudSync.js';

export let labelConfig = {
    widthMm: 55,
    heightMm: 44,
    paddingMm: 2,           // margen lateral (izq / der)
    paddingTopMm: 2.0,      // margen superior en mm (0 a 15)
    paddingBottomMm: 2.0,   // margen inferior en mm (0 a 15)
    gapMm: 2.0,             // separación física entre etiquetas en mm (0 a 15)
    feedOffsetMm: 0.0,      // micro-ajuste de arrastre/tracción en mm (-4 a +4)
    feedMode: 'exact',      // 'exact' (paso milimétrico sin sensor) | 'sensor' (gap sensor / FF) | 'receipt' (ticket continuo)
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

    // Cargar y sincronizar sliders de márgenes superior e inferior
    ['single', 'settings'].forEach(ctx => {
        const topInp = document.getElementById(`setting-margin-top-${ctx}`);
        const bottomInp = document.getElementById(`setting-margin-bottom-${ctx}`);
        const topBadge = document.getElementById(`margin-top-val-${ctx}`);
        const bottomBadge = document.getElementById(`margin-bottom-val-${ctx}`);

        const topVal = labelConfig.paddingTopMm ?? labelConfig.paddingMm ?? 2.0;
        const bottomVal = labelConfig.paddingBottomMm ?? labelConfig.paddingMm ?? 2.0;

        if (topInp) topInp.value = topVal;
        if (bottomInp) bottomInp.value = bottomVal;
        if (topBadge) topBadge.innerText = `${topVal.toFixed(1)} mm`;
        if (bottomBadge) bottomBadge.innerText = `${bottomVal.toFixed(1)} mm`;
    });

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

    // Cargar y sincronizar configuración de calibración de rollo / anti-desplazamiento
    const gapInput = document.getElementById('setting-gap');
    const gapBadge = document.getElementById('gap-val');
    const offsetInput = document.getElementById('setting-feed-offset');
    const offsetBadge = document.getElementById('feed-offset-val');
    const feedModeSelect = document.getElementById('setting-feed-mode');

    const gapVal = labelConfig.gapMm ?? 2.0;
    const offsetVal = labelConfig.feedOffsetMm ?? 0.0;
    const feedModeVal = labelConfig.feedMode || 'exact';

    if (gapInput) gapInput.value = gapVal;
    if (gapBadge) gapBadge.innerText = `${gapVal.toFixed(1)} mm`;
    if (offsetInput) offsetInput.value = offsetVal;
    if (offsetBadge) offsetBadge.innerText = `${offsetVal >= 0 ? '+' : ''}${offsetVal.toFixed(1)} mm`;
    if (feedModeSelect) feedModeSelect.value = feedModeVal;

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

    const gapInput = document.getElementById('setting-gap');
    const offsetInput = document.getElementById('setting-feed-offset');
    const feedModeSelect = document.getElementById('setting-feed-mode');

    if (gapInput) labelConfig.gapMm = parseFloat(gapInput.value) || 0;
    if (offsetInput) labelConfig.feedOffsetMm = parseFloat(offsetInput.value) || 0;
    if (feedModeSelect) labelConfig.feedMode = feedModeSelect.value;

    const topInp = document.getElementById('setting-margin-top-settings') || document.getElementById('setting-margin-top-single');
    const bottomInp = document.getElementById('setting-margin-bottom-settings') || document.getElementById('setting-margin-bottom-single');
    if (topInp) labelConfig.paddingTopMm = parseFloat(topInp.value) || 2.0;
    if (bottomInp) labelConfig.paddingBottomMm = parseFloat(bottomInp.value) || 2.0;

    const bHeightVal = document.getElementById('barcode-height-val');
    const bWidthVal = document.getElementById('barcode-width-val');
    if (bHeightVal) bHeightVal.innerText = `${labelConfig.barcodeHeight}%`;
    if (bWidthVal) bWidthVal.innerText = `${labelConfig.barcodeWidth}x`;

    localStorage.setItem('printlabel_config', JSON.stringify(labelConfig));
    triggerCloudSave();
    if (typeof onUpdateCallback === 'function') onUpdateCallback();
}

export function syncMarginInputs(type, val, onUpdateCallback) {
    const num = parseFloat(val) || 0;
    if (type === 'top') {
        labelConfig.paddingTopMm = num;
        ['single', 'settings'].forEach(ctx => {
            const el = document.getElementById(`setting-margin-top-${ctx}`);
            const badge = document.getElementById(`margin-top-val-${ctx}`);
            if (el) el.value = num;
            if (badge) badge.innerText = `${num.toFixed(1)} mm`;
        });
    } else if (type === 'bottom') {
        labelConfig.paddingBottomMm = num;
        ['single', 'settings'].forEach(ctx => {
            const el = document.getElementById(`setting-margin-bottom-${ctx}`);
            const badge = document.getElementById(`margin-bottom-val-${ctx}`);
            if (el) el.value = num;
            if (badge) badge.innerText = `${num.toFixed(1)} mm`;
        });
    }

    localStorage.setItem('printlabel_config', JSON.stringify(labelConfig));
    triggerCloudSave();
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
    triggerCloudSave();
    if (typeof onUpdateCallback === 'function') onUpdateCallback();
}

export function syncGapInput(val, onUpdateCallback) {
    const num = parseFloat(val) || 0;
    labelConfig.gapMm = num;
    const gapInput = document.getElementById('setting-gap');
    const gapBadge = document.getElementById('gap-val');
    if (gapInput) gapInput.value = num;
    if (gapBadge) gapBadge.innerText = `${num.toFixed(1)} mm`;

    localStorage.setItem('printlabel_config', JSON.stringify(labelConfig));
    triggerCloudSave();
    if (typeof onUpdateCallback === 'function') onUpdateCallback();
}

export function syncFeedOffsetInput(val, onUpdateCallback) {
    const num = parseFloat(val) || 0;
    labelConfig.feedOffsetMm = num;
    const offsetInput = document.getElementById('setting-feed-offset');
    const offsetBadge = document.getElementById('feed-offset-val');
    if (offsetInput) offsetInput.value = num;
    if (offsetBadge) offsetBadge.innerText = `${num >= 0 ? '+' : ''}${num.toFixed(1)} mm`;

    localStorage.setItem('printlabel_config', JSON.stringify(labelConfig));
    triggerCloudSave();
    if (typeof onUpdateCallback === 'function') onUpdateCallback();
}

export function setFeedMode(mode, onUpdateCallback) {
    labelConfig.feedMode = mode;
    const feedModeSelect = document.getElementById('setting-feed-mode');
    if (feedModeSelect) feedModeSelect.value = mode;

    localStorage.setItem('printlabel_config', JSON.stringify(labelConfig));
    triggerCloudSave();
    if (typeof onUpdateCallback === 'function') onUpdateCallback();
}

export function setVerticalAlign(align, onUpdateCallback) {
    labelConfig.verticalAlign = align;
    updateVerticalAlignUI();
    localStorage.setItem('printlabel_config', JSON.stringify(labelConfig));
    triggerCloudSave();
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
