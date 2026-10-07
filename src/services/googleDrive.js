import { getGoogleAccessToken } from './firebase.js';
import { showToast } from '../modules/toast.js';
import { setBatchItems } from '../modules/batchPrinting.js';

/**
 * Busca hojas de cálculo de Google Sheets en el Google Drive del usuario
 */
export async function listGoogleDriveSheets() {
    const token = getGoogleAccessToken();
    if (!token) {
        showToast('Inicia sesión con Google para acceder a tus archivos de Drive', 'warning');
        return [];
    }

    try {
        const query = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
        const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)&pageSize=20`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (!res.ok) {
            throw new Error(`Error de Drive API: ${res.statusText}`);
        }

        const data = await res.json();
        return data.files || [];
    } catch (error) {
        console.error('Error listando archivos de Drive:', error);
        showToast('No se pudieron obtener las hojas de cálculo de Drive', 'error');
        return [];
    }
}

/**
 * Lee los datos de una hoja de cálculo y los mapea a productos para impresión por lote
 */
export async function loadSpreadsheetData(spreadsheetId) {
    const token = getGoogleAccessToken();
    if (!token) return [];

    try {
        showToast('Cargando datos de la hoja...', 'info');
        const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:Z500`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (!res.ok) {
            throw new Error(`Error de Sheets API: ${res.statusText}`);
        }

        const data = await res.json();
        const rows = data.values || [];
        if (rows.length < 2) {
            showToast('La hoja de cálculo está vacía o solo contiene encabezados', 'warning');
            return [];
        }

        // Analizar encabezados
        const headers = rows[0].map(h => String(h).trim().toLowerCase());
        
        let titleIdx = headers.findIndex(h => h.includes('nombre') || h.includes('producto') || h.includes('titulo') || h.includes('descripcion'));
        let codeIdx = headers.findIndex(h => h.includes('codigo') || h.includes('sku') || h.includes('ean') || h.includes('barcode') || h.includes('id'));
        let priceIdx = headers.findIndex(h => h.includes('precio') || h.includes('price') || h.includes('costo') || h.includes('valor'));
        let qtyIdx = headers.findIndex(h => h.includes('cant') || h.includes('qty') || h.includes('stock') || h.includes('copias'));

        // Fallbacks por orden si no coincide por nombre
        if (titleIdx === -1) titleIdx = 0;
        if (codeIdx === -1) codeIdx = 1;
        if (priceIdx === -1) priceIdx = 2;

        const importedItems = [];
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0 || !row[titleIdx]) continue;

            importedItems.push({
                id: Date.now() + i,
                title: String(row[titleIdx] || 'Producto'),
                code: String(row[codeIdx] || ('100' + i)),
                price: String(row[priceIdx] || '0').replace('$', '').trim(),
                qty: qtyIdx !== -1 && row[qtyIdx] ? parseInt(row[qtyIdx]) || 1 : 1
            });
        }

        setBatchItems(importedItems);
        showToast(`¡Se importaron ${importedItems.length} productos desde Google Sheets!`, 'success');
        return importedItems;

    } catch (error) {
        console.error('Error leyendo hoja de cálculo:', error);
        showToast('Error al leer datos de Google Sheets', 'error');
        return [];
    }
}
