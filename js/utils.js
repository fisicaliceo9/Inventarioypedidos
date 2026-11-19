window.Utils = (() => {
  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function driveThumbUrl(url, size = 400) {
    if (!url) return '';
    const s = String(url).trim();
    const m1 = s.match(/\/d\/([a-zA-Z0-9_-]{15,})/);
    const m2 = s.match(/[?&]id=([a-zA-Z0-9_-]{15,})/);
    const id = (m1 && m1[1]) || (m2 && m2[1]);
    if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w${size}`;
    return s;
  }

  function statusBadgeClass(status) {
    const s = String(status || '').toLowerCase();
    if (['bueno', 'disponible', 'activo', 'devuelto', 'aprobado', 'preparado', 'alta'].includes(s)) return 'badge-ok';
    if (['regular', 'pendiente', 'en uso', 'en reparación', 'reparar', 'sin revisar'].includes(s)) return 'badge-warn';
    if (['malo', 'baja', 'faltante', 'dado de baja', 'dada de baja', 'agotado', 'rechazado', 'cancelado', 'inactivo', 'extraviada'].includes(s)) return 'badge-danger';
    if (['entregado', 'préstamo', 'solicitado'].includes(s)) return 'badge-info';
    return 'badge-neutral';
  }

  function formatUbicacion(item) {
    const parts = [];
    const arm = item.Armario || item.Puerta;
    if (arm) parts.push(`Arm. ${arm}`);
    if (item.Estante) parts.push(`Est. ${item.Estante}`);
    if (item.Caja) parts.push(`Caja ${item.Caja}`);
    return parts.join(' · ') || 'Sin ubicación';
  }

  let toastTimer = null;
  function showToast(msg, ms = 2800) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
  }

  function openModal(title, html) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = html;
    document.getElementById('modal-backdrop').classList.remove('hidden');
  }

  function closeModal() {
    document.getElementById('modal-backdrop').classList.add('hidden');
    document.getElementById('modal-body').innerHTML = '';
  }

  function compressImageFile(file, maxDim = 1280, quality = 0.78) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      reader.onload = (ev) => {
        const img = new Image();
        img.onerror = () => reject(new Error('Imagen no válida.'));
        img.onload = () => {
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w >= h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve({ base64: dataUrl, mime: 'image/jpeg' });
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
      reader.onload = () => resolve({ base64: reader.result, mime: file.type || 'application/octet-stream', name: file.name });
      reader.readAsDataURL(file);
    });
  }

  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('No se pudo cargar ' + src));
      document.head.appendChild(s);
    });
  }

  async function exportToXlsx(state) {
    showToast('Generando archivo Excel...');
    await loadScriptOnce('https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js');
    const wb = window.XLSX.utils.book_new();
    const addSheet = (name, rows) => {
      const ws = window.XLSX.utils.json_to_sheet(rows && rows.length ? rows : [{ Info: 'Sin registros' }]);
      window.XLSX.utils.book_append_sheet(wb, ws, name);
    };
    addSheet('Materiales', state.materiales);
    addSheet('Herramientas', state.herramientas);
    addSheet('Pedidos', state.pedidos);
    addSheet('Altas_Bajas', state.altasBajas);
    addSheet('Movimientos', state.movimientos);
    addSheet('Mantenimiento', state.mantenimiento);
    const today = new Date().toISOString().slice(0, 10);
    window.XLSX.writeFile(wb, `Inventario_Lab_Fisica_${today}.xlsx`);
    showToast('Excel descargado');
  }

  function normText(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  return {
    escapeHtml,
    driveThumbUrl,
    statusBadgeClass,
    formatUbicacion,
    showToast,
    openModal,
    closeModal,
    compressImageFile,
    fileToBase64,
    loadScriptOnce,
    exportToXlsx,
    normText
  };
})();
