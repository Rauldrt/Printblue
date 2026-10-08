import JsBarcode from 'jsbarcode';
import { labelConfig } from './paperSettings.js';
import { applyDynamicPageStyle } from './singleLabel.js';
import { showToast } from './toast.js';
import { printBatchBluetooth } from '../services/bluetooth.js';
import { triggerCloudSave } from '../services/cloudSync.js';

export let batchItems = [
    { id: 1, title: 'Remera Algodón M', code: '779123456789', price: '4500', extra: 'Talle M', qty: 2 },
    { id: 2, title: 'Pantalón Jean T40', code: '779987654321', price: '12000', extra: 'Lote 104', qty: 1 }
];

// Set con los IDs de los elementos actualmente seleccionados
export let selectedItemIds = new Set();

// Estado del buscador inteligente y filtros
export let batchSearchQuery = '';
export let batchFilterOnlySelected = false;

/**
 * Distancia de Levenshtein para tolerancia a errores tipográficos (typos)
 */
function levenshteinDistance(s1, s2) {
    if (s1 === s2) return 0;
    if (s1.length === 0) return s2.length;
    if (s2.length === 0) return s1.length;

    const row = [];
    for (let i = 0; i <= s2.length; i++) row[i] = i;

    for (let i = 1; i <= s1.length; i++) {
        let prev = i;
        for (let j = 1; j <= s2.length; j++) {
            let val;
            if (s1.charAt(i - 1) === s2.charAt(j - 1)) {
                val = row[j - 1];
            } else {
                val = Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
            }
            row[j - 1] = prev;
            prev = val;
        }
        row[s2.length] = prev;
    }
    return row[s2.length];
}

/**
 * Normaliza cadenas quitando tildes, signos de puntuación y convirtiendo a minúsculas
 */
function cleanText(text) {
    if (!text && text !== 0) return '';
    return String(text)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Quita diacríticos / tildes
        .toLowerCase()
        .replace(/[$€£]/g, '')           // Quita símbolos de moneda
        .trim();
}

/**
 * Evalúa si un producto coincide con una consulta de búsqueda flexible e inteligente
 * Soporta:
 * - Múltiples palabras en cualquier orden (AND lógico: "remera 4500" o "jean t40")
 * - Búsqueda insensible a mayúsculas y acentos ("algodon" encuentra "Algodón")
 * - Prefijos / coincidencias parciales ("rem" encuentra "Remera")
 * - Tolerancia a typos leves mediante Levenshtein ("remra" -> "remera", "pantlon" -> "pantalon")
 * - Búsqueda en todos los campos: Nombre, Código/SKU, Precio, Texto Extra/Lote
 */
export function itemMatchesQuery(item, query) {
    if (!query || !query.trim()) return true;

    const normalizedQuery = cleanText(query);
    const queryTokens = normalizedQuery.split(/\s+/).filter(t => t.length > 0);
    if (queryTokens.length === 0) return true;

    const titleNorm = cleanText(item.title);
    const codeNorm = cleanText(item.code);
    const priceNorm = cleanText(item.price);
    const extraNorm = cleanText(item.extra);

    const fullContent = `${titleNorm} ${codeNorm} ${priceNorm} ${extraNorm}`;
    const itemWords = fullContent.split(/[\s,./\-_]+/).filter(w => w.length > 0);

    return queryTokens.every(token => {
        // 1. Coincidencia directa de subcadena en todo el contenido combinado
        if (fullContent.includes(token)) return true;

        // 2. Coincidencia por prefijo en alguna palabra
        if (itemWords.some(w => w.startsWith(token))) return true;

        // 3. Tolerancia a errores de tipeo (Fuzzy matching)
        if (token.length >= 4) {
            const maxAllowedDistance = token.length >= 7 ? 2 : 1;
            return itemWords.some(w => {
                if (Math.abs(w.length - token.length) <= 2) {
                    if (levenshteinDistance(token, w) <= maxAllowedDistance) return true;
                }
                return false;
            });
        }

        return false;
    });
}

/**
 * Obtiene los elementos visibles según el filtro de búsqueda y el filtro de seleccionados
 */
export function getVisibleBatchItems() {
    return batchItems.filter(item => {
        if (batchFilterOnlySelected && !selectedItemIds.has(item.id)) return false;
        return itemMatchesQuery(item, batchSearchQuery);
    });
}

