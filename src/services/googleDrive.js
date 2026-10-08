import { getGoogleAccessToken } from './firebase.js';
import { showToast } from '../modules/toast.js';
import { setBatchItems } from '../modules/batchPrinting.js';

// Estado global de la hoja activa
let activeSpreadsheet = {
    id: null,
    name: '',
    tabs: [],
    selectedTab: '',
    headers: [],
    dataRows: []
};

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
        const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)&pageSize=30`, {
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
 * Carga pestañas y filas de la hoja de cálculo seleccionada
 */
export async function loadSpreadsheetMetadata(spreadsheetId, spreadsheetName, targetTab = null) {
    const token = getGoogleAccessToken();
    if (!token) return false;

    try {
        showToast('Analizando estructura de la hoja de cálculo...', 'info');

        // 1. Obtener lista de pestañas / hojas
        const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(title,sheetId))`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!metaRes.ok) throw new Error('Error al obtener estructura de la hoja');
        const metaData = await metaRes.json();
        const tabs = (metaData.sheets || []).map(s => s.properties.title);

        const activeTabName = targetTab && tabs.includes(targetTab) ? targetTab : (tabs[0] || 'Hoja 1');

        // 2. Obtener datos de la pestaña activa
        const range = `${encodeURIComponent(activeTabName)}!A1:Z500`;
        const dataRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!dataRes.ok) throw new Error('Error al leer celdas de la hoja');
        const dataJson = await dataRes.json();
        const rawRows = dataJson.values || [];

        if (rawRows.length < 2) {
            showToast('La pestaña seleccionada está vacía o no tiene filas de datos', 'warning');
            return false;
        }

        const headers = rawRows[0].map(h => String(h || '').trim());
        const dataRows = rawRows.slice(1);

        activeSpreadsheet = {
            id: spreadsheetId,
            name: spreadsheetName,
            tabs,
            selectedTab: activeTabName,
            headers,
            dataRows
        };

        openMappingModalUI();
        return true;

    } catch (error) {
        console.error('Error al cargar hoja:', error);
        showToast('No se pudo acceder a los datos de la hoja de cálculo', 'error');
        return false;
    }
}

/**
 * Abre y llena el modal interactivo de mapeo de columnas
 */
function openMappingModalUI() {
    const modal = document.getElementById('mapping-modal');
    if (!modal) return;

    document.getElementById('map-sheet-name').innerText = activeSpreadsheet.name;
    
    // Selector de pestañas
    const tabSelect = document.getElementById('map-tab-select');
    tabSelect.innerHTML = activeSpreadsheet.tabs.map(t => 
        `<option value="${t}" ${t === activeSpreadsheet.selectedTab ? 'selected' : ''}>${t}</option>`
    ).join('');

    // Heurísticas de autodetección de columnas
    const detected = detectColumns(activeSpreadsheet.headers);

    // Recuperar mapeo guardado previamente para esta hoja si existe
    const savedMapping = getSavedMapping(activeSpreadsheet.id) || detected;

    // Llenar selectores de columnas
    populateSelect('map-col-title', activeSpreadsheet.headers, savedMapping.title, false);
    populateSelect('map-col-code', activeSpreadsheet.headers, savedMapping.code, false);
    populateSelect('map-col-price', activeSpreadsheet.headers, savedMapping.price, true);
    populateSelect('map-col-extra', activeSpreadsheet.headers, savedMapping.extra, true);
    populateQtySelect('map-col-qty', activeSpreadsheet.headers, savedMapping.qty);

    modal.classList.remove('hidden');
    updateMappingPreview();
}

/**
 * Heurística inteligente para detectar columnas según su nombre
 */
