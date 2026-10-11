/**
 * Sistema de Notificaciones Toast
 */
export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');

    let bgColor = 'bg-slate-900/95 text-white border-slate-700/80';
    if (type === 'success') bgColor = 'bg-emerald-700/95 text-white border-emerald-500/60';
    if (type === 'error') bgColor = 'bg-rose-700/95 text-white border-rose-500/60';
    if (type === 'warning') bgColor = 'bg-amber-600/95 text-white border-amber-400/60';

    toast.className = `px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md border font-semibold text-xs flex items-center space-x-2.5 transition-all duration-300 transform translate-y-2 opacity-0 pointer-events-auto ${bgColor}`;
    toast.innerHTML = `
        <i class="fa-solid ${type === 'success' ? 'fa-circle-check text-emerald-300' : (type === 'error' ? 'fa-triangle-exclamation text-rose-300' : (type === 'warning' ? 'fa-circle-exclamation text-amber-200' : 'fa-circle-info text-indigo-300'))} text-sm"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
