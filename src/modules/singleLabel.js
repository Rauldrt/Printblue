import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { labelConfig } from './paperSettings.js';
import { showToast } from './toast.js';
import { printSingleLabelBluetooth, isBluetoothConnected, renderLabelToMonochromeCanvas } from '../services/bluetooth.js';

export async function printSingleDirectBT() {
    const showTitle = document.getElementById('chk-show-title')?.checked ?? true;
    const showPrice = document.getElementById('chk-show-price')?.checked ?? true;
    const showExtra = document.getElementById('chk-show-extra')?.checked ?? true;
    const currency = document.getElementById('inp-currency')?.value || '$';

    const rawTitle = document.getElementById('inp-title')?.value || '';
    const code = document.getElementById('inp-code')?.value || '12345678';
    const symbology = document.getElementById('inp-symbology')?.value || 'CODE128';
    const rawPrice = document.getElementById('inp-price')?.value || '';
    const rawExtra = document.getElementById('inp-extra')?.value || '';
    const qty = parseInt(document.getElementById('inp-quantity')?.value) || 1;

    const title = showTitle ? rawTitle : '';
    const price = showPrice && rawPrice ? `${currency} ${rawPrice}` : '';
    const extra = showExtra ? rawExtra : '';

    const item = { title, code, symbology, price, extra };
    await printSingleLabelBluetooth(item, qty);
}

export function adjustQty(val) {
    const input = document.getElementById('inp-quantity');
    const modalInput = document.getElementById('modal-inp-quantity');
    let current = parseInt(input?.value) || 1;
    current = Math.max(1, current + val);
    if (input) input.value = current;
    if (modalInput) modalInput.value = current;
}

export function applyDynamicPageStyle() {
    let styleEl = document.getElementById('dynamic-print-page-style');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'dynamic-print-page-style';
        document.head.appendChild(styleEl);
    }
    const vAlign = labelConfig.verticalAlign || 'center';
    styleEl.innerHTML = `
        @media print {
            @page {
                size: ${labelConfig.widthMm}mm ${labelConfig.heightMm}mm;
                margin: 0mm !important;
            }
            #print-area .print-label-item {
                width: ${labelConfig.widthMm}mm !important;
                height: ${labelConfig.heightMm}mm !important;
                max-height: ${labelConfig.heightMm}mm !important;
                padding-top: ${labelConfig.paddingTopMm ?? labelConfig.paddingMm ?? 2.0}mm !important;
                padding-bottom: ${labelConfig.paddingBottomMm ?? labelConfig.paddingMm ?? 2.0}mm !important;
                padding-left: ${labelConfig.paddingMm ?? 2.0}mm !important;
                padding-right: ${labelConfig.paddingMm ?? 2.0}mm !important;
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: ${vAlign} !important;
                box-sizing: border-box !important;
            }
            #print-area .print-label-title {
                margin-bottom: ${labelConfig.spacingTitle ?? 2.0}mm !important;
            }
            #print-area .print-label-barcode {
                margin-bottom: ${labelConfig.spacingFooter ?? 2.0}mm !important;
                ${vAlign === 'space-between' ? 'flex: 1 !important;' : ''}
            }
        }
    `;
}

/**
 * Renderiza el contenido de una etiqueta dentro de un contenedor dado (desktop o modal)
 */
