import { showToast } from '../modules/toast.js';
import { updatePreview } from '../modules/singleLabel.js';
import { triggerCloudSave } from './cloudSync.js';

export const AVAILABLE_MODELS = [
    { id: 'gemini-3.0-flash', name: 'Gemini 3.0 Flash (Recomendado / Ultra Rápido)', isDefault: true },
    { id: 'gemini-3.0-pro', name: 'Gemini 3.0 Pro (Máxima Precisión Visual)' },
    { id: 'custom', name: 'Personalizado (Escribir ID del modelo...)' }
];

export const FALLBACK_MODELS = ['gemini-3.0-flash', 'gemini-3.0-pro'];

/**
 * Obtiene la API Key configurada
 */
export function getGeminiApiKey() {
    return (localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || '').trim();
}

/**
 * Guarda la API Key en localStorage
 */
export function setGeminiApiKey(key) {
    if (key) {
        localStorage.setItem('gemini_api_key', key.trim());
    } else {
        localStorage.removeItem('gemini_api_key');
    }
}

/**
 * Obtiene el ID del modelo actualmente seleccionado
 */
export function getActiveModelId() {
    const saved = localStorage.getItem('gemini_model_id');
    if (saved) return saved.trim();
    return 'gemini-3.0-flash';
}

/**
 * Establece el modelo activo
 */
export function setActiveModelId(modelId) {
    if (modelId) {
        localStorage.setItem('gemini_model_id', modelId.trim());
    }
}

/**
 * Obtiene la lista dinámica de modelos para fallback evitando modelos obsoletos
 */
export function getDynamicFallbackModels() {
    try {
        const cached = localStorage.getItem('gemini_discovered_models');
        if (cached) {
            const list = JSON.parse(cached);
            if (Array.isArray(list) && list.length > 0) {
                return list;
            }
        }
    } catch (_) {}
    return FALLBACK_MODELS;
}

/**
 * Consulta a Google Gemini los modelos activos disponibles para la API Key
 */
export async function fetchLiveGeminiModels(apiKey = null) {
    const key = apiKey || getGeminiApiKey();
    if (!key) return [];
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        if (!res.ok) return [];
        const data = await res.json();
        if (!data.models || !Array.isArray(data.models)) return [];

        const activeModels = data.models
            .filter(m => {
                const methods = m.supportedGenerationMethods || [];
                return methods.includes('generateContent');
            })
            .map(m => {
                const cleanId = m.name.replace(/^models\//, '');
                return {
                    id: cleanId,
                    name: m.displayName ? `${m.displayName} (${cleanId})` : cleanId
                };
            })
            // Excluir familias discontinuadas (1.0, 1.5, bison, paLM)
            .filter(m => !m.id.includes('1.5') && !m.id.includes('1.0') && !m.id.includes('bison') && !m.id.includes('aqa'));

        if (activeModels.length > 0) {
            localStorage.setItem('gemini_discovered_models', JSON.stringify(activeModels.map(m => m.id)));
        }
        return activeModels;
    } catch (e) {
        console.warn('No se pudieron obtener modelos en vivo de Gemini:', e);
        return [];
    }
}

/**
 * Redimensiona una imagen para optimizar el envío por red (< 1200px)
 */
export async function optimizeImageFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const maxDim = 1200;
                let width = img.width;
                let height = img.height;

                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                const base64Data = dataUrl.split(',')[1];
                resolve({ base64Data, mimeType: 'image/jpeg', dataUrl });
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Escanea códigos de barras nativamente si la API del navegador está disponible
 */
export async function tryNativeBarcodeDetection(dataUrl) {
    if (!('BarcodeDetector' in window)) return null;

    try {
        const formats = await window.BarcodeDetector.getSupportedFormats();
        if (!formats || formats.length === 0) return null;

        const detector = new window.BarcodeDetector({ formats });
        const img = new Image();
        img.src = dataUrl;
        await new Promise(r => img.onload = r);

        const barcodes = await detector.detect(img);
        if (barcodes && barcodes.length > 0) {
            const first = barcodes[0];
            let symbology = 'CODE128';
            const fmt = (first.format || '').toLowerCase();
            if (fmt.includes('ean_13')) symbology = 'EAN13';
            else if (fmt.includes('ean_8')) symbology = 'EAN8';
            else if (fmt.includes('qr')) symbology = 'QR';
            else if (fmt.includes('upc')) symbology = 'UPC';
            else if (fmt.includes('code_39')) symbology = 'CODE39';

            return {
                code: first.rawValue,
                symbology
            };
        }
    } catch (e) {
        console.warn('BarcodeDetector no detectó código o no compatible:', e);
    }
    return null;
}

