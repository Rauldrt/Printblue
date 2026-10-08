import JsBarcode from 'jsbarcode';
import { labelConfig } from './paperSettings.js';
import { applyDynamicPageStyle } from './singleLabel.js';
import { showToast } from './toast.js';
import { printBatchBluetooth } from '../services/bluetooth.js';

export async function printBatchBT(onlySelected = false) {
    const itemsToPrint = onlySelected && selectedItemIds.size > 0 
        ? batchItems.filter(item => selectedItemIds.has(item.id))
        : batchItems;
    await printBatchBluetooth(itemsToPrint);
}

export let batchItems = [
    { id: 1, title: 'Remera Algodón M', code: '779123456789', price: '4500', extra: 'Talle M', qty: 2 },
    { id: 2, title: 'Pantalón Jean T40', code: '779987654321', price: '12000', extra: 'Lote 104', qty: 1 }
];

// Set con los IDs de los elementos actualmente seleccionados
export let selectedItemIds = new Set();

export function setBatchItems(newItems) {
    batchItems = newItems;
    selectedItemIds.clear();
    renderBatchTable();
}

export function renderBatchTable() {
    const tbody = document.getElementById('batch-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Filtrar IDs que ya no existan
    const existingIds = new Set(batchItems.map(i => i.id));
    for (const id of selectedItemIds) {
        if (!existingIds.has(id)) selectedItemIds.delete(id);
    }

    updateSelectionToolbar();

    if (batchItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="p-8 text-center text-slate-400 text-xs">
                    <i class="fa-solid fa-inbox text-2xl mb-2 block text-slate-300"></i>
                    No hay productos en la lista. Agrega una fila o importa desde Google Sheets.
                </td>
            </tr>
        `;
        return;
    }

    batchItems.forEach((item, index) => {
        const isSelected = selectedItemIds.has(item.id);
        const tr = document.createElement('tr');
        tr.className = isSelected ? 'bg-indigo-50/60 transition' : 'hover:bg-slate-50/70 transition';
        
        tr.innerHTML = `
            <td class="p-2 sm:p-3 text-center w-10">
                <input type="checkbox" data-id="${item.id}" class="batch-item-checkbox w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer" ${isSelected ? 'checked' : ''}>
            </td>
            <td class="p-2 sm:p-3">
                <input type="text" value="${item.title || ''}" data-index="${index}" data-field="title" class="batch-inp w-full border border-slate-200 rounded p-1.5 text-xs font-medium focus:ring-1 focus:ring-indigo-500 bg-white">
            </td>
            <td class="p-2 sm:p-3">
                <input type="text" value="${item.code || ''}" data-index="${index}" data-field="code" class="batch-inp w-full border border-slate-200 rounded p-1.5 text-xs font-mono focus:ring-1 focus:ring-indigo-500 bg-white">
            </td>
            <td class="p-2 sm:p-3 w-24">
                <input type="text" value="${item.price || ''}" data-index="${index}" data-field="price" class="batch-inp w-full border border-slate-200 rounded p-1.5 text-xs focus:ring-1 focus:ring-indigo-500 bg-white">
            </td>
            <td class="p-2 sm:p-3">
                <input type="text" value="${item.extra || ''}" placeholder="Lote / Detalle" data-index="${index}" data-field="extra" class="batch-inp w-full border border-slate-200 rounded p-1.5 text-xs text-slate-600 focus:ring-1 focus:ring-indigo-500 bg-white">
            </td>
            <td class="p-2 sm:p-3 w-16 sm:w-20">
                <input type="number" min="1" value="${item.qty || 1}" data-index="${index}" data-field="qty" class="batch-inp w-full border border-slate-200 rounded p-1.5 text-xs text-center font-bold focus:ring-1 focus:ring-indigo-500 bg-white">
            </td>
            <td class="p-2 sm:p-3 text-center w-10">
                <button data-remove-index="${index}" class="remove-batch-btn text-slate-400 hover:text-rose-600 p-1 transition" title="Eliminar este producto">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Checkbox individual listener
    tbody.querySelectorAll('.batch-item-checkbox').forEach(chk => {
        chk.addEventListener('change', (e) => {
            const id = isNaN(e.target.dataset.id) ? e.target.dataset.id : Number(e.target.dataset.id);
            if (e.target.checked) {
                selectedItemIds.add(id);
            } else {
                selectedItemIds.delete(id);
            }
            renderBatchTable();
        });
    });

    // Input changes
    tbody.querySelectorAll('.batch-inp').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index);
            const field = e.target.dataset.field;
            const val = field === 'qty' ? parseInt(e.target.value) || 1 : e.target.value;
            if (batchItems[idx]) batchItems[idx][field] = val;
        });
    });

    // Individual delete
    tbody.querySelectorAll('.remove-batch-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.removeIndex);
            removeBatchRow(idx);
        });
    });
}