function detectColumns(headers) {
    const cleanHeaders = headers.map(h => h.toLowerCase());

    const findIndex = (keywords) => {
        return cleanHeaders.findIndex(h => keywords.some(k => h.includes(k)));
    };

    let titleIdx = findIndex(['nombre', 'producto', 'articulo', 'descripcion', 'titulo', 'item']);
    let codeIdx = findIndex(['codigo', 'sku', 'ean', 'upc', 'barcode', 'cod', 'id']);
    let priceIdx = findIndex(['precio', 'price', 'pvp', 'costo', 'valor', 'venta']);
    let extraIdx = findIndex(['lote', 'venc', 'talle', 'color', 'marca', 'categoria', 'detalle']);
    let qtyIdx = findIndex(['cant', 'qty', 'stock', 'copias']);

    if (titleIdx === -1) titleIdx = 0;
    if (codeIdx === -1) codeIdx = headers.length > 1 ? 1 : 0;

    return {
        title: titleIdx,
        code: codeIdx,
        price: priceIdx !== -1 ? priceIdx : -1,
        extra: extraIdx !== -1 ? extraIdx : -1,
        qty: qtyIdx !== -1 ? String(qtyIdx) : 'fixed-1'
    };
}

function populateSelect(selectId, headers, selectedIndex, allowNone = false) {
    const select = document.getElementById(selectId);
    if (!select) return;

    let html = '';
    if (allowNone) {
        html += `<option value="-1" ${selectedIndex === -1 ? 'selected' : ''}>-- No incluir --</option>`;
    }

    headers.forEach((h, idx) => {
        const colLetter = String.fromCharCode(65 + (idx % 26));
        html += `<option value="${idx}" ${idx === selectedIndex ? 'selected' : ''}>Col ${colLetter}: ${h || `(Sin título)`}</option>`;
    });

    select.innerHTML = html;
}

function populateQtySelect(selectId, headers, selectedVal) {
    const select = document.getElementById(selectId);
    if (!select) return;

    let html = `
        <option value="fixed-1" ${selectedVal === 'fixed-1' ? 'selected' : ''}>1 copia fija por fila</option>
        <option value="fixed-2" ${selectedVal === 'fixed-2' ? 'selected' : ''}>2 copias fijas por fila</option>
    `;

    headers.forEach((h, idx) => {
        const colLetter = String.fromCharCode(65 + (idx % 26));
        html += `<option value="${idx}" ${String(idx) === String(selectedVal) ? 'selected' : ''}>Col ${colLetter}: ${h} (Usar número de fila)</option>`;
    });

    select.innerHTML = html;
}

/**
 * Actualiza la vista previa en vivo en el modal
 */
