import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { labelConfig } from './paperSettings.js';
import { showToast } from './toast.js';
import { 
    sendRawToPrinter, 
    canvasToEscPosCommands, 
    isBluetoothConnected, 
    connectBluetoothPrinter 
} from '../services/bluetooth.js';
import { triggerCloudSave } from '../services/cloudSync.js';

// Estado de configuración del Diseñador Personalizado
export const designerState = {
    showLogo: true,
    logoDataUrl: null,
    logoThreshold: 135,
    logoInvert: false,
    logoSize: 50,          // % del ancho útil
    logoAlign: 'center',   // 'left', 'center', 'right'
    
    headerText: 'MI COMERCIO',
    subHeaderText: 'Ropa & Accesorios • Calidad Premium',
    showDivider: true,
    
    showCode: true,
    codeType: 'QR',        // 'QR', 'CODE128', 'EAN13'
    codeValue: 'https://instagram.com/mitienda',
    codeSub: 'Escaneá para ver catálogo',
    
    footerText: 'Cambios con ticket dentro de los 30 días',
    price: '',
    currency: '$'
};

const STORAGE_KEY = 'printlabel_designer_config';

/**
 * Carga la configuración guardada del diseñador
 */
export function loadDesignerConfig() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const saved = JSON.parse(raw);
            Object.assign(designerState, saved);
        }
    } catch (e) {
        console.error('Error cargando configuración del diseñador:', e);
    }
}

/**
 * Guarda la configuración del diseñador en localStorage
 */
export function saveDesignerConfig(showNotification = false) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(designerState));
        if (showNotification) {
            showToast('Plantilla de diseño guardada con éxito', 'success');
        }
        triggerCloudSave();
    } catch (e) {
        console.error('Error guardando configuración del diseñador:', e);
    }
}

/**
 * Sincroniza los controles del DOM con el estado actual
 */
export function syncDesignerFormFromState() {
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el && val !== undefined) el.value = val;
    };
    const setChk = (id, val) => {
        const el = document.getElementById(id);
        if (el && val !== undefined) el.checked = Boolean(val);
    };

    setChk('chk-designer-show-logo', designerState.showLogo);
    setVal('setting-designer-threshold', designerState.logoThreshold);
    const threshValEl = document.getElementById('designer-threshold-val');
    if (threshValEl) threshValEl.innerText = designerState.logoThreshold;

    setChk('chk-designer-invert-logo', designerState.logoInvert);
    setVal('setting-designer-logo-size', designerState.logoSize);
    const sizeValEl = document.getElementById('designer-logo-size-val');
    if (sizeValEl) sizeValEl.innerText = `${designerState.logoSize}%`;

    setVal('inp-designer-header', designerState.headerText);
    setVal('inp-designer-subheader', designerState.subHeaderText);
    setChk('chk-designer-show-divider', designerState.showDivider);

    setChk('chk-designer-show-code', designerState.showCode);
    setVal('inp-designer-code-type', designerState.codeType);
    setVal('inp-designer-code-value', designerState.codeValue);
    setVal('inp-designer-code-sub', designerState.codeSub);

    setVal('inp-designer-footer', designerState.footerText);
    setVal('inp-designer-price', designerState.price);
    setVal('inp-designer-currency', designerState.currency);

    const codeFields = document.getElementById('designer-code-fields');
    if (codeFields) {
        codeFields.classList.toggle('hidden', !designerState.showCode);
    }

    updateLogoControlsVisibility();
}

/**
 * Lee los valores del formulario y actualiza el estado
 */
