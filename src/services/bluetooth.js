import { showToast } from '../modules/toast.js';
import { labelConfig } from '../modules/paperSettings.js';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

let bluetoothDevice = null;
let bluetoothCharacteristic = null;
let serialPort = null;

// UUIDs de servicios para impresoras térmicas BLE y módulos UART
const PRINTER_SERVICES = [
    // 1. JDY-33 / HM-10 / CC2540 (Go Link GL-33, MPT-II, POS-58 - ¡Módulo de GL-33!)
    '0000ffe0-0000-1000-8000-00805f9b34fb',
    '0000ffe1-0000-1000-8000-00805f9b34fb',
    '0000fff0-0000-1000-8000-00805f9b34fb',
    '0000fff1-0000-1000-8000-00805f9b34fb',
    '0000fff2-0000-1000-8000-00805f9b34fb',
    '0000ff00-0000-1000-8000-00805f9b34fb',
    '0000ff02-0000-1000-8000-00805f9b34fb',

    // 2. ISSC Transparent UART (Goojprt, MPT, Zjiang, Go Link alternativo)
    '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2',

    // 3. Xprinter, Milestone, Netum, Zhuhai (AE30, AE00, AF30)
    '0000ae30-0000-1000-8000-00805f9b34fb',
    '0000ae00-0000-1000-8000-00805f9b34fb',
    '0000af30-0000-1000-8000-00805f9b34fb',

    // 4. Nordic Semiconductor UART (NUS)
    '6e400001-b5a3-f393-e0a9-e50e24dcca9e',

    // 5. Servicio estándar de impresión Bluetooth
    '000018f0-0000-1000-8000-00805f9b34fb',

    // 6. Otros perfiles BLE comunes en impresoras portátiles
    '0000fee7-0000-1000-8000-00805f9b34fb',
    '0000fe59-0000-1000-8000-00805f9b34fb',
    '0000e0ff-0000-1000-8000-00805f9b34fb',
    '0000fef0-0000-1000-8000-00805f9b34fb',
    'd973f2e0-b19e-11e2-9e96-0800200c9a66'
];

/**
 * Conecta a la impresora mediante Web Bluetooth API
 */
export async function connectBluetoothPrinter() {
    if (!navigator.bluetooth) {
        showToast('Web Bluetooth no está disponible en este navegador. Usa Chrome o Edge.', 'error');
        return false;
    }

    try {
        showToast('Buscando impresoras Bluetooth...', 'info');
        
        bluetoothDevice = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: PRINTER_SERVICES
        });

        bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);

        showToast(`Conectando con ${bluetoothDevice.name || 'Dispositivo'}...`, 'info');
        const server = await bluetoothDevice.gatt.connect();

        // Buscar servicio y característica con soporte de escritura
        bluetoothCharacteristic = null;

        // Estrategia 1: Inspeccionar todos los servicios primarios expuestos por el dispositivo
        try {
            const services = await server.getPrimaryServices();
            for (const service of services) {
                try {
                    const characteristics = await service.getCharacteristics();
                    for (const char of characteristics) {
                        if (char.properties.write || char.properties.writeWithoutResponse) {
                            bluetoothCharacteristic = char;
                            console.log('Canal de escritura BLE encontrado:', service.uuid, char.uuid);
                            break;
                        }
                    }
                    if (bluetoothCharacteristic) break;
                } catch (err) {
                    // Ignorar si no permite leer características
                }
            }
        } catch (e) {
            console.warn('Exploración global de servicios omitida, probando lista de UUIDs directos...', e);
        }

        // Estrategia 2: Si no se encontró en la lista general, consultar servicio por servicio
        if (!bluetoothCharacteristic) {
            for (const serviceUuid of PRINTER_SERVICES) {
                try {
                    const service = await server.getPrimaryService(serviceUuid);
                    const characteristics = await service.getCharacteristics();
                    for (const char of characteristics) {
                        if (char.properties.write || char.properties.writeWithoutResponse) {
                            bluetoothCharacteristic = char;
                            console.log('Canal de escritura BLE encontrado por UUID directo:', serviceUuid, char.uuid);
                            break;
                        }
                    }
                    if (bluetoothCharacteristic) break;
                } catch (e) {
                    // Siguiente servicio
                }
            }
        }

        if (!bluetoothCharacteristic) {
            showToast('Conectado pero no se encontró canal de escritura. Prueba también conectar por USB/COM.', 'warning');
        } else {
            showToast(`¡Conectado exitosamente a ${bluetoothDevice.name || 'Impresora Térmica'}!`, 'success');
        }

        updateBluetoothUI();
        return !!bluetoothCharacteristic;
    } catch (error) {
        console.error('Error de conexión Bluetooth:', error);
        showToast('No se pudo conectar a la impresora', 'error');
        updateBluetoothUI();
        return false;
    }
}

