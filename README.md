# PrintLabel Pro (Printblue) 🏷️

Generador y gestor interactivo de etiquetas de código de barras y códigos QR optimizado para **impresoras térmicas de rollo** e **impresoras Bluetooth**.

Desarrollado como una **Progressive Web App (PWA)** autónoma: funciona 100% offline, se puede instalar en dispositivos móviles y de escritorio, y no requiere backend ni base de datos externa.

---

## 🚀 Características Principales

* **Generador de Etiqueta Única**:
  * Título de producto, código (SKU / EAN / UPC), precio y texto secundario o lote.
  * Múltiples simbologías: **Code 128**, **EAN-13**, **EAN-8**, **UPC-A**, **Code 39** y **Código QR**.
  * Selector de cantidad de copias con controles rápidos (+ / -).
  * Opciones visuales (mostrar/ocultar título, precio destacado, etc.).
  * Vista previa milimétrica proporcional en tiempo real.

* **Impresión por Lotes (Batch)**:
  * Tabla editable para cargar múltiples productos.
  * Impresión continua secuencial de toda la tira de etiquetas.

* **Formatos y Tamaños de Papel**:
  * Presets estándar: **50x30 mm**, **40x25 mm**, **58x40 mm** y **rollo continuo de 58 mm**.
  * Dimensiones milimétricas, márgenes (padding) y tamaño tipográfico 100% personalizables.
  * Persistencia en almacenamiento local (`localStorage`).

* **PWA & Offline First**:
  * **Service Worker (`sw.js`)**: Guarda en caché local recursos críticos y librerías CDN para operar sin conexión a internet.
  * Instalable en Android, iOS, Windows y macOS como app nativa sin barra de navegación.
  * Detección automática de estado Online / Offline.

* **Impresión Precisa**:
  * Reglas CSS `@media print` y saltos de página automáticos para corte exacto en impresoras térmicas.
  * Soporte preliminar para emparejamiento Web Bluetooth SPP.

---

## 🛠️ Stack Tecnológico

* **HTML5 + CSS3 + Vanilla JavaScript**
* **Tailwind CSS** para la interfaz moderna y reactiva.
* **JsBarcode** para códigos de barras 1D.
* **QRCode.js** para códigos 2D.
* **FontAwesome 6** para iconografía.

---

## 📦 Despliegue en Vercel

Este proyecto está listo para desplegarse como sitio estático en [Vercel](https://vercel.com):

1. Conecta tu repositorio de GitHub `Printblue` en Vercel.
2. Framework Preset: **Other**.
3. Root Directory: `./`
4. ¡Listo! Vercel aplicará automáticamente los encabezados de `vercel.json` para el Service Worker.