export function syncDesignerStateFromForm() {
    const getVal = (id, fallback = '') => document.getElementById(id)?.value ?? fallback;
    const getChk = (id, fallback = false) => document.getElementById(id)?.checked ?? fallback;

    designerState.showLogo = getChk('chk-designer-show-logo', true);
    designerState.logoThreshold = parseInt(getVal('setting-designer-threshold', '135')) || 135;
    const threshValEl = document.getElementById('designer-threshold-val');
    if (threshValEl) threshValEl.innerText = designerState.logoThreshold;

    designerState.logoInvert = getChk('chk-designer-invert-logo', false);
    designerState.logoSize = parseInt(getVal('setting-designer-logo-size', '50')) || 50;
    const sizeValEl = document.getElementById('designer-logo-size-val');
    if (sizeValEl) sizeValEl.innerText = `${designerState.logoSize}%`;

    designerState.headerText = getVal('inp-designer-header', '');
    designerState.subHeaderText = getVal('inp-designer-subheader', '');
    designerState.showDivider = getChk('chk-designer-show-divider', true);

    designerState.showCode = getChk('chk-designer-show-code', true);
    designerState.codeType = getVal('inp-designer-code-type', 'QR');
    designerState.codeValue = getVal('inp-designer-code-value', '');
    designerState.codeSub = getVal('inp-designer-code-sub', '');

    const codeFields = document.getElementById('designer-code-fields');
    if (codeFields) {
        codeFields.classList.toggle('hidden', !designerState.showCode);
    }

    designerState.footerText = getVal('inp-designer-footer', '');
    designerState.price = getVal('inp-designer-price', '');
    designerState.currency = getVal('inp-designer-currency', '$');

    updateLogoControlsVisibility();
    saveDesignerConfig(false);
}

/**
 * Maneja la subida de un nuevo logo desde un archivo
 */
export function handleLogoUpload(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        showToast('El archivo seleccionado debe ser una imagen (PNG, JPG, SVG)', 'warning');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        designerState.logoDataUrl = e.target.result;
        designerState.showLogo = true;
        const chkLogo = document.getElementById('chk-designer-show-logo');
        if (chkLogo) chkLogo.checked = true;
        
        saveDesignerConfig();
        updateLogoControlsVisibility();
        renderDesignerPreview();
        showToast('Logo cargado correctamente', 'success');
    };
    reader.readAsDataURL(file);
}

/**
 * Remueve el logo actual
 */
export function removeLogo() {
    designerState.logoDataUrl = null;
    const inputEl = document.getElementById('inp-designer-logo-file');
    if (inputEl) inputEl.value = '';
    
    saveDesignerConfig();
    updateLogoControlsVisibility();
    renderDesignerPreview();
    showToast('Logo eliminado', 'info');
}

/**
 * Muestra/oculta los controles del logo según corresponda
 */
export function updateLogoControlsVisibility() {
    const logoSettings = document.getElementById('designer-logo-settings');
    const logoEmptyPrompt = document.getElementById('designer-logo-empty-prompt');
    const logoLoadedPrompt = document.getElementById('designer-logo-loaded-prompt');
    const chkShowLogo = document.getElementById('chk-designer-show-logo');

    const hasLogo = Boolean(designerState.logoDataUrl);
    const isLogoActive = chkShowLogo ? chkShowLogo.checked : designerState.showLogo;

    if (logoSettings) {
        logoSettings.classList.toggle('hidden', !isLogoActive || !hasLogo);
    }
    if (logoEmptyPrompt) {
        logoEmptyPrompt.classList.toggle('hidden', hasLogo);
    }
    if (logoLoadedPrompt) {
        logoLoadedPrompt.classList.toggle('hidden', !hasLogo);
    }
}

/**
 * Procesa y dibuja una imagen aplicando umbral monocromático y dither térmico
 */