/**
 * Llama a la API de Google Gemini Multimodal con arquitectura dinámica
 */
export async function analyzeProductImageWithGemini(base64Data, mimeType, requestedModel = null) {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
        throw new Error('API_KEY_MISSING');
    }

    const modelToUse = requestedModel || getActiveModelId();

    const systemPrompt = `Eres un sistema experto de digitalización y punto de venta para etiquetas térmicas comerciales.
Analiza la imagen adjunta (que puede ser un producto físico, caja, ropa, etiqueta de góndola, código de barras o comprobante).
Extrae los siguientes datos en formato JSON estricto:
- title: Nombre legible del producto (marca + descripción clara, máximo 35 caracteres).
- code: Número del código de barras (EAN-13, SKU, UPC, etc.) o número identificador que aparezca bajo las barras o en la etiqueta. Si no hay código identificable, genera un SKU numérico sugerido coherente.
- symbology: Uno de estos valores exactos: ["EAN13", "CODE128", "EAN8", "UPC", "CODE39", "QR"]. Si el código tiene 13 dígitos numéricos usa "EAN13", si tiene 8 usa "EAN8", sino "CODE128".
- price: Valor numérico del precio (ejemplo "4500" o "1250.00"). No incluyas símbolo monetario ni letras. Si no aparece precio, déjalo como "".
- currency: Símbolo o moneda identificada (ej: "$", "U$S", "€", "ARS"). Por defecto "$".
- extra: Texto adicional relevante si existe (ej: talle, peso "500g", lote, vencimiento o eslogan comercial corto). Si no hay, déjalo como "".

Responde ÚNICAMENTE con el objeto JSON válido, sin texto adicional ni bloques markdown.`;

    const requestBody = {
        contents: [
            {
                role: 'user',
                parts: [
                    { text: systemPrompt },
                    {
                        inlineData: {
                            mimeType: mimeType || 'image/jpeg',
                            data: base64Data
                        }
                    }
                ]
            }
        ],
        generationConfig: {
            temperature: 0.1,
            topP: 0.95,
            responseMimeType: 'application/json'
        }
    };

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`;

    let response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

    // Cascada de modelos activos si el modelo seleccionado no existe (404)
    if (!response.ok && response.status === 404) {
        const fallbacks = getDynamicFallbackModels().filter(fb => fb !== modelToUse);
        for (const fallback of fallbacks) {
            console.warn(`Modelo ${modelToUse} no disponible (404). Intentando fallback con ${fallback}...`);
            const fallbackEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${fallback}:generateContent?key=${apiKey}`;
            const fbResponse = await fetch(fallbackEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            if (fbResponse.ok) {
                response = fbResponse;
                break;
            }
        }
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg = errorData?.error?.message || `HTTP ${response.status} ${response.statusText}`;
        throw new Error(`Error de Gemini API: ${msg}`);
    }

    const data = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
        throw new Error('La IA no devolvió respuesta para esta imagen');
    }

    // Parsear JSON limpio de forma resiliente
    let cleanJson = candidateText.trim();
    if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```/, '').replace(/```$/, '').trim();
    }

    let parsed = {};
    try {
        parsed = JSON.parse(cleanJson);
    } catch (_) {
        const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                parsed = JSON.parse(jsonMatch[0]);
            } catch (err) {
                console.warn('No se pudo parsear el bloque JSON extraído:', err);
            }
        }
    }

    return {
        title: parsed.title || '',
        code: parsed.code || '',
        symbology: parsed.symbology || 'CODE128',
        price: parsed.price || '',
        currency: parsed.currency || '$',
        extra: parsed.extra || ''
    };
}

/**
 * Aplica los datos reconocidos al formulario de Etiqueta Única
 */
export function applyAiDataToSingleLabel(data) {
    if (!data) return;

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el && val !== undefined) el.value = val;
    };

    if (data.title) setVal('inp-title', data.title);
    if (data.code) setVal('inp-code', data.code);
    if (data.symbology) setVal('inp-symbology', data.symbology);
    if (data.price !== undefined) setVal('inp-price', data.price);
    if (data.currency) setVal('inp-currency', data.currency);
    if (data.extra) setVal('inp-extra', data.extra);

    updatePreview();
    triggerCloudSave();
    showToast(`¡Campos autocompletados con IA con éxito!`, 'success');
}