/**
 * Conecta a la impresora mediante Web Serial API (ideal para Windows PC con cable USB o Bluetooth SPP/COM)
 */
export async function connectSerialPrinter() {
    if (!navigator.serial) {
        showToast('Web Serial no está disponible en este navegador. Usa Chrome o Edge en PC.', 'error');
        return false;
    }

    try {
        showToast('Selecciona el puerto de la impresora (USB o Bluetooth COM)...', 'info');
        serialPort = await navigator.serial.requestPort();
        await serialPort.open({ baudRate: 9600 });

        showToast('¡Conectado exitosamente por Puerto Serie / USB / Bluetooth COM!', 'success');
        updateBluetoothUI();
        return true;
    } catch (error) {
        if (error.name !== 'NotFoundError') {
            console.error('Error al conectar puerto serie:', error);
            showToast('No se pudo abrir el puerto serie', 'error');
        }
        updateBluetoothUI();
        return false;
    }
}

function onDisconnected() {
    showToast('Impresora desconectada', 'warning');
    bluetoothCharacteristic = null;
    updateBluetoothUI();
}

export function isBluetoothConnected() {
    const isBle = !!(bluetoothDevice && bluetoothDevice.gatt && bluetoothDevice.gatt.connected && bluetoothCharacteristic);
    const isSerial = !!(serialPort && serialPort.writable);
    return isBle || isSerial;
}

export function updateBluetoothUI() {
    const isConn = isBluetoothConnected();
    const isSerial = !!(serialPort && serialPort.writable);
    const statusText = document.getElementById('bt-status-text');
    const connectBtn = document.getElementById('bt-connect-btn');
    const directBtnSingle = document.getElementById('btn-print-direct-bt');
    const directBtnBatch = document.getElementById('btn-print-batch-bt');

    let devName = 'Impresora';
    if (isSerial) {
        devName = 'Puerto COM / USB';
    } else if (bluetoothDevice?.name) {
        devName = bluetoothDevice.name;
    }

    if (statusText) {
        if (isConn) {
            statusText.innerText = isSerial ? 'COM: Conectado' : `BT: ${devName.slice(0, 10)}`;
        } else {
            statusText.innerText = 'Conectar BT / PC';
        }
    }

    if (connectBtn) {
        if (isConn) {
            connectBtn.className = 'flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500 text-xs sm:text-sm px-3 py-2 rounded-lg transition shadow-sm font-semibold';
        } else {
            connectBtn.className = 'flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs sm:text-sm px-3 py-2 rounded-lg transition shadow-sm';
        }
    }

    // Mantener visibles los botones directos de impresión
    if (directBtnSingle) {
        directBtnSingle.classList.remove('hidden');
        directBtnSingle.classList.add('flex');
        const textSpan = directBtnSingle.querySelector('span');
        if (textSpan) {
            textSpan.innerText = isConn 
                ? `Imprimir Directo (${devName})` 
                : 'Imprimir Directo por Bluetooth (Sin ventanas)';
        }
    }

    if (directBtnBatch) {
        directBtnBatch.classList.remove('hidden');
        directBtnBatch.classList.add('flex');
        const textSpan = directBtnBatch.querySelector('span');
        if (textSpan) {
            textSpan.innerText = isConn 
                ? `Imprimir por Bluetooth / Directo (${devName})` 
                : 'Imprimir Todo por Bluetooth';
        }
    }
}