function processAndDrawMonochromeImage(ctx, img, x, y, width, height, threshold = 128, invert = false) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Dibujar imagen original escalada
    tempCtx.drawImage(img, 0, 0, width, height);
    
    const imgData = tempCtx.getImageData(0, 0, width, height);
    const data = imgData.data;

    // Conversión a monocromo de alto contraste con dither básico para cabezal térmico
    for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a < 60) {
            // Transparente -> blanco
            data[i] = 255;
            data[i + 1] = 255;
            data[i + 2] = 255;
            data[i + 3] = 255;
            continue;
        }

        // Luminancia perceptual estándar
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        let isBlack = gray < threshold;
        if (invert) isBlack = !isBlack;

        const val = isBlack ? 0 : 255;
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
        data[i + 3] = 255;
    }

    tempCtx.putImageData(imgData, 0, 0);
    ctx.drawImage(tempCanvas, x, y);
}

/**
 * Renderiza la etiqueta completa en un Canvas 2D según la calibración de papel del FAB
 */
export async function renderDesignerCanvas(targetCanvas, isExport = false) {
    if (!targetCanvas) return;

    // Ancho térmico estándar de cabezal 58mm (384 puntos) o proporcional
    const dotsWidth = labelConfig.widthMm <= 58 ? 384 : Math.round(labelConfig.widthMm * 8);
    const dotsHeight = Math.round((labelConfig.heightMm / labelConfig.widthMm) * dotsWidth);

    targetCanvas.width = dotsWidth;
    targetCanvas.height = dotsHeight;
    const ctx = targetCanvas.getContext('2d');

    // Fondo blanco nítido
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, dotsWidth, dotsHeight);

    const paddingX = Math.round((labelConfig.paddingMm ?? 2.0) * (dotsWidth / labelConfig.widthMm));
    const paddingTop = Math.round((labelConfig.paddingTopMm ?? labelConfig.paddingMm ?? 2.0) * (dotsHeight / labelConfig.heightMm));
    const paddingBottom = Math.round((labelConfig.paddingBottomMm ?? labelConfig.paddingMm ?? 2.0) * (dotsHeight / labelConfig.heightMm));
    const contentWidth = dotsWidth - (paddingX * 2);

    let currentY = paddingTop;
    const spacing = Math.round(10 * (dotsWidth / 384));

    // 1. Logo de la empresa
    if (designerState.showLogo && designerState.logoDataUrl) {
        try {
            const logoImg = await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = designerState.logoDataUrl;
            });

            const maxLogoWidth = Math.round(contentWidth * (designerState.logoSize / 100));
            const aspect = logoImg.width / logoImg.height;
            const logoHeight = Math.round(maxLogoWidth / aspect);

            let logoX = paddingX + (contentWidth - maxLogoWidth) / 2;
            if (designerState.logoAlign === 'left') logoX = paddingX;
            if (designerState.logoAlign === 'right') logoX = paddingX + contentWidth - maxLogoWidth;

            processAndDrawMonochromeImage(
                ctx, 
                logoImg, 
                logoX, 
                currentY, 
                maxLogoWidth, 
                logoHeight, 
                designerState.logoThreshold, 
                designerState.logoInvert
            );

            currentY += logoHeight + spacing;
        } catch (e) {
            console.warn('Error al procesar logo en diseñador:', e);
        }
    }

    // 2. Encabezado / Nombre de Marca
    if (designerState.headerText && designerState.headerText.trim()) {
        ctx.fillStyle = '#000000';
        const fontSizeHeader = Math.round(24 * (dotsWidth / 384));
        ctx.font = `bold ${fontSizeHeader}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(designerState.headerText.trim().toUpperCase(), dotsWidth / 2, currentY, contentWidth);
        currentY += fontSizeHeader + Math.round(spacing * 0.4);
    }

    // 3. Subtítulo / Razón Social / Redes
    if (designerState.subHeaderText && designerState.subHeaderText.trim()) {
        ctx.fillStyle = '#000000';
        const fontSizeSub = Math.round(14 * (dotsWidth / 384));
        ctx.font = `500 ${fontSizeSub}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(designerState.subHeaderText.trim(), dotsWidth / 2, currentY, contentWidth);
        currentY += fontSizeSub + Math.round(spacing * 0.6);
    }

    // 4. Línea Divisoria Estética
    if (designerState.showDivider) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(1, Math.round(2 * (dotsWidth / 384)));
        ctx.beginPath();
        ctx.moveTo(paddingX + 10, currentY);
        ctx.lineTo(dotsWidth - paddingX - 10, currentY);
        ctx.stroke();
        currentY += spacing;
    }

    // 5. Código de Barras o Código QR
    if (designerState.showCode && designerState.codeValue && designerState.codeValue.trim()) {
        const codeVal = designerState.codeValue.trim();
        const codeType = designerState.codeType || 'QR';

        if (codeType === 'QR') {
            const qrCanvas = document.createElement('canvas');
            const qrSize = Math.min(contentWidth * 0.6, Math.max(80, dotsHeight * 0.35));
            try {
                await QRCode.toCanvas(qrCanvas, codeVal, {
                    width: qrSize,
                    margin: 0
                });
                const qrX = Math.round((dotsWidth - qrSize) / 2);
                ctx.drawImage(qrCanvas, qrX, currentY, qrSize, qrSize);
                currentY += qrSize + Math.round(spacing * 0.5);
            } catch (e) {
                console.error('Error generando QR en diseñador:', e);
            }
        } else {
            // Código de barras (CODE128 o EAN13)
            const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            const barcodeAreaHeight = Math.max(35, Math.round(dotsHeight * 0.22));
            try {
                JsBarcode(tempSvg, codeVal, {
                    format: codeType,
                    width: 2.0,
                    height: barcodeAreaHeight,
                    displayValue: true,
                    fontSize: 16,
                    margin: 0
                });

                const svgXml = new XMLSerializer().serializeToString(tempSvg);
                const barcodeImg = await new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = () => resolve(null);
                    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgXml);
                });

                if (barcodeImg) {
                    const drawWidth = Math.min(contentWidth, barcodeImg.width);
                    const drawX = Math.round((dotsWidth - drawWidth) / 2);
                    ctx.drawImage(barcodeImg, drawX, currentY, drawWidth, barcodeAreaHeight);
                    currentY += barcodeAreaHeight + Math.round(spacing * 0.5);
                }
            } catch (e) {
                console.error('Error generando código de barras en diseñador:', e);
            }
        }

        // Subtítulo debajo del código (ej: 'Seguinos en Instagram')
        if (designerState.codeSub && designerState.codeSub.trim()) {
            ctx.fillStyle = '#000000';
            const fontSizeCodeSub = Math.round(12 * (dotsWidth / 384));
            ctx.font = `600 ${fontSizeCodeSub}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(designerState.codeSub.trim(), dotsWidth / 2, currentY, contentWidth);
            currentY += fontSizeCodeSub + Math.round(spacing * 0.6);
        }
    }

    // 6. Pie / Leyenda Legal y Precio
    let footerY = dotsHeight - paddingBottom - Math.round(22 * (dotsWidth / 384));
    footerY = Math.max(currentY + 5, footerY);

    if (designerState.footerText && designerState.footerText.trim()) {
        ctx.fillStyle = '#000000';
        const fontSizeFooter = Math.round(11 * (dotsWidth / 384));
        ctx.font = `normal ${fontSizeFooter}px sans-serif`;
        ctx.textAlign = designerState.price ? 'left' : 'center';
        ctx.textBaseline = 'middle';
        
        const footerX = designerState.price ? paddingX : dotsWidth / 2;
        const maxFooterW = designerState.price ? contentWidth * 0.65 : contentWidth;
        ctx.fillText(designerState.footerText.trim(), footerX, footerY, maxFooterW);
    }

    if (designerState.price && designerState.price.trim()) {
        ctx.fillStyle = '#000000';
        const fontSizePrice = Math.round(18 * (dotsWidth / 384));
        ctx.font = `bold ${fontSizePrice}px sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        const curr = designerState.currency || '$';
        ctx.fillText(`${curr} ${designerState.price.trim()}`, dotsWidth - paddingX, footerY, contentWidth * 0.35);
    }

    return targetCanvas;
}