/**
 * Actualiza la barra de acciones masivas según la cantidad de elementos seleccionados
 */
function updateSelectionToolbar() {
    const selectAllCheckbox = document.getElementById('batch-select-all');
    const selectedCount = selectedItemIds.size;
    const totalCount = batchItems.length;

    if (selectAllCheckbox) {
        selectAllCheckbox.checked = totalCount > 0 && selectedCount === totalCount;
        selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < totalCount;
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
}

/**
 * Selecciona o deselecciona todas las filas
 */
export function toggleSelectAll(checked) {
    if (checked) {
        batchItems.forEach(item => selectedItemIds.add(item.id));
    } else {
        selectedItemIds.clear();
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
    showToast(`Cantidad cambiada a ${qty} para los seleccionados`, 'success');
}

export function addBatchRow(itemData = null) {
    batchItems.push(itemData || {
        id: Date.now(),
        title: 'Nuevo Producto',
        code: '100' + (batchItems.length + 1),
        price: '1000',
        extra: '',
        qty: 1
    });
    renderBatchTable();
}

export function removeBatchRow(index) {
    const item = batchItems[index];
    if (item) selectedItemIds.delete(item.id);
    batchItems.splice(index, 1);
    renderBatchTable();
}

export function clearBatch() {
    batchItems = [];
    selectedItemIds.clear();
    renderBatchTable();
    showToast('Lista limpiada', 'info');
}

/**
 * Imprime el lote (completo o solo los seleccionados)
 */
export function printBatch(onlySelected = false) {
    const itemsToPrint = onlySelected && selectedItemIds.size > 0 
        ? batchItems.filter(item => selectedItemIds.has(item.id))
        : batchItems;

    if (itemsToPrint.length === 0) {
        showToast('Agrega o selecciona al menos un producto para imprimir', 'warning');
        return;
    }

    const printArea = document.getElementById('print-area');
    if (!printArea) return;
    printArea.innerHTML = '';

    applyDynamicPageStyle();

    const pxHeight = Math.round(labelConfig.heightMm * 3.78);
    const barcodePrintHeight = Math.max(30, Math.round(pxHeight * (labelConfig.barcodeHeight / 100)));

    let counter = 0;
    itemsToPrint.forEach(item => {
        for (let i = 0; i < item.qty; i++) {
            const labelDiv = document.createElement('div');
            labelDiv.className = 'print-label-item thermal-paper page-break flex flex-col items-center justify-between text-center overflow-hidden box-border mx-auto my-0';
            labelDiv.style.width = `${labelConfig.widthMm}mm`;
            labelDiv.style.height = `${labelConfig.heightMm}mm`;
            labelDiv.style.padding = `${labelConfig.paddingMm}mm`;

            const barcodeId = `batch-barcode-${counter}`;
            
            labelDiv.innerHTML = `
                <div class="font-bold text-black uppercase leading-tight truncate w-full" style="font-size: ${labelConfig.fontSizePt * 0.95}pt">${item.title}</div>
                <div class="flex-1 flex items-center justify-center w-full my-1 overflow-hidden">
                    <svg id="${barcodeId}" class="max-w-full max-h-full"></svg>
                </div>
                <div class="w-full flex items-center justify-between text-black leading-none">
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
