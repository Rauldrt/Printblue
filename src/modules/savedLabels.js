import { showToast } from './toast.js';
import { updatePreview } from './singleLabel.js';
import { labelConfig } from './paperSettings.js';
import { printSingleLabelBluetooth } from '../services/bluetooth.js';
import { batchItems, renderBatchTable } from './batchPrinting.js';
import { triggerCloudSave } from '../services/cloudSync.js';

let activeEditingLabelId = null;
let savedSearchFilter = '';

/**
 * Obtiene las etiquetas guardadas desde localStorage
 */
export function getSavedLabels() {
    try {
        const raw = localStorage.getItem('printlabel_saved_labels');
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.error('Error al leer etiquetas guardadas:', e);
        return [];
    }
}

/**
 * Almacena las etiquetas guardadas y actualiza la UI
 */
export function setSavedLabels(labels, syncCloud = true) {
    try {
        localStorage.setItem('printlabel_saved_labels', JSON.stringify(labels));
        updateSavedLabelsUI();
        if (syncCloud) {
            triggerCloudSave();
        }
    } catch (e) {
        console.error('Error al guardar etiquetas:', e);
    }
}

/**
 * Guarda la etiqueta actual del formulario en la biblioteca
 */
export function saveCurrentSingleLabel() {
    const title = (document.getElementById('inp-title')?.value || '').trim();
    const code = (document.getElementById('inp-code')?.value || '').trim();
    const symbology = document.getElementById('inp-symbology')?.value || 'CODE128';
    const price = (document.getElementById('inp-price')?.value || '').trim();
    const currency = document.getElementById('inp-currency')?.value || '$';
    const extra = (document.getElementById('inp-extra')?.value || '').trim();

    const showTitle = document.getElementById('chk-show-title')?.checked ?? true;
    const showPrice = document.getElementById('chk-show-price')?.checked ?? true;
    const showExtra = document.getElementById('chk-show-extra')?.checked ?? true;
    const boldPrice = document.getElementById('chk-bold-price')?.checked ?? true;

    if (!title && !code) {
        showToast('Ingresa al menos un nombre o código para guardar la etiqueta', 'warning');
        return;
    }

    const labels = getSavedLabels();
    const now = new Date().toISOString();

    // Comprobar si estamos actualizando una existente o si ya existe el mismo código
    let existingIndex = -1;
    if (activeEditingLabelId) {
        existingIndex = labels.findIndex(l => l.id === activeEditingLabelId);
    } else if (code) {
        existingIndex = labels.findIndex(l => l.code === code && l.title === title);
    }

    const labelData = {
        id: existingIndex >= 0 ? labels[existingIndex].id : `lbl_${Date.now()}`,
        title,
        code: code || '12345678',
        symbology,
        price,
        currency,
        extra,
        showTitle,
        showPrice,
        showExtra,
        boldPrice,
        createdAt: existingIndex >= 0 ? labels[existingIndex].createdAt : now,
        updatedAt: now
    };

    if (existingIndex >= 0) {
        labels[existingIndex] = labelData;
        activeEditingLabelId = labelData.id;
        showToast(`¡Etiqueta "${title || code}" actualizada!`, 'success');
    } else {
        labels.unshift(labelData);
        activeEditingLabelId = labelData.id;
        showToast(`¡Etiqueta "${title || code}" guardada con éxito!`, 'success');
    }

    setSavedLabels(labels, true);
    renderSavedLabelsModal();
}

/**
 * Carga una etiqueta guardada en el diseñador
 */
