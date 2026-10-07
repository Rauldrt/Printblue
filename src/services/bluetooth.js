import { showToast } from '../modules/toast.js';

let bluetoothDevice = null;
let bluetoothCharacteristic = null;

// UUIDs habituales para impresoras térmicas BLE y SPP
const PRINTER_SERVICES = [
    '000018f0-0000-1000-8000-00805f9b34fb', // Servicio estándar de impresión
    '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent (Goojprt, MPT)
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Mini thermal BLE
    '0000ff00-0000-1000-8000-00805f9b34fb', // Custom thermal
    '0000af30-0000-1000-8000-00805f9b34fb'
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
        for (const serviceUuid of PRINTER_SERVICES) {
            try {
                const service = await server.getPrimaryService(serviceUuid);
                const characteristics = await service.getCharacteristics();
                for (const char of characteristics) {
                    if (char.properties.write || char.properties.writeWithoutResponse) {
                        bluetoothCharacteristic = char;
                        break;
                    }
                }
                if (bluetoothCharacteristic) break;
            } catch (e) {
                // Siguiente servicio
            }
        }

        const statusText = document.getElementById('bt-status-text');
        if (statusText) {
            statusText.innerText = bluetoothDevice.name ? `BT: ${bluetoothDevice.name.slice(0, 10)}` : 'BT Conectado';
        }

        showToast(`¡Conectado exitosamente a ${bluetoothDevice.name || 'Impresora Térmica'}!`, 'success');
        return true;
    } catch (error) {
        console.error('Error de conexión Bluetooth:', error);
        showToast('No se pudo conectar a la impresora', 'error');
        return false;
    }
}

function onDisconnected() {
    const statusText = document.getElementById('bt-status-text');
    if (statusText) statusText.innerText = 'Conectar BT';
    showToast('Impresora Bluetooth desconectada', 'warning');
    bluetoothCharacteristic = null;
}

export function isBluetoothConnected() {
    return !!(bluetoothDevice && bluetoothDevice.gatt.connected && bluetoothCharacteristic);
}

/**
 * Envia comandos binarios o de texto en paquetes de hasta 512 bytes a la impresora
 */
export async function sendRawToPrinter(data) {
    if (!bluetoothCharacteristic) {
        throw new Error('No hay impresora Bluetooth conectada');
    }

    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const CHUNK_SIZE = 100; // Tamaño seguro para BLE MTU

    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
        const chunk = bytes.slice(i, i + CHUNK_SIZE);
        if (bluetoothCharacteristic.properties.writeWithoutResponse) {
            await bluetoothCharacteristic.writeValueWithoutResponse(chunk);
        } else {
            await bluetoothCharacteristic.writeValue(chunk);
        }
        await new Promise(r => setTimeout(r, 20)); // Pequeño retardo entre bloques
    }
}

/**
 * Generador de comandos nativos TSPL (etiquetas adhesivas con gap de Xprinter, Zebra, etc.)
 */
export function buildTSPLCommands(label, config, copies = 1) {
    const { widthMm, heightMm } = config;
    let tspl = `SIZE ${widthMm} mm, ${heightMm} mm\r\n`;
    tspl += `GAP 2 mm, 0 mm\r\n`;
    tspl += `DIRECTION 1\r\n`;
    tspl += `CLS\r\n`;

    // Título
    if (label.title) {
        tspl += `TEXT 30,30,"3",0,1,1,"${label.title}"\r\n`;
    }

    // Código de barras (Code 128)
    if (label.code) {
        tspl += `BARCODE 30,70,"128",50,1,0,2,4,"${label.code}"\r\n`;
    }

    // Precio y extra
    if (label.price) {
        tspl += `TEXT 30,135,"3",0,1,1,"$ ${label.price}"\r\n`;
    }
    if (label.extra) {
        tspl += `TEXT 200,135,"2",0,1,1,"${label.extra}"\r\n`;
    }

    tspl += `PRINT ${copies},1\r\n`;
    return tspl;
}
