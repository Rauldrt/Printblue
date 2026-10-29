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

/**
 * Carga configuraciones guardadas de localStorage y las aplica a la interfaz
 */
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

    // Sliders de márgenes superior e inferior
    const topVal = labelConfig.paddingTopMm ?? labelConfig.paddingMm ?? 2.0;
    const bottomVal = labelConfig.paddingBottomMm ?? labelConfig.paddingMm ?? 2.0;
    ['fab', 'settings', 'single', ''].forEach(ctx => {
        const topInp = document.getElementById(ctx ? `setting-margin-top-${ctx}` : 'setting-margin-top');
        const bottomInp = document.getElementById(ctx ? `setting-margin-bottom-${ctx}` : 'setting-margin-bottom');
        const topBadge = document.getElementById(ctx ? `margin-top-val-${ctx}` : 'margin-top-val');
        const bottomBadge = document.getElementById(ctx ? `margin-bottom-val-${ctx}` : 'margin-bottom-val');

        if (topInp) topInp.value = topVal;
        if (bottomInp) bottomInp.value = bottomVal;
        if (topBadge) topBadge.innerText = `${topVal.toFixed(1)} mm`;
        if (bottomBadge) bottomBadge.innerText = `${bottomVal.toFixed(1)} mm`;
    });

    // Sliders de separación
    const titleVal = labelConfig.spacingTitle ?? 2.0;
    const footerVal = labelConfig.spacingFooter ?? 2.0;
    ['fab', 'settings', 'single', ''].forEach(ctx => {
        const titleInp = document.getElementById(ctx ? `setting-spacing-title-${ctx}` : 'setting-spacing-title');
        const footerInp = document.getElementById(ctx ? `setting-spacing-footer-${ctx}` : 'setting-spacing-footer');
        const titleBadge = document.getElementById(ctx ? `spacing-title-val-${ctx}` : 'spacing-title-val');
        const footerBadge = document.getElementById(ctx ? `spacing-footer-val-${ctx}` : 'spacing-footer-val');

        if (titleInp) titleInp.value = titleVal;
        if (footerInp) footerInp.value = footerVal;
        if (titleBadge) titleBadge.innerText = `${titleVal.toFixed(1)} mm`;
        if (footerBadge) footerBadge.innerText = `${footerVal.toFixed(1)} mm`;
    });

    // Calibración de avance y gap
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

    // Protocolo Bluetooth
    const protoSelect = document.getElementById('setting-bt-protocol');
    if (protoSelect) {
        protoSelect.value = localStorage.getItem('bt_protocol') || 'escpos';
    }

    updateVerticalAlignUI();
    updateSettingsSummaries();

    if (typeof onUpdateCallback === 'function') onUpdateCallback();
}

/**
 * Guarda los valores actuales de los inputs
 */
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

    const topInp = document.getElementById('setting-margin-top') || document.getElementById('setting-margin-top-fab') || document.getElementById('setting-margin-top-settings');
    const bottomInp = document.getElementById('setting-margin-bottom') || document.getElementById('setting-margin-bottom-fab') || document.getElementById('setting-margin-bottom-settings');
    if (topInp) labelConfig.paddingTopMm = parseFloat(topInp.value) || 2.0;
    if (bottomInp) labelConfig.paddingBottomMm = parseFloat(bottomInp.value) || 2.0;

    const bHeightVal = document.getElementById('barcode-height-val');
    const bWidthVal = document.getElementById('barcode-width-val');
    if (bHeightVal) bHeightVal.innerText = `${labelConfig.barcodeHeight}%`;
    if (bWidthVal) bWidthVal.innerText = `${labelConfig.barcodeWidth}x`;

    localStorage.setItem('printlabel_config', JSON.stringify(labelConfig));
    updateSettingsSummaries();
    triggerCloudSave();

    if (typeof onUpdateCallback === 'function') onUpdateCallback();
}

/**
 * Sincroniza márgenes superior / inferior
 */