export function loadSavedLabel(id) {
    const labels = getSavedLabels();
    const label = labels.find(l => l.id === id);
    if (!label) {
        showToast('No se encontró la etiqueta seleccionada', 'error');
        return;
    }

    const setVal = (elmId, val) => {
        const el = document.getElementById(elmId);
        if (el && val !== undefined) el.value = val;
    };
    const setChk = (elmId, val) => {
        const el = document.getElementById(elmId);
        if (el && val !== undefined) el.checked = val;
    };

    setVal('inp-title', label.title || '');
    setVal('inp-code', label.code || '');
    setVal('inp-symbology', label.symbology || 'CODE128');
    setVal('inp-price', label.price || '');
    setVal('inp-currency', label.currency || '$');
    setVal('inp-extra', label.extra || '');

    setChk('chk-show-title', label.showTitle ?? true);
    setChk('chk-show-price', label.showPrice ?? true);
    setChk('chk-show-extra', label.showExtra ?? true);
    setChk('chk-bold-price', label.boldPrice ?? true);

    activeEditingLabelId = label.id;

    updatePreview();
    updateSavedLabelsUI();
    closeSavedLabelsModal();

    showToast(`Etiqueta "${label.title || label.code}" cargada`, 'info');
}

/**
 * Limpia el formulario para crear una etiqueta desde cero
 */
export function clearSingleLabelForm() {
    activeEditingLabelId = null;

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    setVal('inp-title', '');
    setVal('inp-code', '');
    setVal('inp-price', '');
    setVal('inp-extra', '');
    
    updatePreview();
    updateSavedLabelsUI();
    showToast('Formulario limpio para una nueva etiqueta', 'info');
}

/**
 * Elimina una etiqueta guardada
 */
export function deleteSavedLabel(id) {
    const labels = getSavedLabels();
    const target = labels.find(l => l.id === id);
    const labelName = target ? (target.title || target.code) : 'la etiqueta';

    if (!confirm(`¿Eliminar "${labelName}" de tus etiquetas guardadas?`)) {
        return;
    }

    const updated = labels.filter(l => l.id !== id);
    if (activeEditingLabelId === id) {
        activeEditingLabelId = null;
    }

    setSavedLabels(updated, true);
    renderSavedLabelsModal();
    showToast(`Etiqueta eliminada`, 'info');
}

/**
 * Agrega una etiqueta guardada directamente a la cola de impresión por lote
 */
export function addSavedLabelToBatch(id) {
    const labels = getSavedLabels();
    const label = labels.find(l => l.id === id);
    if (!label) return;

    const newItem = {
        id: Date.now(),
        title: label.title || '',
        code: label.code || '',
        symbology: label.symbology || 'CODE128',
        price: label.price || '',
        extra: label.extra || '',
        qty: 1
    };

    batchItems.push(newItem);
    renderBatchTable();
    triggerCloudSave();

    showToast(`"${label.title || label.code}" agregada al Lote`, 'success');
}

/**
 * Imprime una etiqueta guardada directamente por Bluetooth
 */
export async function printSavedLabelDirectBT(id) {
    const labels = getSavedLabels();
    const label = labels.find(l => l.id === id);
    if (!label) return;

    const currency = label.currency || '$';
    const item = {
        title: label.showTitle !== false ? (label.title || '') : '',
        code: label.code || '12345678',
        symbology: label.symbology || 'CODE128',
        price: (label.showPrice !== false && label.price) ? `${currency} ${label.price}` : '',
        extra: label.showExtra !== false ? (label.extra || '') : ''
    };

    await printSingleLabelBluetooth(item, 1);
}

/**
 * Abre el modal de etiquetas guardadas
 */
