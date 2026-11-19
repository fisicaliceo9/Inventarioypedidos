window.ViewsOrders = (() => {
  const { escapeHtml, statusBadgeClass, openModal, closeModal, showToast, fileToBase64 } = window.Utils;

  const ui = { filterStatus: 'Todos' };

  function renderCart(container, app) {
    const cart = app.cart;
    const turnos = (app.state.listas && app.state.listas.Turnos) || ['Matutino', 'Vespertino', 'Nocturno', 'Otro'];
    const tiposUso = (app.state.listas && app.state.listas.Tipos_uso) || ['Laboratorio', 'Salón'];
    const today = new Date().toISOString().slice(0, 10);
    let pendingProto = null;

    container.innerHTML = `
      <div class="section-header">
        <h2>Nuevo Pedido</h2>
        ${cart.length ? `<button id="btn-clear-cart" class="btn btn-outline btn-sm">Vaciar</button>` : ''}
      </div>

      <div class="card">
        <h3 style="margin:0 0 10px">Materiales seleccionados (${cart.length})</h3>
        ${cart.length === 0
          ? `<div class="muted">Aún no agregaste materiales desde el inventario. Puedes agregar ítems o describir lo que necesitas abajo.</div>`
          : cart.map((c, idx) => `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
              <div style="min-width:0;flex:1">
                <div style="font-weight:600">${escapeHtml(c.nombre)}</div>
                <div class="muted" style="font-size:0.78rem">${escapeHtml(c.id)} · Disp: ${c.disponible}</div>
              </div>
              <div class="stepper">
                <button type="button" data-dec="${idx}">−</button>
                <span>${c.cantidad}</span>
                <button type="button" data-inc="${idx}">+</button>
              </div>
            </div>`).join('')
        }
      </div>

      <div class="card">
        <form id="form-order">
          <div class="grid-2">
            <div class="field">
              <label for="o-uso">Tipo de uso</label>
              <select id="o-uso">
                ${tiposUso.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label for="o-turno">Turno</label>
              <select id="o-turno">
                ${turnos.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="grid-2">
            <div class="field">
              <label for="o-grupo">Grupo *</label>
              <input id="o-grupo" type="text" required placeholder="Ej. 3CV1" />
            </div>
            <div class="field">
              <label for="o-act">Actividad / Práctica *</label>
              <input id="o-act" type="text" required placeholder="Ej. Ley de Ohm" />
            </div>
          </div>

          <div class="grid-2">
            <div class="field">
              <label for="o-ini">Fecha inicio *</label>
              <input id="o-ini" type="date" required value="${today}" />
            </div>
            <div class="field">
              <label for="o-fin">Fecha fin</label>
              <input id="o-fin" type="date" value="${today}" />
            </div>
          </div>

          <div class="field">
            <label for="o-obs">Observaciones / materiales adicionales</label>
            <textarea id="o-obs" placeholder="Aclara detalles del armado o materiales que no encontraste en el catálogo..."></textarea>
          </div>

          <div class="field">
            <label for="o-proto">Adjuntar protocolo (PDF, Word o imagen · opcional)</label>
            <input id="o-proto" type="file" accept=".pdf,.doc,.docx,image/*" />
            <div id="o-proto-info" class="muted" style="font-size:0.78rem;margin-top:4px"></div>
          </div>

          <button id="btn-submit-order" type="submit" class="btn btn-primary btn-block">Enviar pedido al laboratorio</button>
        </form>
      </div>
    `;

    const clearBtn = document.getElementById('btn-clear-cart');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        app.cart = [];
        app.updateNavBadges();
        renderCart(container, app);
      });
    }

    container.querySelectorAll('[data-dec]').forEach((b) => {
      b.addEventListener('click', () => {
        const idx = Number(b.dataset.dec);
        if (app.cart[idx].cantidad > 1) app.cart[idx].cantidad--;
        else app.cart.splice(idx, 1);
        app.updateNavBadges();
        renderCart(container, app);
      });
    });

    container.querySelectorAll('[data-inc]').forEach((b) => {
      b.addEventListener('click', () => {
        const idx = Number(b.dataset.inc);
        if (app.cart[idx].cantidad < (app.cart[idx].disponible || 999)) {
          app.cart[idx].cantidad++;
        }
        app.updateNavBadges();
        renderCart(container, app);
      });
    });

    document.getElementById('o-proto').addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0];
      const info = document.getElementById('o-proto-info');
      if (!f) { pendingProto = null; info.textContent = ''; return; }
      if (f.size > 5 * 1024 * 1024) {
        info.textContent = 'El archivo supera 5 MB. Por favor elige uno más liviano.';
        pendingProto = null;
        return;
      }
      pendingProto = await fileToBase64(f);
      info.textContent = `Listo para subir a Drive: ${f.name} (${Math.round(f.size / 1024)} KB)`;
    });

    document.getElementById('form-order').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const btn = document.getElementById('btn-submit-order');
      btn.disabled = true;
      btn.textContent = 'Enviando pedido...';
      try {
        const res = await window.API.call('createOrder', {
          payload: {
            items: app.cart,
            tipoUso: document.getElementById('o-uso').value,
            turno: document.getElementById('o-turno').value,
            grupo: document.getElementById('o-grupo').value.trim(),
            actividad: document.getElementById('o-act').value.trim(),
            fechaInicio: document.getElementById('o-ini').value,
            fechaFin: document.getElementById('o-fin').value,
            observaciones: document.getElementById('o-obs').value.trim(),
            protocoloBase64: pendingProto ? pendingProto.base64 : '',
            protocoloMime: pendingProto ? pendingProto.mime : '',
            protocoloNombre: pendingProto ? pendingProto.name : ''
          }
        });
        if (!res.ok) throw new Error(res.error || 'No se pudo enviar el pedido');
        app.cart = [];
        app.updateNavBadges();
        showToast(`Pedido ${res.idPedido} enviado`);
        await app.sync(true);
        app.navigate('orders');
      } catch (err) {
        showToast(err.message);
        btn.disabled = false;
        btn.textContent = 'Enviar pedido al laboratorio';
      }
    });
  }

  function renderOrders(container, app) {
    const isPrep = app.isPreparador();
    const pedidos = (app.state.pedidos || []).slice().reverse();
    const itemsAll = app.state.itemsPedido || [];
    const statuses = ['Todos', 'Pendiente', 'Aprobado', 'Preparado', 'Entregado', 'Devuelto', 'Rechazado'];

    const filtered = ui.filterStatus === 'Todos'
      ? pedidos
      : pedidos.filter((p) => String(p.Estado || '') === ui.filterStatus);

    container.innerHTML = `
      <div class="section-header">
        <h2>${isPrep ? 'Gestión de Pedidos' : 'Mis Pedidos'}</h2>
        <button id="btn-go-cart" class="btn btn-primary btn-sm">+ Nuevo pedido</button>
      </div>

      <div class="chips" style="margin-bottom:12px">
        ${statuses.map((s) => `<button class="chip ${ui.filterStatus === s ? 'active' : ''}" data-st="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('')}
      </div>

      ${filtered.length === 0
        ? `<div class="card empty-state">No hay pedidos en este estado.</div>`
        : filtered.map((p) => {
            const pItems = itemsAll.filter((it) => String(it.ID_pedido) === String(p.ID_pedido));
            return `
              <div class="card">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
                  <div>
                    <strong>${escapeHtml(p.ID_pedido)} · ${escapeHtml(p.Actividad || 'Sin título')}</strong>
                    <div class="muted" style="font-size:0.8rem">
                      ${escapeHtml(p.Solicitante_nombre)} (${escapeHtml(p.Turno || '-')} · Grupo ${escapeHtml(p.Grupo || '-')})
                    </div>
                  </div>
                  <span class="badge ${statusBadgeClass(p.Estado)}">${escapeHtml(p.Estado)}</span>
                </div>
                <div class="muted" style="font-size:0.82rem;margin-top:6px">
                  📍 ${escapeHtml(p.Tipo_uso || 'Laboratorio')} · 📅 ${escapeHtml(p.Fecha_inicio_estimada || p.Fecha_uso || '-')} a ${escapeHtml(p.Fecha_fin_estimada || '-')}
                </div>
                ${pItems.length ? `
                  <ul style="margin:8px 0 6px;padding-left:18px;font-size:0.86rem">
                    ${pItems.map((it) => `<li><strong>${escapeHtml(it.Cantidad_solicitada)}x</strong> ${escapeHtml(it.Material_snapshot)}</li>`).join('')}
                  </ul>` : ''}
                ${p.Observaciones_docente ? `<div style="font-size:0.86rem;margin-top:4px"><em>Docente:</em> ${escapeHtml(p.Observaciones_docente)}</div>` : ''}
                ${p.Respuesta_preparador ? `<div style="font-size:0.86rem;margin-top:4px;color:var(--primary-dark)"><em>Preparador:</em> ${escapeHtml(p.Respuesta_preparador)}</div>` : ''}
                ${p.Protocolo_url ? `<div style="margin-top:6px"><a href="${escapeHtml(p.Protocolo_url)}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">📄 Ver protocolo</a></div>` : ''}
                ${isPrep ? `<div style="margin-top:10px"><button class="btn btn-primary btn-sm" data-manage-order="${escapeHtml(p.ID_pedido)}">Gestionar estado</button></div>` : ''}
              </div>`;
          }).join('')
      }
    `;

    document.getElementById('btn-go-cart').addEventListener('click', () => app.navigate('cart'));

    container.querySelectorAll('[data-st]').forEach((b) => {
      b.addEventListener('click', () => {
        ui.filterStatus = b.dataset.st;
        renderOrders(container, app);
      });
    });

    container.querySelectorAll('[data-manage-order]').forEach((b) => {
      b.addEventListener('click', () => {
        const p = pedidos.find((x) => String(x.ID_pedido) === b.dataset.manageOrder);
        if (p) openManageOrderModal(p, app);
      });
    });
  }

  function openManageOrderModal(p, app) {
    const estados = (app.state.listas && app.state.listas.Estados_pedido) || [
      'Pendiente', 'Aprobado', 'Preparado', 'Entregado', 'Devuelto', 'Rechazado', 'Cancelado', 'Cerrado'
    ];
    openModal(`Gestionar ${p.ID_pedido}`, `
      <form id="form-manage-order">
        <div class="muted" style="margin-bottom:10px">
          <strong>${escapeHtml(p.Solicitante_nombre)}</strong> · ${escapeHtml(p.Actividad || '-')}<br/>
          Stock descontado actualmente: <strong>${escapeHtml(p.Stock_descontado || 'No')}</strong>
        </div>
        <div class="field">
          <label for="mo-estado">Nuevo estado</label>
          <select id="mo-estado">
            ${estados.map((e) => `<option value="${escapeHtml(e)}" ${e === p.Estado ? 'selected' : ''}>${escapeHtml(e)}</option>`).join('')}
          </select>
          <div class="muted" style="font-size:0.78rem;margin-top:4px">
            Al pasar a <strong>Entregado</strong> se descuenta el stock disponible automáticamente; al pasar a <strong>Devuelto</strong> se restituye.
          </div>
        </div>
        <div class="field">
          <label for="mo-resp">Respuesta al docente (se envía por email)</label>
          <textarea id="mo-resp">${escapeHtml(p.Respuesta_preparador || '')}</textarea>
        </div>
        <div class="field">
          <label for="mo-int">Observaciones internas (solo preparadores)</label>
          <textarea id="mo-int">${escapeHtml(p.Observaciones_internas || '')}</textarea>
        </div>
        <button id="btn-save-order-st" type="submit" class="btn btn-primary btn-block">Actualizar pedido</button>
      </form>
    `);

    document.getElementById('form-manage-order').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const btn = document.getElementById('btn-save-order-st');
      btn.disabled = true;
      btn.textContent = 'Actualizando...';
      try {
        const res = await window.API.call('updateOrderStatus', {
          payload: {
            idPedido: p.ID_pedido,
            estado: document.getElementById('mo-estado').value,
            respuesta: document.getElementById('mo-resp').value.trim(),
            observacionesInternas: document.getElementById('mo-int').value.trim()
          }
        });
        if (!res.ok) throw new Error(res.error || 'Error');
        closeModal();
        showToast(`Pedido ${p.ID_pedido} → ${res.estado}`);
        await app.sync(true);
      } catch (err) {
        showToast(err.message);
        btn.disabled = false;
        btn.textContent = 'Actualizar pedido';
      }
    });
  }

  return { renderCart, renderOrders };
})();