export function setBatchSearchQuery(query) {
    batchSearchQuery = query || '';
    renderBatchTable();
}

export function clearBatchSearch() {
    batchSearchQuery = '';
    const searchInput = document.getElementById('batch-search-input');
    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
    }
    renderBatchTable();
}

export function setBatchFilterOnlySelected(val) {
    batchFilterOnlySelected = !!val;
    renderBatchTable();
}

export function setBatchItems(newItems) {
    batchItems = newItems.map((item, idx) => ({
        ...item,
        id: item.id || (Date.now() + idx)
    }));
    selectedItemIds.clear();
    renderBatchTable();
    triggerCloudSave();
}

function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function renderBatchTable() {
    const tbody = document.getElementById('batch-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Filtrar IDs seleccionados que ya no existan en la lista maestra
    const existingIds = new Set(batchItems.map(i => i.id));
    for (const id of selectedItemIds) {
        if (!existingIds.has(id)) selectedItemIds.delete(id);
    }

    const visibleItems = getVisibleBatchItems();
    updateSelectionToolbar();

    // 1. Estado vacío: no hay productos en la lista general
    if (batchItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="p-8 text-center text-slate-400 text-xs">
                    <i class="fa-solid fa-inbox text-2xl mb-2 block text-slate-300"></i>
                    No hay productos en la lista. Agrega una fila o importa directamente desde Google Sheets.
                </td>
            </tr>
        `;
        return;
    }

    // 2. Estado vacío por búsqueda/filtro: hay productos pero ninguno coincide
    if (visibleItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="p-8 text-center text-slate-400 text-xs">
                    <i class="fa-solid fa-magnifying-glass text-2xl mb-2 block text-indigo-300"></i>
                    <p class="font-semibold text-slate-700 text-sm">No se encontraron productos que coincidan</p>
                    <p class="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                        No hay coincidencias para "<span class="font-medium text-slate-600">${escapeHtml(batchSearchQuery)}</span>". Prueba con otros términos o limpia el filtro.
                    </p>
                    <div class="mt-3 flex justify-center gap-2">
                        <button onclick="clearBatchSearch()" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs px-3 py-1.5 rounded-lg border border-indigo-200 transition shadow-2xs">
                            <i class="fa-solid fa-xmark mr-1"></i> Limpiar Búsqueda
                        </button>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    // 3. Renderizar filas visibles
    visibleItems.forEach((item) => {
        const isSelected = selectedItemIds.has(item.id);
        const tr = document.createElement('tr');
        tr.className = isSelected ? 'bg-indigo-50/60 transition' : 'hover:bg-slate-50/70 transition';
        
        tr.innerHTML = `
            <td class="p-2 sm:p-3 text-center w-10">
                <input type="checkbox" data-id="${item.id}" class="batch-item-checkbox w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer" ${isSelected ? 'checked' : ''}>
            </td>
            <td class="p-2 sm:p-3">
                <input type="text" value="${escapeHtml(item.title || '')}" data-id="${item.id}" data-field="title" class="batch-inp w-full border border-slate-200 rounded p-1.5 text-xs font-medium focus:ring-1 focus:ring-indigo-500 bg-white">
            </td>
            <td class="p-2 sm:p-3">
                <input type="text" value="${escapeHtml(item.code || '')}" data-id="${item.id}" data-field="code" class="batch-inp w-full border border-slate-200 rounded p-1.5 text-xs font-mono focus:ring-1 focus:ring-indigo-500 bg-white">
            </td>
            <td class="p-2 sm:p-3 w-24">
                <input type="text" value="${escapeHtml(item.price || '')}" data-id="${item.id}" data-field="price" class="batch-inp w-full border border-slate-200 rounded p-1.5 text-xs focus:ring-1 focus:ring-indigo-500 bg-white">
            </td>
            <td class="p-2 sm:p-3">
                <input type="text" value="${escapeHtml(item.extra || '')}" placeholder="Lote / Detalle" data-id="${item.id}" data-field="extra" class="batch-inp w-full border border-slate-200 rounded p-1.5 text-xs text-slate-600 focus:ring-1 focus:ring-indigo-500 bg-white">
            </td>
            <td class="p-2 sm:p-3 w-16 sm:w-20">
                <input type="number" min="1" value="${item.qty || 1}" data-id="${item.id}" data-field="qty" class="batch-inp w-full border border-slate-200 rounded p-1.5 text-xs text-center font-bold focus:ring-1 focus:ring-indigo-500 bg-white">
            </td>
            <td class="p-2 sm:p-3 text-center w-10">
                <button data-id="${item.id}" class="remove-batch-btn text-slate-400 hover:text-rose-600 p-1 transition" title="Eliminar este producto">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Checkbox individual listener
    tbody.querySelectorAll('.batch-item-checkbox').forEach(chk => {
        chk.addEventListener('change', (e) => {
            const rawId = e.target.dataset.id;
            const id = isNaN(rawId) ? rawId : Number(rawId);
            if (e.target.checked) {
                selectedItemIds.add(id);
            } else {
                selectedItemIds.delete(id);
            }
            renderBatchTable();
        });
    });

    // Input changes (vinculado por ID único para no fallar con filtros)
    tbody.querySelectorAll('.batch-inp').forEach(input => {
        input.addEventListener('change', (e) => {
            const rawId = e.target.dataset.id;
            const id = isNaN(rawId) ? rawId : Number(rawId);
            const field = e.target.dataset.field;
            const val = field === 'qty' ? parseInt(e.target.value) || 1 : e.target.value;
            const item = batchItems.find(it => String(it.id) === String(id));
            if (item) {
                item[field] = val;
                triggerCloudSave();
            }
        });
    });

    // Individual delete
    tbody.querySelectorAll('.remove-batch-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const rawId = e.currentTarget.dataset.id;
            const id = isNaN(rawId) ? rawId : Number(rawId);
            removeBatchRowById(id);
        });
    });
}