export function syncMarginInputs(type, val, onUpdateCallback) {
    const num = parseFloat(val) || 0;
    if (type === 'top') {
        labelConfig.paddingTopMm = num;
        ['fab', 'settings', 'single', ''].forEach(ctx => {
            const el = document.getElementById(ctx ? `setting-margin-top-${ctx}` : 'setting-margin-top');
            const badge = document.getElementById(ctx ? `margin-top-val-${ctx}` : 'margin-top-val');
            if (el) el.value = num;
            if (badge) badge.innerText = `${num.toFixed(1)} mm`;
        });
    } else if (type === 'bottom') {
        labelConfig.paddingBottomMm = num;
        ['fab', 'settings', 'single', ''].forEach(ctx => {
            const el = document.getElementById(ctx ? `setting-margin-bottom-${ctx}` : 'setting-margin-bottom');
            const badge = document.getElementById(ctx ? `margin-bottom-val-${ctx}` : 'margin-bottom-val');
            if (el) el.value = num;
            if (badge) badge.innerText = `${num.toFixed(1)} mm`;
        });
    }

    localStorage.setItem('printlabel_config', JSON.stringify(labelConfig));
    updateSettingsSummaries();
    triggerCloudSave();
    if (typeof onUpdateCallback === 'function') onUpdateCallback();
}

/**
 * Sincroniza separaciones internas
 */
export function syncSpacingInputs(type, val, onUpdateCallback) {
    const num = parseFloat(val) || 0;
    if (type === 'title') {
        labelConfig.spacingTitle = num;
        ['fab', 'settings', 'single', ''].forEach(ctx => {
            const el = document.getElementById(ctx ? `setting-spacing-title-${ctx}` : 'setting-spacing-title');
            const badge = document.getElementById(ctx ? `spacing-title-val-${ctx}` : 'spacing-title-val');
            if (el) el.value = num;
            if (badge) badge.innerText = `${num.toFixed(1)} mm`;
        });
    } else if (type === 'footer') {
        labelConfig.spacingFooter = num;
        ['fab', 'settings', 'single', ''].forEach(ctx => {
            const el = document.getElementById(ctx ? `setting-spacing-footer-${ctx}` : 'setting-spacing-footer');
            const badge = document.getElementById(ctx ? `spacing-footer-val-${ctx}` : 'spacing-footer-val');
            if (el) el.value = num;
            if (badge) badge.innerText = `${num.toFixed(1)} mm`;
        });
    }

    localStorage.setItem('printlabel_config', JSON.stringify(labelConfig));
    updateSettingsSummaries();
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
    updateSettingsSummaries();
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
    updateSettingsSummaries();
    triggerCloudSave();
    if (typeof onUpdateCallback === 'function') onUpdateCallback();
}

export function setFeedMode(mode, onUpdateCallback) {
    labelConfig.feedMode = mode;
    const feedModeSelect = document.getElementById('setting-feed-mode');
    if (feedModeSelect) feedModeSelect.value = mode;

    localStorage.setItem('printlabel_config', JSON.stringify(labelConfig));
    updateSettingsSummaries();
    triggerCloudSave();
    if (typeof onUpdateCallback === 'function') onUpdateCallback();
}

export function setVerticalAlign(align, onUpdateCallback) {
    labelConfig.verticalAlign = align;
    updateVerticalAlignUI();
    localStorage.setItem('printlabel_config', JSON.stringify(labelConfig));
    updateSettingsSummaries();
    triggerCloudSave();
    if (typeof onUpdateCallback === 'function') onUpdateCallback();
}

