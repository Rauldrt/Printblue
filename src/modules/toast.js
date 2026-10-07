/**
 * Sistema de Notificaciones Toast
 */
export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');

    let bgColor = 'bg-slate-800 text-white';
    if (type === 'success') bgColor = 'bg-emerald-600 text-white';
    if (type === 'error') bgColor = 'bg-rose-600 text-white';
    if (type === 'warning') bgColor = 'bg-amber-500 text-white';

    toast.className = `px-4 py-3 rounded-xl shadow-lg font-medium text-xs flex items-center space-x-2 transition-all transform translate-y-2 opacity-0 pointer-events-auto ${bgColor}`;
    toast.innerHTML = `
        <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-info')}"></i>
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
