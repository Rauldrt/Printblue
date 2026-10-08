import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { labelConfig } from './paperSettings.js';
import { showToast } from './toast.js';
import { printSingleLabelBluetooth, isBluetoothConnected } from '../services/bluetooth.js';

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
    if (!input) return;
    let current = parseInt(input.value) || 1;
    current = Math.max(1, current + val);
    input.value = current;
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
                padding: ${labelConfig.paddingMm}mm !important;
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

export function updatePreview() {
    const container = document.getElementById('label-container');
    const dimBadge = document.getElementById('preview-dim-badge');
    if (!container) return;

    if (dimBadge) {
        dimBadge.innerText = `${labelConfig.widthMm}x${labelConfig.heightMm} mm`;
    }

    // Proporción de pantalla (1 mm ~ 3.78 px)
    const pxWidth = Math.round(labelConfig.widthMm * 3.78);
    const pxHeight = Math.round(labelConfig.heightMm * 3.78);
    const pxPadding = Math.round(labelConfig.paddingMm * 3.78);
    const spacingTitlePx = Math.round((labelConfig.spacingTitle ?? 2.0) * 3.78);
    const spacingFooterPx = Math.round((labelConfig.spacingFooter ?? 2.0) * 3.78);
    const vAlign = labelConfig.verticalAlign || 'center';

    container.style.width = `${pxWidth}px`;
    container.style.height = `${pxHeight}px`;
    container.style.padding = `${pxPadding}px`;
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

    container.innerHTML = `
        ${showTitle && title ? `<div class="font-bold text-slate-800 leading-tight uppercase tracking-tight truncate w-full text-center" style="font-size: ${labelConfig.fontSizePt * 0.9}pt; margin-bottom: ${spacingTitlePx}px;">${title}</div>` : ''}
        
        <div class="flex items-center justify-center w-full overflow-hidden" style="${vAlign === 'space-between' ? 'flex: 1;' : ''} margin-bottom: ${spacingFooterPx}px;">
            ${symbology === 'QR' ? '<canvas id="barcode-canvas"></canvas>' : '<svg id="barcode-svg" class="max-w-full max-h-full"></svg>'}
        </div>

        <div class="w-full flex items-center justify-between text-slate-800 leading-none">
            ${showExtra && extra ? `<span class="truncate text-slate-500 font-medium" style="font-size: ${labelConfig.fontSizePt * 0.75}pt">${extra}</span>` : '<span></span>'}
            ${showPrice && price ? `<span class="${boldPrice ? 'font-black' : 'font-semibold'}" style="font-size: ${labelConfig.fontSizePt * 1.1}pt">${currency} ${price}</span>` : ''}
        </div>
    `;

    // Renderizar código
    try {
        if (symbology === 'QR') {
            const canvasEl = document.getElementById('barcode-canvas');
            if (canvasEl) {
                const qrSize = Math.min(pxWidth * 0.7, pxHeight * (labelConfig.barcodeHeight / 100));
                QRCode.toCanvas(canvasEl, code, {
                    width: qrSize,
                    margin: 0
                });
            }
        } else {
            const barcodeCalculatedHeight = Math.max(25, Math.round(pxHeight * (labelConfig.barcodeHeight / 100)));
            JsBarcode("#barcode-svg", code, {
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
        labelDiv.style.padding = `${labelConfig.paddingMm}mm`;
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

export function downloadLabelImage() {
    const container = document.getElementById('label-container');
    if (!container) return;
    showToast('Generando imagen de etiqueta...', 'info');

    const svg = container.querySelector('svg');
    if (svg) {
        const xml = new XMLSerializer().serializeToString(svg);
        const svg64 = btoa(xml);
        const image64 = 'data:image/svg+xml;base64,' + svg64;

        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            canvas.width = container.clientWidth * 2;
            canvas.height = container.clientHeight * 2;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 20, 20, canvas.width - 40, canvas.height - 40);

            const link = document.createElement('a');
            link.download = `etiqueta-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        };
        img.src = image64;
    } else {
        const qrCanvas = container.querySelector('canvas');
        if (qrCanvas) {
            const link = document.createElement('a');
            link.download = `etiqueta-qr-${Date.now()}.png`;
            link.href = qrCanvas.toDataURL('image/png');
            link.click();
        } else {
            showToast('Usa impresión del sistema para este formato', 'info');
        }
    }
}