/**
 * Actualiza la barra de acciones masivas y los badges del buscador
 */
function updateSelectionToolbar() {
    const selectAllCheckbox = document.getElementById('batch-select-all');
    const visibleItems = getVisibleBatchItems();
    const visibleCount = visibleItems.length;
    const selectedCount = selectedItemIds.size;
    const totalCount = batchItems.length;

    // Contar cuántos de los visibles están seleccionados
    const visibleSelectedCount = visibleItems.filter(item => selectedItemIds.has(item.id)).length;

    if (selectAllCheckbox) {
        selectAllCheckbox.checked = visibleCount > 0 && visibleSelectedCount === visibleCount;
        selectAllCheckbox.indeterminate = visibleSelectedCount > 0 && visibleSelectedCount < visibleCount;
    }

    const toolbar = document.getElementById('batch-selection-toolbar');
    const counterBadge = document.getElementById('batch-selected-count-badge');
    const printSelectedBtn = document.getElementById('btn-print-selected');

    if (toolbar) {
        if (selectedCount > 0) {
            toolbar.classList.remove('hidden');
            toolbar.classList.add('flex');
            if (counterBadge) counterBadge.innerText = `${selectedCount} seleccionado${selectedCount > 1 ? 's' : ''}`;
        } else {
            toolbar.classList.add('hidden');
            toolbar.classList.remove('flex');
        }
    }

    if (printSelectedBtn) {
        if (selectedCount > 0) {
            printSelectedBtn.classList.remove('hidden');
            printSelectedBtn.innerHTML = `<i class="fa-solid fa-print mr-1"></i> Imprimir Seleccionados (${selectedCount})`;
        } else {
            printSelectedBtn.classList.add('hidden');
        }
    }

    // Actualizar UI del buscador inteligente
    updateSearchUI(visibleCount, totalCount, selectedCount);
}

/**
 * Actualiza estados visuales de la barra de búsqueda y filtros
 */
