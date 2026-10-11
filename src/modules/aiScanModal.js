import { showToast } from './toast.js';
import { 
    AVAILABLE_MODELS, 
    getGeminiApiKey, 
    setGeminiApiKey, 
    getActiveModelId, 
    setActiveModelId, 
    optimizeImageFile, 
    tryNativeBarcodeDetection, 
    analyzeProductImageWithGemini, 
    applyAiDataToSingleLabel 
} from '../services/aiVision.js';

let currentExtractedData = null;
let currentImageDataUrl = null;
let isAnalyzing = false;

/**
 * Abre el modal de Escaneo Inteligente con IA
 */
export function openAiScanModal() {
    const modal = document.getElementById('ai-scan-modal');
    if (!modal) return;

    modal.classList.remove('hidden');
    syncAiSettingsUI();
    resetAiScanState();

    // Si no hay API Key configurada, expandir automáticamente la sección de configuración
    const apiKey = getGeminiApiKey();
    const configSection = document.getElementById('ai-config-section');
    if (!apiKey && configSection) {
        configSection.classList.remove('hidden');
    }
}

/**
 * Cierra el modal de IA
 */
export function closeAiScanModal() {
    const modal = document.getElementById('ai-scan-modal');
    if (modal) modal.classList.add('hidden');
    resetAiScanState();
}

/**
 * Reinicia el estado visual del escáner
 */
export function resetAiScanState() {
    currentExtractedData = null;
    currentImageDataUrl = null;
    isAnalyzing = false;

    const previewContainer = document.getElementById('ai-image-preview-container');
    const resultsContainer = document.getElementById('ai-results-container');
    const uploadArea = document.getElementById('ai-upload-dropzone');
    const laser = document.getElementById('ai-scan-laser');
    const loader = document.getElementById('ai-loading-indicator');

    if (previewContainer) previewContainer.classList.add('hidden');
    if (resultsContainer) resultsContainer.classList.add('hidden');
    if (uploadArea) uploadArea.classList.remove('hidden');
    if (laser) laser.classList.add('hidden');
    if (loader) loader.classList.add('hidden');

    const fileInput = document.getElementById('ai-file-input');
    const cameraInput = document.getElementById('ai-camera-input');
    if (fileInput) fileInput.value = '';
    if (cameraInput) cameraInput.value = '';
}

/**
 * Sincroniza los campos de configuración de IA en la interfaz
 */
export function syncAiSettingsUI() {
    const keyInput = document.getElementById('ai-api-key-input');
    const modelSelect = document.getElementById('ai-model-select');
    const customModelGroup = document.getElementById('ai-custom-model-group');
    const customModelInput = document.getElementById('ai-custom-model-input');

    const currentKey = getGeminiApiKey();
    const currentModel = getActiveModelId();

    if (keyInput) keyInput.value = currentKey;

    if (modelSelect) {
        // Verificar si el modelo actual está en la lista de presets
        const isPreset = AVAILABLE_MODELS.some(m => m.id === currentModel && m.id !== 'custom');
        if (isPreset) {
            modelSelect.value = currentModel;
            if (customModelGroup) customModelGroup.classList.add('hidden');
        } else {
            modelSelect.value = 'custom';
            if (customModelGroup) customModelGroup.classList.remove('hidden');
            if (customModelInput) customModelInput.value = currentModel;
        }
    }
}

/**
 * Guarda los ajustes de API Key y Modelo
 */
export function saveAiSettings() {
    const keyInput = document.getElementById('ai-api-key-input');
    const modelSelect = document.getElementById('ai-model-select');
    const customModelInput = document.getElementById('ai-custom-model-input');

    const newKey = keyInput?.value?.trim() || '';
    setGeminiApiKey(newKey);

    let chosenModel = modelSelect?.value || 'gemini-3.0-flash';
    if (chosenModel === 'custom') {
        chosenModel = customModelInput?.value?.trim() || 'gemini-3.0-flash';
    }
    setActiveModelId(chosenModel);

    showToast(`Configuración de IA actualizada (Modelo: ${chosenModel})`, 'success');

    const configSection = document.getElementById('ai-config-section');
    if (configSection) configSection.classList.add('hidden');
}

/**
 * Procesa un archivo de imagen seleccionado o capturado
 */
