window.ViewsStock = (() => {
  const { escapeHtml, statusBadgeClass, showToast, normText } = window.Utils;

  const ui = {
    subtab: 'altas_bajas', // 'altas_bajas' | 'movimientos' | 'mantenimiento'
    tipo: 'Alta',
    tipoItem: 'material',
    searchItem: '',
    selectedId: ''
  };

  function render(container, app, params = {}) {
    if (params.preselectId) {
      ui.selectedId = params.preselectId;
      ui.tipoItem = params.preselectType || 'material';
      ui.subtab = 'altas_bajas';
    }

    container.innerHTML = `
      <div class="section-header">
        <h2>Altas, Bajas y Movimientos</h2>
      </div>
      <div class="chips" style="margin-bottom:12px">
        <button class="chip ${ui.subtab === 'altas_bajas' ? 'active' : ''}" data-sub="altas_bajas">Altas / Bajas</button>
        <button class="chip ${ui.subtab === 'movimientos' ? 'active' : ''}" data-sub="movimientos">Movimientos (${(app.state.movimientos || []).length})</button>
        <button class="chip ${ui.subtab === 'mantenimiento' ? 'active' : ''}" data-sub="mantenimiento">Mantenimiento (${(app.state.mantenimiento || []).length})</button>
      </div>
      <div id="stock-body"></div>
    `;

    container.querySelectorAll('[data-sub]').forEach((b) => {
      b.addEventListener('click', () => {
        ui.subtab = b.dataset.sub;
        render(container, app);
      });
    });

    const body = document.getElementById('stock-body');
    if (ui.subtab === 'altas_bajas') renderAltasBajas(body, app);
    else if (ui.subtab === 'movimientos') renderMovimientos(body, app);
    else renderMantenimiento(body, app);
  }

  function renderAltasBajas(body, app) {
    const isHerr = ui.tipoItem === 'herramienta';
    const list = isHerr ? (app.state.herramientas || []) : (app.state.materiales || []);
    const idField = isHerr ? 'ID_herramienta' : 'ID_material';
    const nameField = isHerr ? 'Herramienta' : 'Material';
    const q = normText(ui.searchItem);
    const filtered = q
      ? list.filter((x) => normText(`${x[idField]} ${x[nameField]}`).includes(q))
      : list;

    const history = (app.state.altasBajas || []).slice().reverse();

    body.innerHTML = `
      <div class="card">
        <h3 style="margin:0 0 10px">Registrar Alta o Baja de stock</h3>
        <div class="auth-tabs" style="margin-bottom:12px">
          <button type="button" class="auth-tab ${ui.tipo === 'Alta' ? 'active' : ''}" data-ab-tipo="Alta">➕ Alta (sumar)</button>
          <button type="button" class="auth-tab ${ui.tipo === 'Baja' ? 'active' : ''}" data-ab-tipo="Baja">➖ Baja (restar)</button>
        </div>

        <form id="form-ab">
          <div class="grid-2">
            <div class="field">
              <label>Tipo de ítem</label>
              <select id="ab-tipo-item">
                <option value="material" ${!isHerr ? 'selected' : ''}>Material</option>
                <option value="herramienta" ${isHerr ? 'selected' : ''}>Herramienta</option>
              </select>
            </div>
            <div class="field">
              <label for="ab-cant">Cantidad *</label>
              <input id="ab-cant" type="number" min="1" value="1" required />
            </div>
          </div>

          <div class="field">
            <label for="ab-filter">Filtrar ítem rápido</label>
            <input id="ab-filter" type="search" placeholder="Escribe para filtrar la lista..." value="${escapeHtml(ui.searchItem)}" />
          </div>

          <div class="field">
            <label for="ab-item">Seleccionar ítem *</label>
            <select id="ab-item" required>
              <option value="">-- Seleccionar --</option>
              ${filtered.map((it) => `
                <option value="${escapeHtml(it[idField])}" ${it[idField] === ui.selectedId ? 'selected' : ''}>
                  ${escapeHtml(it[idField])} — ${escapeHtml(it[nameField])} (Disp: ${it.Cantidad_disponible || 0}/${it.Cantidad_total || 0})
                </option>`).join('')}
            </select>
          </div>

          <div class="field">
            <label for="ab-motivo">Motivo *</label>
            <input id="ab-motivo" type="text" required placeholder="${ui.tipo === 'Alta' ? 'Ej. Compra proveeduría / Donación' : 'Ej. Rotura en práctica / Extravío'}" />
          </div>

          <div class="field">
            <label for="ab-obs">Observaciones</label>
            <textarea id="ab-obs" placeholder="Detalles adicionales..."></textarea>
          </div>

          ${ui.tipo === 'Baja' ? `
            <label style="display:flex;align-items:center;gap:8px;margin-bottom:12px;font-size:0.88rem">
              <input id="ab-definitiva" type="checkbox" />
              Dar de baja definitiva si el stock llega a 0
            </label>` : ''}

          <button id="btn-save-ab" type="submit" class="btn ${ui.tipo === 'Alta' ? 'btn-success' : 'btn-danger'} btn-block">
            Registrar ${ui.tipo}
          </button>
        </form>
      </div>

      <h3 style="margin:14px 0 8px">Historial reciente de Altas y Bajas</h3>
      ${history.length === 0
        ? `<div class="card empty-state">Sin registros todavía.</div>`
        : history.slice(0, 40).map((h) => `
          <div class="card" style="padding:11px 14px">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
              <strong>${escapeHtml(h.Material || h.ID_material)}</strong>
              <span class="badge ${statusBadgeClass(h.Tipo)}">${escapeHtml(h.Tipo)} (${escapeHtml(h.Cantidad)})</span>
            </div>
            <div class="muted" style="font-size:0.82rem;margin-top:4px">
              ${escapeHtml(h.Fecha)} · ${escapeHtml(h.ID_material)} · Stock: ${escapeHtml(h.Cantidad_total_anterior)} → <strong>${escapeHtml(h.Cantidad_total_nueva)}</strong>
            </div>
            ${h.Motivo ? `<div style="font-size:0.86rem;margin-top:4px">${escapeHtml(h.Motivo)}</div>` : ''}
          </div>`).join('')
      }
    `;

    body.querySelectorAll('[data-ab-tipo]').forEach((b) => {
      b.addEventListener('click', () => {
        ui.tipo = b.dataset.abTipo;
        renderAltasBajas(body, app);
      });
    });

    document.getElementById('ab-tipo-item').addEventListener('change', (e) => {
      ui.tipoItem = e.target.value;
      ui.selectedId = '';
      renderAltasBajas(body, app);
    });

    document.getElementById('ab-filter').addEventListener('input', (e) => {
      ui.searchItem = e.target.value;
      renderAltasBajas(body, app);
      const next = document.getElementById('ab-filter');
      if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); }
    });

    document.getElementById('form-ab').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const btn = document.getElementById('btn-save-ab');
      btn.disabled = true;
      btn.textContent = 'Registrando...';
      try {
        const res = await window.API.call('registerAltaBaja', {
          payload: {
            tipo: ui.tipo,
            tipoItem: ui.tipoItem,
            idItem: document.getElementById('ab-item').value,
            cantidad: Number(document.getElementById('ab-cant').value || 1),
            motivo: document.getElementById('ab-motivo').value.trim(),
            observaciones: document.getElementById('ab-obs').value.trim(),
            darDeBajaDefinitiva: !!(document.getElementById('ab-definitiva') && document.getElementById('ab-definitiva').checked)
          }
        });
        if (!res.ok) throw new Error(res.error || 'Error al registrar');
        showToast(`${ui.tipo} registrada · Stock nuevo: ${res.cantidadTotalNueva}`);
        ui.selectedId = '';
        await app.sync(true);
      } catch (err) {
        showToast(err.message);
        btn.disabled = false;
        btn.textContent = `Registrar ${ui.tipo}`;
      }
    });
  }

  function renderMovimientos(body, app) {
    const movs = (app.state.movimientos || []).slice().reverse();
    body.innerHTML = movs.length === 0
      ? `<div class="card empty-state">Sin movimientos registrados.</div>`
      : movs.slice(0, 60).map((m) => `
        <div class="card" style="padding:11px 14px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
            <strong>${escapeHtml(m.Material || m.ID_material)}</strong>
            <span class="badge ${statusBadgeClass(m.Tipo)}">${escapeHtml(m.Tipo)} (${escapeHtml(m.Cantidad)})</span>
          </div>
          <div class="muted" style="font-size:0.82rem;margin-top:4px">
            ${escapeHtml(m.Fecha)} · ${escapeHtml(m.ID_movimiento)} ${m.ID_pedido ? '· Pedido ' + escapeHtml(m.ID_pedido) : ''}
          </div>
          ${m.Observaciones ? `<div style="font-size:0.86rem;margin-top:4px">${escapeHtml(m.Observaciones)}</div>` : ''}
        </div>`).join('');
  }

  function renderMantenimiento(body, app) {
    const list = (app.state.mantenimiento || []).slice().reverse();
    const mats = app.state.materiales || [];

    body.innerHTML = `
      <div class="card">
        <h3 style="margin:0 0 10px">Nuevo reporte de mantenimiento</h3>
        <form id="form-mnt">
          <div class="field">
            <label for="mnt-item">Material *</label>
            <select id="mnt-item" required>
              <option value="">-- Seleccionar material --</option>
              ${mats.map((m) => `<option value="${escapeHtml(m.ID_material)}" data-name="${escapeHtml(m.Material)}">${escapeHtml(m.ID_material)} — ${escapeHtml(m.Material)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="mnt-prob">Problema detectado *</label>
            <textarea id="mnt-prob" required placeholder="Ej. Cable suelto, falta calibrar..."></textarea>
          </div>
          <button id="btn-save-mnt" type="submit" class="btn btn-primary btn-block">Registrar mantenimiento</button>
        </form>
      </div>

      ${list.length === 0
        ? `<div class="card empty-state">No hay reportes de mantenimiento.</div>`
        : list.map((r) => `
          <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <strong>${escapeHtml(r.Material)} (${escapeHtml(r.ID_material)})</strong>
              <span class="badge ${statusBadgeClass(r.Estado)}">${escapeHtml(r.Estado)}</span>
            </div>
            <div class="muted" style="font-size:0.82rem;margin:4px 0">${escapeHtml(r.Fecha)} · ${escapeHtml(r.ID_mantenimiento)}</div>
            <div>${escapeHtml(r.Problema)}</div>
            ${r.Resolucion ? `<div class="muted" style="margin-top:4px">Resolución: ${escapeHtml(r.Resolucion)}</div>` : ''}
          </div>`).join('')
      }
    `;

    document.getElementById('form-mnt').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const sel = document.getElementById('mnt-item');
      const opt = sel.options[sel.selectedIndex];
      const btn = document.getElementById('btn-save-mnt');
      btn.disabled = true;
      try {
        const res = await window.API.call('saveMantenimiento', {
          payload: {
            idItem: sel.value,
            nombre: opt ? opt.dataset.name : '',
            problema: document.getElementById('mnt-prob').value.trim(),
            estado: 'En reparación'
          }
        });
        if (!res.ok) throw new Error(res.error || 'Error');
        showToast('Mantenimiento registrado');
        await app.sync(true);
      } catch (err) {
        showToast(err.message);
        btn.disabled = false;
      }
    });
  }

  return { render };
})();