function renderSingleLabelInto(container, isModal = false) {
    if (!container) return;

    // Proporción de pantalla (1 mm ~ 3.78 px)
    const pxWidth = Math.round(labelConfig.widthMm * 3.78);
    const pxHeight = Math.round(labelConfig.heightMm * 3.78);
    const pxPaddingTop = Math.round((labelConfig.paddingTopMm ?? labelConfig.paddingMm ?? 2.0) * 3.78);
    const pxPaddingBottom = Math.round((labelConfig.paddingBottomMm ?? labelConfig.paddingMm ?? 2.0) * 3.78);
    const pxPaddingSides = Math.round((labelConfig.paddingMm ?? 2.0) * 3.78);
    const spacingTitlePx = Math.round((labelConfig.spacingTitle ?? 2.0) * 3.78);
    const spacingFooterPx = Math.round((labelConfig.spacingFooter ?? 2.0) * 3.78);
    const vAlign = labelConfig.verticalAlign || 'center';

    container.style.width = `${pxWidth}px`;
    container.style.height = `${pxHeight}px`;
    container.style.paddingTop = `${pxPaddingTop}px`;
    container.style.paddingBottom = `${pxPaddingBottom}px`;
    container.style.paddingLeft = `${pxPaddingSides}px`;
    container.style.paddingRight = `${pxPaddingSides}px`;
    container.style.justifyContent = vAlign;

    const title = document.getElementById('inp-title')?.value || '';
    const code = document.getElementById('inp-code')?.value || '12345678';
    const symbology = document.getElementById('inp-symbology')?.value || 'CODE128';
    const price = document.getElementById('inp-price')?.value || '';
    const currency = document.getElementById('inp-currency')?.value || '$';
    const extra = document.getElementById('inp-extra')?.value || '';

    const showTitle = document.getElementById('chk-show-title')?.checked ?? true;
    const showPrice = document.getElementById('chk-show-price')?.checked ?? true;
    const showExtra = document.getElementById('chk-show-extra')?.checked ?? true;
    const boldPrice = document.getElementById('chk-bold-price')?.checked ?? true;

    const svgId = isModal ? 'modal-barcode-svg' : 'barcode-svg';
    const canvasId = isModal ? 'modal-barcode-canvas' : 'barcode-canvas';

    container.innerHTML = `
        ${showTitle && title ? `<div class="font-bold text-slate-800 leading-tight uppercase tracking-tight truncate w-full text-center" style="font-size: ${labelConfig.fontSizePt * 0.9}pt; margin-bottom: ${spacingTitlePx}px;">${title}</div>` : ''}
        
        <div class="flex items-center justify-center w-full overflow-hidden" style="${vAlign === 'space-between' ? 'flex: 1;' : ''} margin-bottom: ${spacingFooterPx}px;">
            ${symbology === 'QR' ? `<canvas id="${canvasId}"></canvas>` : `<svg id="${svgId}" class="max-w-full max-h-full"></svg>`}
        </div>

        <div class="w-full flex items-center justify-between text-slate-800 leading-none">
            ${showExtra && extra ? `<span class="truncate text-slate-500 font-medium" style="font-size: ${labelConfig.fontSizePt * 0.75}pt">${extra}</span>` : '<span></span>'}
            ${showPrice && price ? `<span class="${boldPrice ? 'font-black' : 'font-semibold'}" style="font-size: ${labelConfig.fontSizePt * 1.1}pt">${currency} ${price}</span>` : ''}
        </div>
    `;

    // Renderizar código de barras o QR
    try {
        if (symbology === 'QR') {
            const canvasEl = document.getElementById(canvasId);
            if (canvasEl) {
                const qrSize = Math.min(pxWidth * 0.7, pxHeight * (labelConfig.barcodeHeight / 100));
                QRCode.toCanvas(canvasEl, code, {
                    width: qrSize,
                    margin: 0
                });
            }
        } else {
            const barcodeCalculatedHeight = Math.max(25, Math.round(pxHeight * (labelConfig.barcodeHeight / 100)));
            JsBarcode(`#${svgId}`, code, {
                format: symbology,
                width: labelConfig.barcodeWidth,
                height: barcodeCalculatedHeight,
                displayValue: true,
                fontSize: labelConfig.fontSizePt * 0.85,
                margin: 0
            });
        }
    } catch (e) {
        console.warn('Advertencia en render de código:', e);
    }
}

/**
 * Controla la visibilidad dinámica de los botones:
 * - Botón "Guardar Etiqueta" (aparece solo cuando hay nombre Y código)
 * - Botón "Vista Previa e Impresión" en móviles (aparece solo cuando hay nombre Y código)
 */
export function updateDynamicButtons() {
    const title = (document.getElementById('inp-title')?.value || '').trim();
    const code = (document.getElementById('inp-code')?.value || '').trim();
    const hasRequiredData = title.length > 0 && code.length > 0;

    const saveBtn = document.getElementById('btn-save-label');
    const previewBtn = document.getElementById('btn-open-preview-modal');

    if (saveBtn) {
        if (hasRequiredData) {
            saveBtn.classList.remove('hidden');
            saveBtn.classList.add('flex');
        } else {
            saveBtn.classList.add('hidden');
            saveBtn.classList.remove('flex');
        }
    }

    if (previewBtn) {
        if (hasRequiredData) {
            previewBtn.classList.remove('hidden');
            previewBtn.classList.add('flex');
        } else {
            previewBtn.classList.add('hidden');
            previewBtn.classList.remove('flex');
        }
    }
}

/**
 * Abre el modal de vista previa e impresión para móviles
 */