export async function handleAiImageUpload(file) {
    if (!file) return;

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
        const configSection = document.getElementById('ai-config-section');
        if (configSection) configSection.classList.remove('hidden');
        showToast('Ingresa tu API Key de Gemini para iniciar el reconocimiento', 'warning');
        return;
    }

    try {
        isAnalyzing = true;
        const uploadArea = document.getElementById('ai-upload-dropzone');
        const previewContainer = document.getElementById('ai-image-preview-container');
        const previewImg = document.getElementById('ai-preview-image');
        const laser = document.getElementById('ai-scan-laser');
        const loader = document.getElementById('ai-loading-indicator');
        const resultsContainer = document.getElementById('ai-results-container');

        if (uploadArea) uploadArea.classList.add('hidden');
        if (resultsContainer) resultsContainer.classList.add('hidden');

        // Optimizar imagen
        const { base64Data, mimeType, dataUrl } = await optimizeImageFile(file);
        currentImageDataUrl = dataUrl;

        if (previewImg) previewImg.src = dataUrl;
        if (previewContainer) previewContainer.classList.remove('hidden');
        if (laser) laser.classList.remove('hidden');
        if (loader) loader.classList.remove('hidden');

        // Escaneo Híbrido: BarcodeDetector nativo + Gemini Multimodal
        const [nativeBarcode, geminiResult] = await Promise.allSettled([
            tryNativeBarcodeDetection(dataUrl),
            analyzeProductImageWithGemini(base64Data, mimeType)
        ]);

        if (geminiResult.status === 'rejected') {
            throw geminiResult.reason;
        }

        const data = geminiResult.value;

        // Si BarcodeDetector encontró un código nativo exacto, priorizar ese número
        if (nativeBarcode.status === 'fulfilled' && nativeBarcode.value) {
            data.code = nativeBarcode.value.code;
            data.symbology = nativeBarcode.value.symbology;
        }

        currentExtractedData = data;
        displayExtractedAiResults(data);

        if (laser) laser.classList.add('hidden');
        if (loader) loader.classList.add('hidden');
        if (resultsContainer) resultsContainer.classList.remove('hidden');

        showToast('¡Datos detectados! Revisa y pulsa "Aplicar a la Etiqueta"', 'success');
    } catch (e) {
        console.error('Error en análisis IA:', e);
        const laser = document.getElementById('ai-scan-laser');
        const loader = document.getElementById('ai-loading-indicator');
        if (laser) laser.classList.add('hidden');
        if (loader) loader.classList.add('hidden');

        const uploadArea = document.getElementById('ai-upload-dropzone');
        if (uploadArea) uploadArea.classList.remove('hidden');

        let msg = e.message || 'Error analizando la imagen';
        if (e.message === 'API_KEY_MISSING') {
            msg = 'Debes configurar una clave API de Gemini';
            const configSection = document.getElementById('ai-config-section');
            if (configSection) configSection.classList.remove('hidden');
        }
        showToast(msg, 'error');
    } finally {
        isAnalyzing = false;
    }
}

/**
 * Muestra los resultados en los campos editables del modal
 */
function displayExtractedAiResults(data) {
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    };

    setVal('ai-res-title', data.title);
    setVal('ai-res-code', data.code);
    setVal('ai-res-symbology', data.symbology || 'CODE128');
    setVal('ai-res-price', data.price);
    setVal('ai-res-currency', data.currency || '$');
    setVal('ai-res-extra', data.extra);
}

/**
 * Confirma y aplica los datos del modal en la Etiqueta Única
 */
export function confirmAndApplyAiData() {
    const title = document.getElementById('ai-res-title')?.value || '';
    const code = document.getElementById('ai-res-code')?.value || '';
    const symbology = document.getElementById('ai-res-symbology')?.value || 'CODE128';
    const price = document.getElementById('ai-res-price')?.value || '';
    const currency = document.getElementById('ai-res-currency')?.value || '$';
    const extra = document.getElementById('ai-res-extra')?.value || '';

    applyAiDataToSingleLabel({
        title,
        code,
        symbology,
        price,
        currency,
        extra
    });

    closeAiScanModal();
}

/**
 * Escucha eventos de pegado (Ctrl+V) con imagen
 */
export function setupClipboardPasteListener() {
    window.addEventListener('paste', (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    openAiScanModal();
                    handleAiImageUpload(file);
                    break;
                }
            }
        }
    });
}