/**
 * Actualiza la vista previa del diseñador en pantalla
 */
export async function renderDesignerPreview() {
    const previewCanvas = document.getElementById('designer-preview-canvas');
    const dimBadge = document.getElementById('designer-preview-dim-badge');
    if (!previewCanvas) return;

    if (dimBadge) {
        dimBadge.innerText = `${labelConfig.widthMm}x${labelConfig.heightMm} mm`;
    }

    await renderDesignerCanvas(previewCanvas);
}

/**
 * Imprime la etiqueta personalizada directamente por Bluetooth
 */
export async function printDesignerDirectBT() {
    try {
        if (!isBluetoothConnected()) {
            const connected = await connectBluetoothPrinter();
            if (!connected) return;
        }

        const qty = parseInt(document.getElementById('inp-designer-quantity')?.value) || 1;
        
        showToast('Preparando etiqueta personalizada...', 'info');
        const printCanvas = document.createElement('canvas');
        await renderDesignerCanvas(printCanvas, true);

        const singleCommands = canvasToEscPosCommands(printCanvas, labelConfig);
        // Multiplicar comandos para ESC/POS según copias
        const totalBytes = new Uint8Array(singleCommands.length * qty);
        for (let i = 0; i < qty; i++) {
            totalBytes.set(singleCommands, i * singleCommands.length);
        }

        await sendRawToPrinter(totalBytes);
        showToast(`¡${qty} etiqueta(s) personalizada(s) enviada(s) por Bluetooth!`, 'success');
    } catch (e) {
        console.error('Error al imprimir diseño personalizado:', e);
        showToast('Error al imprimir etiqueta personalizada: ' + e.message, 'error');
    }
}