export function openPreviewModal() {
    const modal = document.getElementById('preview-modal');
    if (!modal) return;
    
    // Sincronizar cantidad
    const qty = document.getElementById('inp-quantity')?.value || '1';
    const modalQty = document.getElementById('modal-inp-quantity');
    if (modalQty) modalQty.value = qty;

    updatePreview();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

/**
 * Cierra el modal de vista previa e impresión
 */
export function closePreviewModal() {
    const modal = document.getElementById('preview-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

export function updatePreview() {
    const dimBadge = document.getElementById('preview-dim-badge');
    const modalDimBadge = document.getElementById('modal-preview-dim-badge');
    const dimText = `${labelConfig.widthMm}x${labelConfig.heightMm} mm`;
    if (dimBadge) dimBadge.innerText = dimText;
    if (modalDimBadge) modalDimBadge.innerText = dimText;

    const desktopContainer = document.getElementById('label-container');
    const modalContainer = document.getElementById('modal-label-container');

    if (desktopContainer) renderSingleLabelInto(desktopContainer, false);
    if (modalContainer) renderSingleLabelInto(modalContainer, true);

    updateExtrasIndicator();
    updateDynamicButtons();
}

/**
 * Controla la apertura/cierre del subcard de opciones Extras
 */
export function toggleExtrasSubcard() {
    const subcard = document.getElementById('extras-subcard');
    const chevron = document.getElementById('extras-chevron');
    if (!subcard) return;
    
    const isClosed = subcard.classList.contains('hidden');
    if (isClosed) {
        subcard.classList.remove('hidden');
        if (chevron) chevron.classList.add('rotate-180');
    } else {
        subcard.classList.add('hidden');
        if (chevron) chevron.classList.remove('rotate-180');
    }
}

/**
 * Actualiza el indicador dinámico en el botón Extras
 */
export function updateExtrasIndicator() {
    const price = document.getElementById('inp-price')?.value?.trim();
    const extra = document.getElementById('inp-extra')?.value?.trim();
    const symbology = document.getElementById('inp-symbology')?.value;
    const activePill = document.getElementById('extras-active-pill');
    
    if (activePill) {
        if (price || extra || (symbology && symbology !== 'CODE128')) {
            activePill.classList.remove('hidden');
            if (price) {
                const curr = document.getElementById('inp-currency')?.value || '$';
                activePill.innerText = `${curr} ${price}`;
            } else if (extra) {
                activePill.innerText = 'Texto extra';
            } else {
                activePill.innerText = symbology || 'Personalizado';
            }
        } else {
            activePill.classList.add('hidden');
        }
    }
}

window.toggleExtrasSubcard = toggleExtrasSubcard;
window.updateExtrasIndicator = updateExtrasIndicator;
window.updateDynamicButtons = updateDynamicButtons;
window.openPreviewModal = openPreviewModal;
window.closePreviewModal = closePreviewModal;

export function triggerPrintSystem() {
    const printArea = document.getElementById('print-area');
    if (!printArea) return;
    printArea.innerHTML = '';

    applyDynamicPageStyle();

    const qty = parseInt(document.getElementById('inp-quantity')?.value) || 1;
    const title = document.getElementById('inp-title')?.value || '';
    const code = document.getElementById('inp-code')?.value || '12345678';
    const symbology = document.getElementById('inp-symbology')?.value || 'CODE128';
    const price = document.getElementById('inp-price')?.value || '';
    const currency = document.getElementById('inp-currency')?.value || '$';
    const extra = document.getElementById('inp-extra')?.value || '';

    const showTitle = document.getElementById('chk-show-title')?.checked ?? true;
    const showPrice = document.getElementById('chk-show-price')?.checked ?? true;
    const showExtra = document.getElementById('chk-show-extra')?.checked ?? true;
    const boldPrice = document.getElementById('chk-bold-price')?.checked ?? true;

    const pxWidth = Math.round(labelConfig.widthMm * 3.78);
    const pxHeight = Math.round(labelConfig.heightMm * 3.78);
    const barcodePrintHeight = Math.max(30, Math.round(pxHeight * (labelConfig.barcodeHeight / 100)));
    const vAlign = labelConfig.verticalAlign || 'center';

    for (let i = 0; i < qty; i++) {
        const labelDiv = document.createElement('div');
        labelDiv.className = 'print-label-item thermal-paper page-break flex flex-col items-center text-center overflow-hidden box-border mx-auto my-0';
        labelDiv.style.width = `${labelConfig.widthMm}mm`;
        labelDiv.style.height = `${labelConfig.heightMm}mm`;
        labelDiv.style.paddingTop = `${labelConfig.paddingTopMm ?? labelConfig.paddingMm ?? 2.0}mm`;
        labelDiv.style.paddingBottom = `${labelConfig.paddingBottomMm ?? labelConfig.paddingMm ?? 2.0}mm`;
        labelDiv.style.paddingLeft = `${labelConfig.paddingMm ?? 2.0}mm`;
        labelDiv.style.paddingRight = `${labelConfig.paddingMm ?? 2.0}mm`;
        labelDiv.style.justifyContent = vAlign;

        const barcodeId = `print-barcode-${i}`;
        
        labelDiv.innerHTML = `
            ${showTitle && title ? `<div class="print-label-title font-bold text-black uppercase leading-tight truncate w-full" style="font-size: ${labelConfig.fontSizePt * 0.95}pt; margin-bottom: ${labelConfig.spacingTitle ?? 2.0}mm;">${title}</div>` : ''}
            <div class="print-label-barcode flex items-center justify-center w-full overflow-hidden" style="${vAlign === 'space-between' ? 'flex: 1;' : ''} margin-bottom: ${labelConfig.spacingFooter ?? 2.0}mm;">
                ${symbology === 'QR' ? `<canvas id="${barcodeId}"></canvas>` : `<svg id="${barcodeId}" class="max-w-full max-h-full"></svg>`}
            </div>
            <div class="print-label-footer w-full flex items-center justify-between text-black leading-none">
                ${showExtra && extra ? `<span class="truncate font-medium text-black" style="font-size: ${labelConfig.fontSizePt * 0.8}pt">${extra}</span>` : '<span></span>'}
                ${showPrice && price ? `<span class="${boldPrice ? 'font-black' : 'font-semibold'}" style="font-size: ${labelConfig.fontSizePt * 1.15}pt">${currency} ${price}</span>` : ''}
            </div>
        `;

        printArea.appendChild(labelDiv);

        setTimeout(() => {
            try {
                if (symbology === 'QR') {
                    const qrSize = Math.min(pxWidth * 0.7, pxHeight * (labelConfig.barcodeHeight / 100));
                    QRCode.toCanvas(document.getElementById(barcodeId), code, {
                        width: qrSize,
                        margin: 0
                    });
                } else {
                    JsBarcode(`#${barcodeId}`, code, {
                        format: symbology,
                        width: labelConfig.barcodeWidth,
                        height: barcodePrintHeight,
                        displayValue: true,
                        fontSize: labelConfig.fontSizePt * 0.85,
                        margin: 0
                    });
                }
            } catch (e) {
                console.error(e);
            }
        }, 50);
    }

    setTimeout(() => {
        window.print();
    }, 300);
}

export async function downloadLabelImage() {
    showToast('Generando imagen completa de etiqueta...', 'info');
    try {
        const showTitle = document.getElementById('chk-show-title')?.checked ?? true;
        const showPrice = document.getElementById('chk-show-price')?.checked ?? true;
        const showExtra = document.getElementById('chk-show-extra')?.checked ?? true;
        const currency = document.getElementById('inp-currency')?.value || '$';

        const rawTitle = document.getElementById('inp-title')?.value || '';
        const code = document.getElementById('inp-code')?.value || '12345678';
        const symbology = document.getElementById('inp-symbology')?.value || 'CODE128';
        const rawPrice = document.getElementById('inp-price')?.value || '';
        const rawExtra = document.getElementById('inp-extra')?.value || '';

        const item = {
            title: showTitle ? rawTitle : '',
            code: code,
            symbology: symbology,
            price: showPrice && rawPrice ? `${currency} ${rawPrice}` : '',
            extra: showExtra ? rawExtra : ''
        };

        const canvas = await renderLabelToMonochromeCanvas(item, {
            ...labelConfig,
            exportFullResolution: true
        });

        const link = document.createElement('a');
        const filenameSafe = (item.title || item.code || 'etiqueta').replace(/[^a-zA-Z0-9_-]/g, '_');
        link.download = `etiqueta-${filenameSafe}-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('¡Etiqueta completa descargada con éxito!', 'success');
    } catch (e) {
        console.error('Error al descargar imagen de etiqueta:', e);
        showToast('Error al generar la imagen PNG', 'error');
    }
}