function updateSearchUI(visibleCount, totalCount, selectedCount) {
    const clearBtn = document.getElementById('batch-search-clear');
    const countBadge = document.getElementById('batch-search-count-badge');
    const chipAll = document.getElementById('chip-filter-all');
    const chipSelected = document.getElementById('chip-filter-selected');
    const chipCountAll = document.getElementById('chip-count-all');
    const chipCountSelected = document.getElementById('chip-count-selected');

    if (clearBtn) {
        if (batchSearchQuery.trim().length > 0) {
            clearBtn.classList.remove('hidden');
            clearBtn.classList.add('flex');
        } else {
            clearBtn.classList.add('hidden');
            clearBtn.classList.remove('flex');
        }
    }

    if (chipCountAll) chipCountAll.innerText = totalCount;
    if (chipCountSelected) chipCountSelected.innerText = selectedCount;

    if (chipAll) {
        if (!batchFilterOnlySelected) {
            chipAll.className = 'px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white shadow-2xs transition';
        } else {
            chipAll.className = 'px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 transition';
        }
    }

    if (chipSelected) {
        if (batchFilterOnlySelected) {
            chipSelected.className = 'px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white shadow-2xs transition';
        } else {
            chipSelected.className = 'px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 transition';
        }
    }

    if (countBadge) {
        const isFiltering = batchSearchQuery.trim().length > 0 || batchFilterOnlySelected;
        if (isFiltering) {
            countBadge.innerText = `${visibleCount} de ${totalCount} encontrados`;
            countBadge.className = visibleCount > 0 
                ? 'hidden sm:inline-flex text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-lg'
                : 'hidden sm:inline-flex text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg';
        } else {
            countBadge.innerText = `Total: ${totalCount}`;
            countBadge.className = 'hidden sm:inline-flex text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1.5 rounded-lg';
        }
    }

    // Actualizar botones de impresión para reflejar cuántos se imprimirán si hay filtro activo
    const directBtnBatch = document.getElementById('btn-print-batch-bt');
    if (directBtnBatch) {
        const textSpan = directBtnBatch.querySelector('span');
        const isFiltering = batchSearchQuery.trim().length > 0 || batchFilterOnlySelected;
        if (textSpan) {
            if (isFiltering) {
                textSpan.innerText = `Imprimir Filtrados por Bluetooth (${visibleCount})`;
            } else {
                textSpan.innerText = `Imprimir Todo por Bluetooth (${totalCount})`;
            }
        }
    }
}

/**
 * Selecciona o deselecciona todas las filas (enfocado en las visibles/filtradas)
 */
export function toggleSelectAll(checked) {
    const visible = getVisibleBatchItems();
    if (checked) {
        visible.forEach(item => selectedItemIds.add(item.id));
    } else {
        visible.forEach(item => selectedItemIds.delete(item.id));
    }
    renderBatchTable();
}

/**
 * Elimina todos los elementos seleccionados
 */
export function deleteSelectedItems() {
    if (selectedItemIds.size === 0) {
        showToast('No hay productos seleccionados para eliminar', 'warning');
        return;
    }

    const count = selectedItemIds.size;
    batchItems = batchItems.filter(item => !selectedItemIds.has(item.id));
    selectedItemIds.clear();
    renderBatchTable();
    triggerCloudSave();
    showToast(`Se eliminaron ${count} productos seleccionados`, 'info');
}

/**
 * Modifica la cantidad de todos los elementos seleccionados en bloque
 */
export function setQtyForSelectedItems(newQty) {
    if (selectedItemIds.size === 0) return;
    const qty = parseInt(newQty) || 1;
    batchItems.forEach(item => {
        if (selectedItemIds.has(item.id)) {
            item.qty = qty;
        }
    });
    renderBatchTable();
    triggerCloudSave();
    showToast(`Cantidad cambiada a ${qty} para los seleccionados`, 'success');
}

export function addBatchRow(itemData = null) {
    const newItem = itemData || {
        id: Date.now(),
        title: 'Nuevo Producto',
        code: '100' + (batchItems.length + 1),
        price: '1000',
        extra: '',
        qty: 1
    };
    batchItems.push(newItem);

    // Si había un filtro que ocultaría el nuevo item, limpiamos la búsqueda para que sea visible
    if (batchSearchQuery && !itemMatchesQuery(newItem, batchSearchQuery)) {
        clearBatchSearch();
    } else {
        renderBatchTable();
    }
    triggerCloudSave();
}

export function removeBatchRowById(id) {
    const idx = batchItems.findIndex(item => String(item.id) === String(id));
    if (idx !== -1) {
        selectedItemIds.delete(id);
        batchItems.splice(idx, 1);
        renderBatchTable();
        triggerCloudSave();
    }
}

export function removeBatchRow(index) {
    const item = batchItems[index];
    if (item) removeBatchRowById(item.id);
}

export function clearBatch() {
    batchItems = [];
    selectedItemIds.clear();
    batchSearchQuery = '';
    const searchInput = document.getElementById('batch-search-input');
    if (searchInput) searchInput.value = '';
    renderBatchTable();
    triggerCloudSave();
    showToast('Lista limpiada', 'info');
}