export function updateMappingPreview() {
    const titleIdx = parseInt(document.getElementById('map-col-title')?.value) ?? 0;
    const codeIdx = parseInt(document.getElementById('map-col-code')?.value) ?? 1;
    const priceIdx = parseInt(document.getElementById('map-col-price')?.value) ?? -1;
    const extraIdx = parseInt(document.getElementById('map-col-extra')?.value) ?? -1;
    const qtyVal = document.getElementById('map-col-qty')?.value || 'fixed-1';

    const previewContainer = document.getElementById('mapping-preview-table');
    const totalCountBadge = document.getElementById('mapping-total-count');
    if (!previewContainer) return;

    const sampleRows = activeSpreadsheet.dataRows.slice(0, 3);
    const validCount = activeSpreadsheet.dataRows.filter(r => r[titleIdx] || r[codeIdx]).length;

    if (totalCountBadge) {
        totalCountBadge.innerText = `${validCount} productos a importar`;
    }

    if (sampleRows.length === 0) {
        previewContainer.innerHTML = `<div class="p-3 text-xs text-slate-400">Sin datos para previsualizar</div>`;
        return;
    }

    previewContainer.innerHTML = `
        <div class="overflow-x-auto border border-slate-200 rounded-lg">
            <table class="w-full text-left text-[11px] text-slate-600">
                <thead class="bg-slate-100 text-slate-700 font-bold border-b">
                    <tr>
                        <th class="p-2">Título</th>
                        <th class="p-2">Código</th>
                        <th class="p-2">Precio</th>
                        <th class="p-2">Extra / Lote</th>
                        <th class="p-2 text-center">Cant.</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 bg-white">
                    ${sampleRows.map(row => {
                        let qty = 1;
                        if (qtyVal === 'fixed-2') qty = 2;
                        else if (qtyVal !== 'fixed-1') {
                            const parsed = parseInt(row[parseInt(qtyVal)]);
                            qty = isNaN(parsed) || parsed < 1 ? 1 : parsed;
                        }

                        const title = row[titleIdx] || '<span class="text-slate-300">Vacío</span>';
                        const code = row[codeIdx] || '<span class="text-slate-300">Vacío</span>';
                        const price = priceIdx !== -1 && row[priceIdx] ? `$ ${String(row[priceIdx]).replace('$', '').trim()}` : '-';
                        const extra = extraIdx !== -1 && row[extraIdx] ? String(row[extraIdx]) : '-';

                        return `
                            <tr>
                                <td class="p-2 font-medium text-slate-900">${title}</td>
                                <td class="p-2 font-mono text-indigo-600">${code}</td>
                                <td class="p-2 font-semibold text-emerald-600">${price}</td>
                                <td class="p-2 text-slate-500">${extra}</td>
                                <td class="p-2 text-center font-bold">${qty}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

/**
 * Aplica el mapeo configurado e inserta los productos en el lote
 */
export function applyMappingAndImport() {
    const titleIdx = parseInt(document.getElementById('map-col-title')?.value) ?? 0;
    const codeIdx = parseInt(document.getElementById('map-col-code')?.value) ?? 1;
    const priceIdx = parseInt(document.getElementById('map-col-price')?.value) ?? -1;
    const extraIdx = parseInt(document.getElementById('map-col-extra')?.value) ?? -1;
    const qtyVal = document.getElementById('map-col-qty')?.value || 'fixed-1';

    // Guardar preferencia para esta hoja
    const mappingConfig = { title: titleIdx, code: codeIdx, price: priceIdx, extra: extraIdx, qty: qtyVal };
    saveMapping(activeSpreadsheet.id, mappingConfig);

    const importedItems = [];
    activeSpreadsheet.dataRows.forEach((row, index) => {
        const title = row[titleIdx] ? String(row[titleIdx]).trim() : '';
        const code = row[codeIdx] ? String(row[codeIdx]).trim() : '';

        // Ignorar filas completamente vacías
        if (!title && !code) return;

        let qty = 1;
        if (qtyVal === 'fixed-2') qty = 2;
        else if (qtyVal !== 'fixed-1') {
            const parsed = parseInt(row[parseInt(qtyVal)]);
            qty = isNaN(parsed) || parsed < 1 ? 1 : parsed;
        }

        let price = '';
        if (priceIdx !== -1 && row[priceIdx]) {
            price = String(row[priceIdx]).replace('$', '').trim();
        }

        let extra = '';
        if (extraIdx !== -1 && row[extraIdx]) {
            extra = String(row[extraIdx]).trim();
        }

        importedItems.push({
            id: Date.now() + index,
            title: title || 'Sin Nombre',
            code: code || ('100' + (index + 1)),
            price: price,
            extra: extra,
            qty: qty
        });
    });

    if (importedItems.length === 0) {
        showToast('No se encontraron filas válidas con los criterios seleccionados', 'warning');
        return;
    }

    setBatchItems(importedItems);
    closeMappingModal();
    window.switchTab('batch');
    showToast(`¡Se importaron con éxito ${importedItems.length} productos de Google Sheets!`, 'success');
}

export function switchSpreadsheetTab(newTabName) {
    if (activeSpreadsheet.id && newTabName !== activeSpreadsheet.selectedTab) {
        loadSpreadsheetMetadata(activeSpreadsheet.id, activeSpreadsheet.name, newTabName);
    }
}

export function closeMappingModal() {
    document.getElementById('mapping-modal')?.classList.add('hidden');
}

function saveMapping(sheetId, mapping) {
    if (!sheetId) return;
    try {
        localStorage.setItem(`sheet_mapping_${sheetId}`, JSON.stringify(mapping));
    } catch(e){}
}

function getSavedMapping(sheetId) {
    if (!sheetId) return null;
    try {
        const saved = localStorage.getItem(`sheet_mapping_${sheetId}`);
        return saved ? JSON.parse(saved) : null;
    } catch(e) {
        return null;
    }
}
