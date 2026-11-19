window.ViewsAdmin = (() => {
  const { escapeHtml, statusBadgeClass, showToast, exportToXlsx, normText } = window.Utils;

  const ui = {
    subtab: 'usuarios', // 'usuarios' | 'qr' | 'dashboard'
    qrSearch: '',
    qrSize: '3 cm x 3 cm',
    qrSelected: new Set()
  };

  function render(container, app, params = {}) {
    if (params.subtab) ui.subtab = params.subtab;

    const pendingUsers = (app.state.usuarios || []).filter((u) => String(u.Estado_usuario || '').toLowerCase() === 'pendiente').length;

    container.innerHTML = `
      <div class="section-header">
        <h2>Administración del Laboratorio</h2>
      </div>
      <div class="chips" style="margin-bottom:12px">
        <button class="chip ${ui.subtab === 'usuarios' ? 'active' : ''}" data-asub="usuarios">
          Usuarios ${pendingUsers ? `(${pendingUsers} pend.)` : ''}
        </button>
        <button class="chip ${ui.subtab === 'qr' ? 'active' : ''}" data-asub="qr">Etiquetas QR</button>
        <button class="chip ${ui.subtab === 'dashboard' ? 'active' : ''}" data-asub="dashboard">Estadísticas y Excel</button>
      </div>
      <div id="admin-body"></div>
    `;

    container.querySelectorAll('[data-asub]').forEach((b) => {
      b.addEventListener('click', () => {
        ui.subtab = b.dataset.asub;
        render(container, app);
      });
    });

    const body = document.getElementById('admin-body');
    if (ui.subtab === 'usuarios') renderUsuarios(body, app);
    else if (ui.subtab === 'qr') renderQr(body, app);
    else renderDashboard(body, app);
  }

  function renderUsuarios(body, app) {
    const users = (app.state.usuarios || []).slice().sort((a, b) => {
      const pa = String(a.Estado_usuario || '').toLowerCase() === 'pendiente' ? 0 : 1;
      const pb = String(b.Estado_usuario || '').toLowerCase() === 'pendiente' ? 0 : 1;
      return pa - pb;
    });

    body.innerHTML = users.length === 0
      ? `<div class="card empty-state">Sin usuarios registrados.</div>`
      : users.map((u) => {
          const st = String(u.Estado_usuario || 'activo').toLowerCase();
          const fullName = `${u.Nombre || ''} ${u.Apellido || ''}`.trim() || u.Email;
          return `
            <div class="card">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
                <div>
                  <strong>${escapeHtml(fullName)}</strong>
                  <div class="muted" style="font-size:0.82rem">${escapeHtml(u.Email)} · Rol: <strong>${escapeHtml(u.Rol)}</strong></div>
                </div>
                <span class="badge ${statusBadgeClass(st)}">${escapeHtml(st)}</span>
              </div>
              ${u.Observaciones ? `<div class="muted" style="font-size:0.8rem;margin-top:4px">${escapeHtml(u.Observaciones)}</div>` : ''}
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
                ${st !== 'activo' ? `<button class="btn btn-success btn-sm" data-uact="activar" data-uemail="${escapeHtml(u.Email)}">✓ Aprobar / Activar</button>` : ''}
                ${st === 'activo' && String(u.Rol).toLowerCase() === 'docente' ? `<button class="btn btn-outline btn-sm" data-uact="desactivar" data-uemail="${escapeHtml(u.Email)}">Desactivar</button>` : ''}
              </div>
            </div>`;
        }).join('');

    body.querySelectorAll('[data-uact]').forEach((b) => {
      b.addEventListener('click', async () => {
        const email = b.dataset.uemail;
        const activar = b.dataset.uact === 'activar';
        b.disabled = true;
        try {
          const res = await window.API.call('updateUser', {
            payload: {
              email,
              estadoUsuario: activar ? 'activo' : 'inactivo'
            }
          });
          if (!res.ok) throw new Error(res.error || 'Error');
          showToast(activar ? `Usuario ${email} aprobado` : `Usuario ${email} desactivado`);
          await app.sync(true);
        } catch (err) {
          showToast(err.message);
          b.disabled = false;
        }
      });
    });
  }

  function renderQr(body, app) {
    const mats = app.state.materiales || [];
    const tamanos = (app.state.listas && app.state.listas.Tamanos_etiqueta) || ['1,5 cm x 1,5 cm', '3 cm x 3 cm', '5 cm x 5 cm'];
    const q = normText(ui.qrSearch);
    const filtered = q
      ? mats.filter((m) => normText(`${m.ID_material} ${m.Material} ${m.Armario}`).includes(q))
      : mats;

    body.innerHTML = `
      <div class="card">
        <div class="grid-2" style="align-items:end">
          <div class="field" style="margin:0">
            <label for="qr-size">Tamaño de etiqueta</label>
            <select id="qr-size">
              ${tamanos.map((t) => `<option value="${escapeHtml(t)}" ${t === ui.qrSize ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}
            </select>
          </div>
          <button id="btn-print-qr" class="btn btn-primary" ${ui.qrSelected.size === 0 ? 'disabled' : ''}>
            🖨️ Imprimir / PDF (${ui.qrSelected.size})
          </button>
        </div>
        <div class="field" style="margin:10px 0 0">
          <input id="qr-search" type="search" placeholder="Buscar materiales para etiquetar..." value="${escapeHtml(ui.qrSearch)}" />
        </div>
      </div>

      <div class="card" style="padding:8px 12px">
        ${filtered.slice(0, 80).map((m) => {
          const checked = ui.qrSelected.has(m.ID_material);
          return `
            <label style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer">
              <input type="checkbox" data-qrid="${escapeHtml(m.ID_material)}" ${checked ? 'checked' : ''} />
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:0.9rem">${escapeHtml(m.Material)}</div>
                <div class="muted" style="font-size:0.78rem">${escapeHtml(m.ID_material)} · Arm. ${escapeHtml(m.Armario || m.Puerta || '-')}</div>
              </div>
            </label>`;
        }).join('')}
      </div>
    `;

    document.getElementById('qr-size').addEventListener('change', (e) => {
      ui.qrSize = e.target.value;
    });

    document.getElementById('qr-search').addEventListener('input', (e) => {
      ui.qrSearch = e.target.value;
      renderQr(body, app);
      const next = document.getElementById('qr-search');
      if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); }
    });

    body.querySelectorAll('[data-qrid]').forEach((cb) => {
      cb.addEventListener('change', () => {
        if (cb.checked) ui.qrSelected.add(cb.dataset.qrid);
        else ui.qrSelected.delete(cb.dataset.qrid);
        const btn = document.getElementById('btn-print-qr');
        btn.disabled = ui.qrSelected.size === 0;
        btn.textContent = `🖨️ Imprimir / PDF (${ui.qrSelected.size})`;
      });
    });

    document.getElementById('btn-print-qr').addEventListener('click', async () => {
      const selectedItems = mats.filter((m) => ui.qrSelected.has(m.ID_material));
      if (!selectedItems.length) return;

      const dimMm = ui.qrSize.startsWith('1,5') ? 18 : (ui.qrSize.startsWith('5') ? 50 : 32);
      const printArea = document.getElementById('print-area');
      printArea.innerHTML = selectedItems.map((m) => {
        const ficha = m.Enlace_ficha || `APP_FICHA_material_${m.ID_material}`;
        const qr = m.QR_url || `https://quickchart.io/qr?size=220&margin=1&text=${encodeURIComponent(ficha)}`;
        return `
          <div class="qr-label-box" style="width:${dimMm}mm;height:${dimMm}mm">
            <img src="${escapeHtml(qr)}" alt="QR" />
            <div class="qr-label-code">${escapeHtml(m.ID_material)}</div>
            <div class="qr-label-name">${escapeHtml(m.Material)}</div>
          </div>`;
      }).join('');

      // Registrar lote en Google Sheets en segundo plano
      window.API.call('logEtiquetas', {
        payload: {
          tamano: ui.qrSize,
          items: selectedItems.map((m) => ({
            id: m.ID_material,
            codigo: m.Codigo_inventario || m.ID_material,
            nombre: m.Material,
            tipoItem: 'material',
            qrUrl: m.QR_url || '',
            enlaceFicha: m.Enlace_ficha || '',
            puerta: m.Puerta || m.Armario || '',
            estante: m.Estante || '',
            caja: m.Caja || ''
          }))
        }
      }).catch(() => {});

      showToast('Preparando hoja imprimible...');
      setTimeout(() => window.print(), 450);
    });
  }

  function renderDashboard(body, app) {
    const s = app.state;
    const umbral = Number((s.config && s.config.stock_bajo_umbral) || 2);
    const mats = s.materiales || [];
    const pedidos = s.pedidos || [];
    const lowStock = mats.filter((m) => Number(m.Cantidad_disponible || 0) <= umbral).length;
    const pendOrders = pedidos.filter((p) => String(p.Estado) === 'Pendiente').length;
    const pendUsers = (s.usuarios || []).filter((u) => String(u.Estado_usuario || '').toLowerCase() === 'pendiente').length;

    body.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-val">${mats.length}</div>
          <div class="kpi-label">Materiales</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-val" style="color:var(--warn)">${lowStock}</div>
          <div class="kpi-label">Bajo stock (≤${umbral})</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-val" style="color:var(--accent)">${pendOrders}</div>
          <div class="kpi-label">Pedidos pendientes</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-val" style="color:var(--danger)">${pendUsers}</div>
          <div class="kpi-label">Usuarios a validar</div>
        </div>
      </div>

      <div class="card">
        <h3 style="margin:0 0 8px">Exportar inventario completo</h3>
        <p class="help-text">Descarga al instante un archivo Excel (.xlsx) con Materiales, Herramientas, Pedidos, Altas/Bajas, Movimientos y Mantenimiento.</p>
        <button id="btn-export-xlsx" class="btn btn-primary btn-block">📥 Descargar Excel (.xlsx)</button>
      </div>
    `;

    document.getElementById('btn-export-xlsx').addEventListener('click', () => {
      exportToXlsx(app.state).catch((err) => showToast(err.message));
    });
  }

  return { render };
})();