/**
 * Imprime por Bluetooth directo (completo, filtrado o seleccionados)
 */
export async function printBatchBT(onlySelected = false) {
    let itemsToPrint;
    if (onlySelected && selectedItemIds.size > 0) {
        itemsToPrint = batchItems.filter(item => selectedItemIds.has(item.id));
    } else if (batchSearchQuery.trim() || batchFilterOnlySelected) {
        itemsToPrint = getVisibleBatchItems();
    } else {
        itemsToPrint = batchItems;
    }
    await printBatchBluetooth(itemsToPrint);
}

/**
 * Imprime mediante diálogo del sistema (completo, filtrado o seleccionados)
 */
export function printBatch(onlySelected = false) {
    let itemsToPrint;
    if (onlySelected && selectedItemIds.size > 0) {
        itemsToPrint = batchItems.filter(item => selectedItemIds.has(item.id));
    } else if (batchSearchQuery.trim() || batchFilterOnlySelected) {
        itemsToPrint = getVisibleBatchItems();
    } else {
        itemsToPrint = batchItems;
    }

    if (itemsToPrint.length === 0) {
        showToast('No hay productos para imprimir', 'warning');
        return;
    }

    const printArea = document.getElementById('print-area');
    if (!printArea) return;
    printArea.innerHTML = '';

    applyDynamicPageStyle();

    const pxHeight = Math.round(labelConfig.heightMm * 3.78);
    const barcodePrintHeight = Math.max(30, Math.round(pxHeight * (labelConfig.barcodeHeight / 100)));

    let counter = 0;
    const vAlign = labelConfig.verticalAlign || 'center';

    itemsToPrint.forEach(item => {
        for (let i = 0; i < item.qty; i++) {
            const labelDiv = document.createElement('div');
            labelDiv.className = 'print-label-item thermal-paper page-break flex flex-col items-center text-center overflow-hidden box-border mx-auto my-0';
            labelDiv.style.width = `${labelConfig.widthMm}mm`;
            labelDiv.style.height = `${labelConfig.heightMm}mm`;
            labelDiv.style.paddingTop = `${labelConfig.paddingTopMm ?? labelConfig.paddingMm ?? 2.0}mm`;
            labelDiv.style.paddingBottom = `${labelConfig.paddingBottomMm ?? labelConfig.paddingMm ?? 2.0}mm`;
            labelDiv.style.paddingLeft = `${labelConfig.paddingMm ?? 2.0}mm`;
            labelDiv.style.paddingRight = `${labelConfig.paddingMm ?? 2.0}mm`;
            labelDiv.style.justifyContent = vAlign;

            const barcodeId = `batch-barcode-${counter}`;
            
            labelDiv.innerHTML = `
                <div class="print-label-title font-bold text-black uppercase leading-tight truncate w-full" style="font-size: ${labelConfig.fontSizePt * 0.95}pt; margin-bottom: ${labelConfig.spacingTitle ?? 2.0}mm;">${item.title}</div>
                <div class="print-label-barcode flex items-center justify-center w-full overflow-hidden" style="${vAlign === 'space-between' ? 'flex: 1;' : ''} margin-bottom: ${labelConfig.spacingFooter ?? 2.0}mm;">
                    <svg id="${barcodeId}" class="max-w-full max-h-full"></svg>
                </div>
                <div class="print-label-footer w-full flex items-center justify-between text-black leading-none">
                    <span class="truncate font-medium text-black" style="font-size: ${labelConfig.fontSizePt * 0.8}pt">${item.extra ? item.extra : (item.code ? `SKU: ${item.code}` : '')}</span>
                    <span class="font-bold" style="font-size: ${labelConfig.fontSizePt * 1.15}pt">${item.price ? `$ ${item.price}` : ''}</span>
                </div>
            `;

            printArea.appendChild(labelDiv);

            const currentId = barcodeId;
            const currentCode = item.code || '12345678';
            setTimeout(() => {
                try {
                    JsBarcode(`#${currentId}`, currentCode, {
                        format: "CODE128",
                        width: labelConfig.barcodeWidth,
                        height: barcodePrintHeight,
                        displayValue: true,
                        fontSize: labelConfig.fontSizePt * 0.85,
                        margin: 0
                    });
                } catch(e){}
            }, 50);

            counter++;
        }
    });

    setTimeout(() => {
        window.print();
    }, 400);
}