/**
 * Envia paquetes binarios a la impresora (por BLE o Web Serial)
 */
export async function sendRawToPrinter(data) {
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);

    // 1. Envío por Web Serial (USB o Bluetooth COM en Windows)
    if (serialPort && serialPort.writable) {
        const writer = serialPort.writable.getWriter();
        try {
            await writer.write(bytes);
        } finally {
            writer.releaseLock();
        }
        return;
    }

    // 2. Envío por Web Bluetooth BLE
    if (!bluetoothCharacteristic) {
        throw new Error('No hay impresora Bluetooth ni Puerto Serie conectado');
    }

    const CHUNK_SIZE = 100;
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
        const chunk = bytes.slice(i, i + CHUNK_SIZE);
        if (bluetoothCharacteristic.properties.writeWithoutResponse) {
            await bluetoothCharacteristic.writeValueWithoutResponse(chunk);
        } else {
            await bluetoothCharacteristic.writeValue(chunk);
        }
        await new Promise(r => setTimeout(r, 25)); // Pausa para no saturar buffer
    }
}

/**
 * Renderiza la etiqueta completa en un Canvas a 203 DPI (8 dots/mm) para rasterizarla
 */
export async function renderLabelToMonochromeCanvas(item, config) {
    // 8 dots por mm (203 DPI estándar térmico)
    const dotsWidth = Math.round(config.widthMm * 8);
    const dotsHeight = Math.round(config.heightMm * 8);

    const canvas = document.createElement('canvas');
    canvas.width = dotsWidth;
    canvas.height = dotsHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Fondo blanco
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, dotsWidth, dotsHeight);
    ctx.fillStyle = '#000000';

    const paddingTopDots = Math.round((config.paddingTopMm ?? config.paddingMm ?? 2.0) * 8);
    const paddingBottomDots = Math.round((config.paddingBottomMm ?? config.paddingMm ?? 2.0) * 8);
    const paddingSidesDots = Math.round((config.paddingMm ?? 2.0) * 8);
    const contentWidth = dotsWidth - (paddingSidesDots * 2);

    const spacingTitleDots = Math.round((config.spacingTitle ?? 2.0) * 8);
    const spacingFooterDots = Math.round((config.spacingFooter ?? 2.0) * 8);
    const vAlign = config.verticalAlign || 'center';

    // Estimación de alturas para distribución vertical
    const titleFontSize = Math.round(config.fontSizePt * 2.8);
    const titleHeight = item.title ? (titleFontSize + 4) : 0;
    const titleSpacing = item.title ? spacingTitleDots : 0;

    const barcodeAreaHeight = Math.round(dotsHeight * (config.barcodeHeight / 100));
    const barcodeSpacing = (item.extra || item.price || item.code) ? spacingFooterDots : 0;

    const footerFontSize = Math.round(config.fontSizePt * 2.6);
    const hasFooter = !!(item.extra || item.price || item.code);
    const footerHeight = hasFooter ? (footerFontSize + 4) : 0;

    const totalContentHeight = titleHeight + titleSpacing + barcodeAreaHeight + barcodeSpacing + footerHeight;

    const availableSpace = dotsHeight - paddingTopDots - paddingBottomDots;
    let currentY = paddingTopDots;
    if (vAlign === 'center') {
        if (availableSpace > totalContentHeight) {
            currentY = paddingTopDots + Math.round((availableSpace - totalContentHeight) / 2);
        }
    } else if (vAlign === 'flex-start') {
        currentY = paddingTopDots;
    }

    // 1. Título
    if (item.title) {
        ctx.font = `bold ${titleFontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(item.title.toUpperCase(), dotsWidth / 2, currentY, contentWidth);
        currentY += titleHeight + spacingTitleDots;
    }

    // 2. Código de barras o QR
    const barcodeCanvas = document.createElement('canvas');

    if (item.symbology === 'QR') {
        const qrSize = Math.min(contentWidth * 0.7, barcodeAreaHeight);
        await QRCode.toCanvas(barcodeCanvas, item.code || '12345678', {
            width: qrSize,
            margin: 0
        });
        const qrX = Math.round((dotsWidth - qrSize) / 2);
        ctx.drawImage(barcodeCanvas, qrX, currentY, qrSize, qrSize);
        currentY += qrSize + spacingFooterDots;
    } else {
        const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        try {
            JsBarcode(tempSvg, item.code || '12345678', {
                format: item.symbology || 'CODE128',
                width: config.barcodeWidth * 1.5,
                height: barcodeAreaHeight,
                displayValue: true,
                fontSize: Math.round(config.fontSizePt * 2.2),
                margin: 0
            });

            const svgXml = new XMLSerializer().serializeToString(tempSvg);
            const img = new Image();
            await new Promise((resolve) => {
                img.onload = () => {
                    const drawWidth = Math.min(contentWidth, img.width);
                    const drawX = Math.round((dotsWidth - drawWidth) / 2);
                    ctx.drawImage(img, drawX, currentY, drawWidth, barcodeAreaHeight);
                    resolve();
                };
                img.onerror = resolve;
                img.src = 'data:image/svg+xml;base64,' + btoa(svgXml);
            });
            currentY += barcodeAreaHeight + spacingFooterDots;
        } catch(e) {
            console.error('Error dibujando código en canvas térmico:', e);
            currentY += barcodeAreaHeight + spacingFooterDots;
        }
    }

    // 3. Footer: Extra a la izquierda y Precio a la derecha
    let footerY = currentY;
    if (vAlign === 'space-between') {
        footerY = dotsHeight - paddingBottomDots - footerFontSize;
    }
    // Asegurar que no rebase el margen del papel
    footerY = Math.min(footerY, dotsHeight - paddingBottomDots - footerFontSize);

    ctx.font = `bold ${footerFontSize}px sans-serif`;
    ctx.textBaseline = 'top';

    if (item.extra) {
        ctx.textAlign = 'left';
        ctx.fillText(item.extra, paddingSidesDots, footerY, contentWidth * 0.6);
    } else if (item.code) {
        ctx.textAlign = 'left';
        ctx.fillText(`SKU: ${item.code}`, paddingSidesDots, footerY, contentWidth * 0.6);
    }

    if (item.price) {
        ctx.textAlign = 'right';
        ctx.font = `bold ${Math.round(footerFontSize * 1.2)}px sans-serif`;
        const priceStr = String(item.price).trim();
        const formattedPrice = /^[^\d]/.test(priceStr) ? priceStr : `$ ${priceStr}`;
        ctx.fillText(formattedPrice, dotsWidth - paddingSidesDots, footerY, contentWidth * 0.4);
    }

    return canvas;
}

/**
 * Convierte un Canvas a comandos ESC/POS Raster (GS v 0) con control de paso y anti-desplazamiento
 */
export function canvasToEscPosCommands(canvas, config = labelConfig) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.getImageData(0, 0, width, height).data;

    // El ancho en bytes debe ser múltiplo de 8
    const widthBytes = Math.ceil(width / 8);
    const rasterBytes = new Uint8Array(widthBytes * height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            // Luminancia: R*0.299 + G*0.587 + B*0.114
            const r = imgData[idx];
            const g = imgData[idx + 1];
            const b = imgData[idx + 2];
            const a = imgData[idx + 3];

            // Si es transparente o blanco, es blanco (0); si es oscuro, es punto impreso (1)
            const isBlack = a > 50 && (0.299 * r + 0.587 * g + 0.114 * b) < 180;

            if (isBlack) {
                const byteIndex = y * widthBytes + Math.floor(x / 8);
                const bitIndex = 7 - (x % 8);
                rasterBytes[byteIndex] |= (1 << bitIndex);
            }
        }
    }

    // Cabecera ESC/POS: Inicializar (ESC @) + Raster Bitmap (GS v 0 0 xL xH yL yH)
    const xL = widthBytes & 0xFF;
    const xH = (widthBytes >> 8) & 0xFF;
    const yL = height & 0xFF;
    const yH = (height >> 8) & 0xFF;

    const header = new Uint8Array([
        0x1B, 0x40,             // ESC @: Inicializar impresora
        0x1D, 0x76, 0x30, 0x00, // GS v 0 0: Imprimir gráfico raster normal
        xL, xH, yL, yH
    ]);

    // Pie de comandos dinámico para control de paso y anti-desplazamiento
    const feedMode = config.feedMode || 'exact';
    const footerBytes = [];

    if (feedMode === 'sensor') {
        // Modo sensor óptico: alimentar hasta la siguiente ranura/marca (GS FF)
        footerBytes.push(0x1D, 0x0C);
    } else if (feedMode === 'receipt') {
        // Modo recibo continuo: 3 saltos de línea para expulsar sobre la barra de corte
        footerBytes.push(0x0A, 0x0A, 0x0A, 0x1D, 0x56, 0x01);
    } else {
        // Modo 'exact' (Paso Milimétrico Exacto para Go Link GL033 y portátiles 58mm):
        // La etiqueta ya avanzó exactamente 'height' dots (heightMm * 8).
        // Avanzamos ÚNICAMENTE la separación física entre etiquetas (Gap) + micro-ajuste (Offset).
        // Sin saltos de línea ciegos de ticket ni comandos de corte innecesarios.
        const gapMm = Math.max(0, (config.gapMm ?? 2.0) + (config.feedOffsetMm ?? 0.0));
        let remainingDots = Math.round(gapMm * 8);
        while (remainingDots > 0) {
            const chunk = Math.min(255, remainingDots);
            footerBytes.push(0x1B, 0x4A, chunk); // ESC J n: alimentar exactamente n dots (8 dots = 1 mm)
            remainingDots -= chunk;
        }
    }

    const footer = new Uint8Array(footerBytes);

    // Combinar en un único buffer Uint8Array
    const fullCommand = new Uint8Array(header.length + rasterBytes.length + footer.length);
    fullCommand.set(header, 0);
    fullCommand.set(rasterBytes, header.length);
    fullCommand.set(footer, header.length + rasterBytes.length);

    return fullCommand;
}

/**
 * Avanza exactamente 1 etiqueta para calibrar o alinear un nuevo rollo
 */
export async function feedOneLabelBluetooth() {
    if (!isBluetoothConnected()) {
        const connected = await connectBluetoothPrinter();
        if (!connected) return;
    }

    const devName = bluetoothDevice?.name || 'Impresora';
    showToast(`Avanzando 1 etiqueta en ${devName}...`, 'info');

    try {
        const feedMode = labelConfig.feedMode || 'exact';
        if (feedMode === 'sensor') {
            await sendRawToPrinter(new Uint8Array([0x1D, 0x0C]));
        } else {
            const totalMm = Math.max(0, (labelConfig.heightMm || 44) + (labelConfig.gapMm ?? 2.0) + (labelConfig.feedOffsetMm ?? 0.0));
            let remainingDots = Math.round(totalMm * 8);
            const feedBytes = [];
            while (remainingDots > 0) {
                const chunk = Math.min(255, remainingDots);
                feedBytes.push(0x1B, 0x4A, chunk);
                remainingDots -= chunk;
            }
            if (feedBytes.length > 0) {
                await sendRawToPrinter(new Uint8Array(feedBytes));
            }
        }
        showToast('Avance de 1 etiqueta completado', 'success');
    } catch (e) {
        console.error('Error al avanzar etiqueta:', e);
        showToast('Error al transmitir avance a la impresora', 'error');
    }
}

/**
 * Generador nativo TSPL (para impresoras en modo etiquetas con calibración de gap)
 */
export function buildTSPLCommands(item, config, copies = 1) {
    const { widthMm, heightMm } = config;
    const gapMm = config.gapMm ?? 2.0;
    let tspl = `SIZE ${widthMm} mm, ${heightMm} mm\r\n`;
    tspl += `GAP ${gapMm} mm, 0 mm\r\n`;
    tspl += `DIRECTION 1\r\n`;
    tspl += `CLS\r\n`;

    const spacingTitleDots = Math.round((config.spacingTitle ?? 2.0) * 8);
    const spacingFooterDots = Math.round((config.spacingFooter ?? 2.0) * 8);

    let y = Math.max(10, Math.round((config.paddingTopMm ?? config.paddingMm ?? 2.0) * 8));
    if (item.title) {
        tspl += `TEXT 20,${y},"3",0,1,1,"${item.title.slice(0, 30)}"\r\n`;
        y += 40 + spacingTitleDots;
    } else {
        y += spacingTitleDots;
    }

    const barcodeHeightDots = Math.round(config.heightMm * 8 * (config.barcodeHeight / 100));
    if (item.code) {
        if (item.symbology === 'QR') {
            tspl += `QRCODE 40,${y},L,5,A,0,"${item.code}"\r\n`;
            y += 110 + spacingFooterDots;
        } else {
            tspl += `BARCODE 20,${y},"128",${Math.min(90, barcodeHeightDots)},1,0,2,4,"${item.code}"\r\n`;
            y += Math.min(90, barcodeHeightDots) + 30 + spacingFooterDots;
        }
    }

    if (item.extra || item.code) {
        const text = item.extra || `SKU: ${item.code}`;
        tspl += `TEXT 20,${y},"2",0,1,1,"${text.slice(0, 24)}"\r\n`;
    }

    if (item.price) {
        tspl += `TEXT 250,${y},"3",0,1,1,"$ ${item.price}"\r\n`;
    }

    tspl += `PRINT ${copies},1\r\n`;
    return tspl;
}

/**
 * Imprime una etiqueta individual por Bluetooth directo (sin diálogo del sistema)
 */
export async function printSingleLabelBluetooth(item, copies = 1) {
    if (!isBluetoothConnected()) {
        const connected = await connectBluetoothPrinter();
        if (!connected) return;
    }

    const devName = bluetoothDevice?.name || 'Impresora';
    showToast(`Enviando a ${devName} por Bluetooth...`, 'info');

    try {
        const protocol = localStorage.getItem('bt_protocol') || 'escpos';

        for (let i = 0; i < copies; i++) {
            if (protocol === 'tspl') {
                const tsplCode = buildTSPLCommands(item, labelConfig, 1);
                await sendRawToPrinter(tsplCode);
            } else {
                // Modo ESC/POS gráfico (máxima fidelidad)
                const canvas = await renderLabelToMonochromeCanvas(item, labelConfig);
                const escposBytes = canvasToEscPosCommands(canvas);
                await sendRawToPrinter(escposBytes);
            }
            if (copies > 1) await new Promise(r => setTimeout(r, 150));
        }

        showToast(`¡Etiqueta impresa correctamente en ${devName}!`, 'success');
    } catch (e) {
        console.error('Error al imprimir por Bluetooth:', e);
        showToast('Error al transmitir a la impresora Bluetooth', 'error');
    }
}

/**
 * Imprime una lista de productos en lote por Bluetooth directo
 */
export async function printBatchBluetooth(items) {
    if (!isBluetoothConnected()) {
        const connected = await connectBluetoothPrinter();
        if (!connected) return;
    }

    if (!items || items.length === 0) {
        showToast('No hay productos para imprimir', 'warning');
        return;
    }

    const devName = bluetoothDevice?.name || 'Impresora';
    showToast(`Iniciando lote (${items.length} productos) en ${devName}...`, 'info');

    try {
        const protocol = localStorage.getItem('bt_protocol') || 'escpos';

        for (const item of items) {
            const copies = parseInt(item.qty) || 1;
            for (let c = 0; c < copies; c++) {
                if (protocol === 'tspl') {
                    const tsplCode = buildTSPLCommands(item, labelConfig, 1);
                    await sendRawToPrinter(tsplCode);
                } else {
                    const canvas = await renderLabelToMonochromeCanvas(item, labelConfig);
                    const escposBytes = canvasToEscPosCommands(canvas);
                    await sendRawToPrinter(escposBytes);
                }
                await new Promise(r => setTimeout(r, 200)); // Pausa entre etiquetas
            }
        }

        showToast(`¡Lote completado con éxito en ${devName}!`, 'success');
    } catch (e) {
        console.error('Error en impresión por lote Bluetooth:', e);
        showToast('Error en la transmisión Bluetooth del lote', 'error');
    }
}