/**
 * Descarga la etiqueta personalizada en formato PNG de alta fidelidad
 */
export async function downloadDesignerLabelImage() {
    showToast('Generando imagen de etiqueta...', 'info');
    try {
        const exportCanvas = document.createElement('canvas');
        await renderDesignerCanvas(exportCanvas, true);

        const link = document.createElement('a');
        const safeName = (designerState.headerText || 'diseno').replace(/[^a-zA-Z0-9_-]/g, '_');
        link.download = `etiqueta-diseno-${safeName}-${Date.now()}.png`;
        link.href = exportCanvas.toDataURL('image/png');
        link.click();
        showToast('¡Imagen PNG descargada con éxito!', 'success');
    } catch (e) {
        console.error('Error descargando imagen:', e);
        showToast('Error al descargar PNG', 'error');
    }
}

/**
 * Imprime mediante el diálogo del sistema (Windows / Navegador)
 */
export async function triggerDesignerPrintSystem() {
    const printArea = document.getElementById('print-area');
    if (!printArea) return;
    printArea.innerHTML = '';

    const qty = parseInt(document.getElementById('inp-designer-quantity')?.value) || 1;
    const printCanvas = document.createElement('canvas');
    await renderDesignerCanvas(printCanvas, true);
    const dataUrl = printCanvas.toDataURL('image/png');

    for (let i = 0; i < qty; i++) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'print-label-item page-break flex items-center justify-center';
        itemDiv.style.width = `${labelConfig.widthMm}mm`;
        itemDiv.style.height = `${labelConfig.heightMm}mm`;
        itemDiv.style.margin = '0 auto';
        itemDiv.innerHTML = `<img src="${dataUrl}" style="width: 100%; height: 100%; object-fit: contain;">`;
        printArea.appendChild(itemDiv);
    }

    setTimeout(() => {
        window.print();
    }, 300);
}

export function adjustDesignerQty(val) {
    const input = document.getElementById('inp-designer-quantity');
    if (!input) return;
    let current = parseInt(input.value) || 1;
    current = Math.max(1, current + val);
    input.value = current;
}