export function updateVerticalAlignUI() {
    const align = labelConfig.verticalAlign || 'center';
    const alignTypes = ['center', 'space-between', 'flex-start'];
    
    alignTypes.forEach(type => {
        ['fab', 'single', 'settings', ''].forEach(context => {
            const btnId = context ? `valign-${type}-${context}-btn` : `valign-${type}-btn`;
            const btn = document.getElementById(btnId);
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

    // Actualizar estilo activo en los botones de presets
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.classList.remove('border-indigo-500', 'bg-indigo-50/70', 'ring-1', 'ring-indigo-300');
    });

    saveSettings(onUpdateCallback);
    showToast(`Formato de papel establecido a ${w}x${h} mm`, 'success');
}

/**
 * Actualiza los badges de resumen dentro del FAB expandido
 */
export function updateSettingsSummaries() {
    const rollBadge = document.getElementById('fab-header-badge');
    const rollSummary = document.getElementById('accordion-summary-roll');
    const codeSummary = document.getElementById('accordion-summary-code');
    const marginsSummary = document.getElementById('accordion-summary-margins');
    const btSummary = document.getElementById('accordion-summary-bt');

    const rollText = `${labelConfig.widthMm}x${labelConfig.heightMm} mm`;
    if (rollBadge) rollBadge.innerText = rollText;
    if (rollSummary) rollSummary.innerText = rollText;

    if (codeSummary) {
        codeSummary.innerText = `${labelConfig.barcodeHeight}% | ${labelConfig.barcodeWidth}x`;
    }

    if (marginsSummary) {
        const top = (labelConfig.paddingTopMm ?? 2.0).toFixed(1);
        const bot = (labelConfig.paddingBottomMm ?? 2.0).toFixed(1);
        marginsSummary.innerText = `Sup: ${top} | Inf: ${bot} mm`;
    }

    if (btSummary) {
        const proto = localStorage.getItem('bt_protocol') || 'escpos';
        btSummary.innerText = proto === 'tspl' ? 'TSPL' : 'ESC/POS';
    }
}

/* ==========================================
   CONTROLADORES DEL FAB MATERIAL DESIGN 3
   ========================================== */

export function handleFabClick() {
    if (window.innerWidth <= 640) {
        toggleFabSpeedDial();
    } else {
        openSettingsFAB();
    }
}

export function toggleFabSpeedDial() {
    const speedDial = document.getElementById('m3-fab-speed-dial');
    const backdrop = document.getElementById('m3-speed-dial-backdrop');
    const icon = document.getElementById('m3-fab-icon');
    if (!speedDial) return;

    const isHidden = speedDial.classList.contains('hidden');
    if (isHidden) {
        speedDial.classList.remove('hidden');
        speedDial.classList.add('flex');
        if (backdrop) backdrop.classList.remove('hidden');
        if (icon) {
            icon.classList.remove('fa-sliders');
            icon.classList.add('fa-xmark');
        }
    } else {
        closeFabSpeedDial();
    }
}

export function closeFabSpeedDial() {
    const speedDial = document.getElementById('m3-fab-speed-dial');
    const backdrop = document.getElementById('m3-speed-dial-backdrop');
    const icon = document.getElementById('m3-fab-icon');
    if (speedDial) {
        speedDial.classList.add('hidden');
        speedDial.classList.remove('flex');
    }
    if (backdrop) backdrop.classList.add('hidden');
    if (icon) {
        icon.classList.remove('fa-xmark');
        icon.classList.add('fa-sliders');
    }
}

export function openSettingsFAB() {
    closeFabSpeedDial();
    const container = document.getElementById('m3-settings-fab');
    const backdrop = document.getElementById('m3-fab-backdrop');
    if (container) {
        container.classList.remove('is-collapsed');
        container.classList.add('is-expanded');
    }
    if (backdrop) backdrop.classList.add('is-active');
    updateSettingsSummaries();
}

export function closeSettingsFAB() {
    closeFabSpeedDial();
    const container = document.getElementById('m3-settings-fab');
    const backdrop = document.getElementById('m3-fab-backdrop');
    if (container) {
        container.classList.remove('is-expanded');
        container.classList.add('is-collapsed');
    }
    if (backdrop) backdrop.classList.remove('is-active');
}

export function toggleSettingsFAB() {
    const container = document.getElementById('m3-settings-fab');
    if (container?.classList.contains('is-expanded')) {
        closeSettingsFAB();
    } else {
        openSettingsFAB();
    }
}

/**
 * Controla la apertura/cierre de cada sección del acordeón
 */
export function toggleAccordion(index) {
    const items = document.querySelectorAll('.m3-accordion-item');
    items.forEach((item, idx) => {
        if (idx === index) {
            item.classList.toggle('is-open');
        } else {
            item.classList.remove('is-open');
        }
    });
}