export function openSavedLabelsModal() {
    const modal = document.getElementById('saved-labels-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    savedSearchFilter = '';
    const searchInput = document.getElementById('saved-labels-search');
    if (searchInput) searchInput.value = '';
    renderSavedLabelsModal();
    setTimeout(() => searchInput?.focus(), 50);
}

/**
 * Cierra el modal de etiquetas guardadas
 */
export function closeSavedLabelsModal() {
    const modal = document.getElementById('saved-labels-modal');
    if (modal) modal.classList.add('hidden');
}

/**
 * Filtra las etiquetas guardadas en tiempo real
 */
export function filterSavedLabels(query) {
    savedSearchFilter = (query || '').toLowerCase().trim();
    renderSavedLabelsModal();
}

/**
 * Renderiza el listado de tarjetas en el modal
 */
export function renderSavedLabelsModal() {
    const container = document.getElementById('saved-labels-list');
    const countEl = document.getElementById('saved-modal-count');
    if (!container) return;

    const labels = getSavedLabels();
    if (countEl) countEl.innerText = `${labels.length} etiqueta${labels.length === 1 ? '' : 's'}`;

    let filtered = labels;
    if (savedSearchFilter) {
        filtered = labels.filter(l => {
            const title = (l.title || '').toLowerCase();
            const code = (l.code || '').toLowerCase();
            const price = (l.price || '').toLowerCase();
            const extra = (l.extra || '').toLowerCase();
            return title.includes(savedSearchFilter) ||
                   code.includes(savedSearchFilter) ||
                   price.includes(savedSearchFilter) ||
                   extra.includes(savedSearchFilter);
        });
    }

    if (labels.length === 0) {
        container.innerHTML = `
            <div class="py-12 px-4 text-center space-y-3">
                <div class="w-14 h-14 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto text-2xl border border-indigo-100">
                    <i class="fa-regular fa-bookmark"></i>
                </div>
                <h3 class="text-sm font-bold text-slate-800">Aún no tienes etiquetas guardadas</h3>
                <p class="text-xs text-slate-500 max-w-sm mx-auto">
                    Completa los datos del producto en "Etiqueta Única" y haz clic en <strong>Guardar Etiqueta</strong> para reutilizarlas en cualquier momento.
                </p>
                <button type="button" onclick="closeSavedLabelsModal()" class="mt-2 inline-flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow-sm">
                    <i class="fa-solid fa-pen-to-square"></i>
                    <span>Ir al Diseñador</span>
                </button>
            </div>
        `;
        return;
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="py-10 text-center text-slate-500 space-y-2">
                <i class="fa-solid fa-magnifying-glass text-2xl text-slate-400"></i>
                <p class="text-xs">No se encontraron etiquetas con el término "<strong>${escapeHtml(savedSearchFilter)}</strong>".</p>
                <button type="button" onclick="filterSavedLabels('')" class="text-indigo-600 text-xs font-semibold hover:underline">Limpiar búsqueda</button>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(item => {
        const isCurrent = activeEditingLabelId === item.id;
        const dateStr = item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '';
        const priceDisplay = item.price ? `${item.currency || '$'} ${item.price}` : '';

        return `
            <div class="group relative bg-white border ${isCurrent ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-200'} rounded-xl p-3.5 sm:p-4 hover:border-indigo-400 hover:shadow-sm transition flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center space-x-2 mb-1 flex-wrap gap-y-1">
                        <h4 class="text-sm font-bold text-slate-900 truncate max-w-xs" title="${escapeHtml(item.title || 'Sin Nombre')}">
                            ${escapeHtml(item.title || 'Sin Nombre')}
                        </h4>
                        ${isCurrent ? '<span class="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full">En uso</span>' : ''}
                        <span class="bg-slate-100 text-slate-600 text-[10px] font-mono font-medium px-2 py-0.5 rounded border border-slate-200">
                            ${escapeHtml(item.symbology || 'CODE128')}
                        </span>
                    </div>

                    <div class="flex items-center space-x-3 text-xs text-slate-500 flex-wrap gap-y-1">
                        <span class="font-mono text-slate-700 flex items-center space-x-1">
                            <i class="fa-solid fa-barcode text-slate-400"></i>
                            <strong>${escapeHtml(item.code)}</strong>
                        </span>
                        ${priceDisplay ? `
                            <span class="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 text-[11px]">
                                ${escapeHtml(priceDisplay)}
                            </span>
                        ` : ''}
                        ${item.extra ? `
                            <span class="text-slate-400 truncate max-w-[140px]" title="${escapeHtml(item.extra)}">
                                ${escapeHtml(item.extra)}
                            </span>
                        ` : ''}
                        ${dateStr ? `
                            <span class="text-[10px] text-slate-400">${dateStr}</span>
                        ` : ''}
                    </div>
                </div>

                <div class="flex items-center space-x-1.5 self-end sm:self-center">
                    <button type="button" onclick="loadSavedLabel('${item.id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg shadow-sm transition flex items-center space-x-1.5" title="Cargar esta etiqueta en el diseñador">
                        <i class="fa-solid fa-arrow-right-to-bracket text-[11px]"></i>
                        <span>Cargar</span>
                    </button>
                    
                    <button type="button" onclick="printSavedLabelDirectBT('${item.id}')" class="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold text-xs px-2.5 py-1.5 rounded-lg transition flex items-center space-x-1" title="Imprimir directo por Bluetooth">
                        <i class="fa-solid fa-print text-[11px]"></i>
                        <span class="hidden sm:inline">Imprimir</span>
                    </button>

                    <button type="button" onclick="addSavedLabelToBatch('${item.id}')" class="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-medium text-xs px-2.5 py-1.5 rounded-lg transition" title="Agregar al Lote de Impresión">
                        <i class="fa-solid fa-plus text-[11px]"></i>
                        <span class="hidden sm:inline">Lote</span>
                    </button>

                    <button type="button" onclick="deleteSavedLabel('${item.id}')" class="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition" title="Eliminar etiqueta">
                        <i class="fa-regular fa-trash-can text-sm"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Actualiza los badges y la barra de acceso rápido en la interfaz principal
 */
export function updateSavedLabelsUI() {
    const labels = getSavedLabels();
    
    // 1. Badge contador en la cabecera del formulario
    const countBadge = document.getElementById('saved-labels-count-badge');
    if (countBadge) {
        if (labels.length > 0) {
            countBadge.innerText = `${labels.length} guardada${labels.length === 1 ? '' : 's'}`;
            countBadge.classList.remove('hidden');
        } else {
            countBadge.classList.add('hidden');
        }
    }

    // 2. Chip bar de etiquetas recientes (últimas 3)
    const recentBar = document.getElementById('recent-saved-labels-bar');
    if (recentBar) {
        if (labels.length > 0) {
            recentBar.classList.remove('hidden');
            const recent = labels.slice(0, 3);
            recentBar.innerHTML = `
                <div class="flex items-center justify-between mb-1.5 text-[11px] text-slate-500 font-medium">
                    <span class="flex items-center space-x-1">
                        <i class="fa-solid fa-clock-rotate-left text-indigo-500"></i>
                        <span>Reutilizar reciente:</span>
                    </span>
                    <button type="button" onclick="openSavedLabelsModal()" class="text-indigo-600 hover:underline font-semibold text-[11px]">
                        Ver todas (${labels.length})
                    </button>
                </div>
                <div class="flex flex-wrap gap-1.5">
                    ${recent.map(l => `
                        <button type="button" onclick="loadSavedLabel('${l.id}')" class="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs border ${activeEditingLabelId === l.id ? 'bg-indigo-600 text-white border-indigo-600 font-bold' : 'bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border-slate-200'} transition shadow-2xs">
                            <span class="truncate max-w-[120px] font-medium">${escapeHtml(l.title || l.code)}</span>
                            ${l.price ? `<span class="opacity-80 text-[10px]">${escapeHtml(l.currency || '$')}${escapeHtml(l.price)}</span>` : ''}
                        </button>
                    `).join('')}
                </div>
            `;
        } else {
            recentBar.classList.add('hidden');
            recentBar.innerHTML = '';
        }
    }

    // 3. Texto del botón de guardar (Guardar vs Actualizar)
    const btnSaveText = document.getElementById('btn-save-label-text');
    if (btnSaveText) {
        btnSaveText.innerText = activeEditingLabelId ? 'Actualizar Guardada' : 'Guardar Etiqueta';
    }
}

function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
