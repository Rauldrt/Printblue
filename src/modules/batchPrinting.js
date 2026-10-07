import JsBarcode from 'jsbarcode';
import { labelConfig } from './paperSettings.js';
import { applyDynamicPageStyle } from './singleLabel.js';
import { showToast } from './toast.js';

export let batchItems = [
    { id: 1, title: 'Remera Algodón M', code: '779123456789', price: '4500', qty: 2 },
    { id: 2, title: 'Pantalón Jean T40', code: '779987654321', price: '12000', qty: 1 }
];

export function setBatchItems(newItems) {
    batchItems = newItems;
    renderBatchTable();
}

export function renderBatchTable() {
    const tbody = document.getElementById('batch-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    batchItems.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="p-3">
                <input type="text" value="${item.title}" data-index="${index}" data-field="title" class="batch-inp w-full border rounded p-1 text-xs">
            </td>
            <td class="p-3">
                <input type="text" value="${item.code}" data-index="${index}" data-field="code" class="batch-inp w-full border rounded p-1 text-xs font-mono">
            </td>
            <td class="p-3">
                <input type="text" value="${item.price}" data-index="${index}" data-field="price" class="batch-inp w-full border rounded p-1 text-xs">
            </td>
            <td class="p-3">
                <input type="number" min="1" value="${item.qty}" data-index="${index}" data-field="qty" class="batch-inp w-16 border rounded p-1 text-xs text-center font-bold">
            </td>
            <td class="p-3 text-center">
                <button data-remove-index="${index}" class="remove-batch-btn text-red-500 hover:text-red-700">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.batch-inp').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index);
            const field = e.target.dataset.field;
            const val = field === 'qty' ? parseInt(e.target.value) || 1 : e.target.value;
            if (batchItems[idx]) batchItems[idx][field] = val;
        });
    });

    tbody.querySelectorAll('.remove-batch-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.removeIndex);
            removeBatchRow(idx);
        });
    });
}

export function addBatchRow(itemData = null) {
    batchItems.push(itemData || {
        id: Date.now(),
        title: 'Nuevo Producto',
        code: '100' + (batchItems.length + 1),
        price: '1000',
        qty: 1
    });
    renderBatchTable();
}

export function removeBatchRow(index) {
    batchItems.splice(index, 1);
    renderBatchTable();
}

export function clearBatch() {
    batchItems = [];
    renderBatchTable();
    showToast('Lista limpiada', 'info');
}

export function printBatch() {
    if (batchItems.length === 0) {
        showToast('Agrega al menos un producto a la lista', 'warning');
        return;
    }

    const printArea = document.getElementById('print-area');
    if (!printArea) return;
    printArea.innerHTML = '';

    applyDynamicPageStyle();

    const pxHeight = Math.round(labelConfig.heightMm * 3.78);
    const barcodePrintHeight = Math.max(30, Math.round(pxHeight * (labelConfig.barcodeHeight / 100)));

    let counter = 0;
    batchItems.forEach(item => {
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
                    <span class="truncate font-medium text-black" style="font-size: ${labelConfig.fontSizePt * 0.8}pt">SKU: ${item.code}</span>
                    <span class="font-bold" style="font-size: ${labelConfig.fontSizePt * 1.15}pt">$ ${item.price}</span>
                </div>
            `;

            printArea.appendChild(labelDiv);

            const currentId = barcodeId;
            const currentCode = item.code;
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
