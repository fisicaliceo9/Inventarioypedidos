window.ViewsInventory = (() => {
  const { escapeHtml, driveThumbUrl, statusBadgeClass, formatUbicacion, openModal, closeModal, showToast, compressImageFile, normText } = window.Utils;

  const ui = {
    type: 'material', // 'material' | 'herramienta'
    search: '',
    category: 'Todas',
    onlyLowStock: false
  };

  function getList(state) {
    return ui.type === 'herramienta' ? (state.herramientas || []) : (state.materiales || []);
  }

  function render(container, app) {
    const state = app.state;
    const isPrep = app.isPreparador();
    const umbral = Number((state.config && state.config.stock_bajo_umbral) || 2);
    const allItems = getList(state);

    const catField = ui.type === 'herramienta' ? 'Categoria' : 'REF_categoria';
    const nameField = ui.type === 'herramienta' ? 'Herramienta' : 'Material';
    const idField = ui.type === 'herramienta' ? 'ID_herramienta' : 'ID_material';

    const catsSet = new Set();
    (state.listas && state.listas.Categorias || []).forEach((c) => catsSet.add(c));
    allItems.forEach((it) => { if (it[catField]) catsSet.add(it[catField]); });
    const cats = ['Todas', ...Array.from(catsSet).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))];

    const q = normText(ui.search);
    const filtered = allItems.filter((it) => {
      if (ui.category !== 'Todas' && String(it[catField] || '') !== ui.category) return false;
      if (ui.onlyLowStock && Number(it.Cantidad_disponible || 0) > umbral) return false;
      if (!q) return true;
      const hay = normText(
        `${it[idField]} ${it[nameField]} ${it[catField]} ${it.Codigo_inventario} ${it.Armario} ${it.Puerta} ${it.Estante} ${it.Caja} ${it.Observaciones}`
      );
      return hay.includes(q);
    });

    container.innerHTML = `
      <div class="search-bar">
        <div class="search-row">
          <input id="inv-search" type="search" placeholder="Buscar material, código, armario..." value="${escapeHtml(ui.search)}" />
          ${isPrep ? `<button id="btn-new-item" class="btn btn-primary btn-sm">+ Nuevo</button>` : ''}
        </div>
        <div class="chips" style="margin-bottom:6px">
          <button class="chip ${ui.type === 'material' ? 'active' : ''}" data-type="material">Materiales (${(state.materiales || []).length})</button>
          <button class="chip ${ui.type === 'herramienta' ? 'active' : ''}" data-type="herramienta">Herramientas (${(state.herramientas || []).length})</button>
          ${isPrep ? `<button class="chip ${ui.onlyLowStock ? 'active' : ''}" id="chip-low">Bajo stock (≤${umbral})</button>` : ''}
        </div>
        <div style="margin-top:4px">
          <select id="inv-cat-select" aria-label="Filtrar por categoría" style="padding:9px 12px;font-size:0.92rem">
            ${cats.map((c) => `<option value="${escapeHtml(c)}" ${ui.category === c ? 'selected' : ''}>${c === 'Todas' ? 'Categoría: Todas' : escapeHtml(c)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="muted" style="margin:0 0 8px 2px;font-size:0.82rem">
        Mostrando <strong>${filtered.length}</strong> de ${allItems.length} ${ui.type === 'herramienta' ? 'herramientas' : 'materiales'}
      </div>

      ${filtered.length === 0
        ? `<div class="empty-state card">No se encontraron ítems con esos filtros.</div>`
        : `<div class="item-grid">
            ${filtered.slice(0, 120).map((it) => renderCard(it, idField, nameField, catField, umbral, isPrep)).join('')}
          </div>`
      }
      ${filtered.length > 120 ? `<div class="muted" style="text-align:center;margin-top:10px">Mostrando los primeros 120 resultados. Refina tu búsqueda para ver más.</div>` : ''}
      ${isPrep ? `<button id="fab-new-item" class="fab" title="Cargar nuevo material">+</button>` : ''}
    `;

    // Listeners
    const searchEl = document.getElementById('inv-search');
    searchEl.addEventListener('input', (e) => {
      ui.search = e.target.value;
      render(container, app);
      const next = document.getElementById('inv-search');
      if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); }
    });

    container.querySelectorAll('[data-type]').forEach((btn) => {
      btn.addEventListener('click', () => {
        ui.type = btn.dataset.type;
        ui.category = 'Todas';
        render(container, app);
      });
    });

    const chipLow = document.getElementById('chip-low');
    if (chipLow) {
      chipLow.addEventListener('click', () => {
        ui.onlyLowStock = !ui.onlyLowStock;
        render(container, app);
      });
    }

    document.getElementById('inv-cat-select').addEventListener('change', (e) => {
      ui.category = e.target.value;
      render(container, app);
    });

    const openNew = () => openItemForm(null, ui.type, app);
    const btnNew = document.getElementById('btn-new-item');
    const fabNew = document.getElementById('fab-new-item');
    if (btnNew) btnNew.addEventListener('click', openNew);
    if (fabNew) fabNew.addEventListener('click', openNew);

    container.querySelectorAll('[data-detail]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.dataset.detail;
        const item = allItems.find((x) => String(x[idField]) === id);
        if (item) openItemDetail(item, ui.type, app);
      });
    });

    container.querySelectorAll('[data-edit]').forEach((el) => {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const id = el.dataset.edit;
        const item = allItems.find((x) => String(x[idField]) === id);
        if (item) openItemForm(item, ui.type, app);
      });
    });

    container.querySelectorAll('[data-add-cart]').forEach((el) => {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const id = el.dataset.addCart;
        const item = allItems.find((x) => String(x[idField]) === id);
        if (item) {
          app.addToCart({
            id: item[idField],
            codigo: item.Codigo_inventario || item[idField],
            nombre: item[nameField],
            tipoItem: ui.type,
            disponible: Number(item.Cantidad_disponible || 0)
          });
        }
      });
    });
  }

  function renderCard(it, idField, nameField, catField, umbral, isPrep) {
    const id = it[idField];
    const disp = Number(it.Cantidad_disponible || 0);
    const total = Number(it.Cantidad_total || 0);
    const thumb = driveThumbUrl(it.Foto, 240);
    const stockBadge = disp <= 0 ? 'badge-danger' : (disp <= umbral ? 'badge-warn' : 'badge-ok');

    return `
      <article class="item-card" data-detail="${escapeHtml(id)}" style="cursor:pointer">
        <div class="item-thumb">
          ${thumb ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy" onerror="this.remove()" />` : '🔬'}
        </div>
        <div class="item-body">
          <div class="item-top">
            <h3 class="item-name">${escapeHtml(it[nameField])}</h3>
            <span class="badge ${stockBadge}">${disp}/${total}</span>
          </div>
          <div class="item-meta">
            <strong>${escapeHtml(id)}</strong> · ${escapeHtml(it[catField] || 'Sin categoría')}<br/>
            📍 ${escapeHtml(formatUbicacion(it))} · <span class="badge ${statusBadgeClass(it.Estado)}">${escapeHtml(it.Estado || 'Bueno')}</span>
          </div>
          ${isPrep ? `
          <div class="item-actions">
            <button class="btn btn-primary btn-sm" data-add-cart="${escapeHtml(id)}" ${disp <= 0 ? 'disabled' : ''}>+ Pedir</button>
            <button class="btn btn-outline btn-sm" data-edit="${escapeHtml(id)}">Editar</button>
          </div>` : ''}
        </div>
      </article>
    `;
  }

  function openItemDetail(it, tipoItem, app) {
    const isHerr = tipoItem === 'herramienta';
    const id = isHerr ? it.ID_herramienta : it.ID_material;
    const nombre = isHerr ? it.Herramienta : it.Material;
    const cat = isHerr ? it.Categoria : it.REF_categoria;
    const photo = driveThumbUrl(it.Foto, 800);
    const qrUrl = it.QR_url || `https://quickchart.io/qr?size=220&margin=1&text=${encodeURIComponent('APP_FICHA_' + tipoItem + '_' + id)}`;
    const isPrep = app.isPreparador();

    openModal(`${id} — ${nombre}`, `
      ${photo ? `<div style="text-align:center;margin-bottom:12px"><img src="${escapeHtml(photo)}" style="max-width:100%;max-height:260px;border-radius:12px;object-fit:contain" /></div>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <span class="badge badge-info">${escapeHtml(cat || 'Sin categoría')}</span>
        <span class="badge ${statusBadgeClass(it.Estado)}">${escapeHtml(it.Estado || 'Bueno')}</span>
        <span class="badge badge-ok">Disponible: ${escapeHtml(it.Cantidad_disponible || 0)} / ${escapeHtml(it.Cantidad_total || 0)}</span>
      </div>
      <div class="card" style="background:#f8fafc;box-shadow:none">
        <div><strong>Ubicación:</strong> ${escapeHtml(formatUbicacion(it))}</div>
        ${it.Observaciones_ubicacion ? `<div><strong>Nota ubicación:</strong> ${escapeHtml(it.Observaciones_ubicacion)}</div>` : ''}
        ${it.Descripcion ? `<div style="margin-top:6px"><strong>Descripción:</strong> ${escapeHtml(it.Descripcion)}</div>` : ''}
        ${it.Observaciones ? `<div style="margin-top:6px"><strong>Observaciones:</strong> ${escapeHtml(it.Observaciones)}</div>` : ''}
        <div class="muted" style="margin-top:6px">Actualizado: ${escapeHtml(it.Fecha_actualizacion || '-')}</div>
      </div>
      <div style="text-align:center;margin:12px 0">
        <img src="${escapeHtml(qrUrl)}" alt="QR" style="width:130px;height:130px;border:1px solid var(--border);border-radius:10px;padding:4px" />
        <div class="muted" style="font-size:0.78rem">Código QR · ${escapeHtml(id)}</div>
      </div>
      ${isPrep ? `
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button id="det-add-cart" class="btn btn-primary" style="flex:1" ${Number(it.Cantidad_disponible || 0) <= 0 ? 'disabled' : ''}>+ Agregar a pedido</button>
        <button id="det-edit" class="btn btn-outline">Editar</button>
        <button id="det-ab" class="btn btn-secondary">Alta / Baja</button>
      </div>` : ''}
    `);

    const detAdd = document.getElementById('det-add-cart');
    if (detAdd) {
      detAdd.addEventListener('click', () => {
        app.addToCart({
          id,
          codigo: it.Codigo_inventario || id,
          nombre,
          tipoItem,
          disponible: Number(it.Cantidad_disponible || 0)
        });
        closeModal();
      });
    }

    const editBtn = document.getElementById('det-edit');
    if (editBtn) {
      editBtn.addEventListener('click', () => openItemForm(it, tipoItem, app));
    }

    const abBtn = document.getElementById('det-ab');
    if (abBtn) {
      abBtn.addEventListener('click', () => {
        closeModal();
        app.navigate('stock', { preselectId: id, preselectType: tipoItem });
      });
    }
  }

  function openItemForm(existing, tipoItem, app) {
    const isHerr = tipoItem === 'herramienta';
    const id = existing ? (isHerr ? existing.ID_herramienta : existing.ID_material) : '';
    const nombre = existing ? (isHerr ? existing.Herramienta : existing.Material) : '';
    const cat = existing ? (isHerr ? existing.Categoria : existing.REF_categoria) : '';
    const cats = ((app.state.listas && app.state.listas.Categorias) || ['Mecánica', 'Electricidad', 'Magnetismo', 'Óptica', 'Ondas', 'Termodinámica', 'Medición', 'Instrumentos en general', 'Herramientas']).slice().sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    const estados = (app.state.listas && app.state.listas.Estados) || ['Bueno', 'Regular', 'Malo', 'Reparar', 'Faltante', 'Baja', 'Sin revisar'];
    const previewUrl = existing && existing.Foto ? driveThumbUrl(existing.Foto, 500) : '';

    let pendingPhoto = null;

    openModal(existing ? `Editar ${id}` : `Nuevo ${isHerr ? 'herramienta' : 'material'}`, `
      <form id="item-form">
        <div class="field">
          <label>Fotografía <span class="muted">(se guarda en Drive fisicaliceo9@gmail.com)</span></label>
          <div class="photo-box">
            <img id="photo-preview" class="photo-preview ${previewUrl ? '' : 'hidden'}" src="${escapeHtml(previewUrl)}" alt="Vista previa" />
            <div class="photo-btns">
              <label class="btn btn-primary btn-sm" style="cursor:pointer">
                📷 Sacar foto
                <input id="input-camera" type="file" accept="image/*" capture="environment" class="hidden" />
              </label>
              <label class="btn btn-outline btn-sm" style="cursor:pointer">
                🖼️ Galería
                <input id="input-gallery" type="file" accept="image/*" class="hidden" />
              </label>
            </div>
            <div id="photo-status" class="muted" style="margin-top:6px;font-size:0.78rem">
              ${previewUrl ? 'Foto actual cargada. Puedes reemplazarla.' : 'Opcional: toma una foto con la cámara del celular.'}
            </div>
          </div>
        </div>

        <div class="field">
          <label for="f-nombre">Nombre del ${isHerr ? 'herramienta' : 'material'} *</label>
          <input id="f-nombre" type="text" required value="${escapeHtml(nombre)}" placeholder="Ej. Dinamómetro 5N" />
        </div>

        <div class="grid-2">
          <div class="field">
            <label for="f-cat">Categoría</label>
            <select id="f-cat">
              <option value="">Seleccionar...</option>
              ${cats.map((c) => `<option value="${escapeHtml(c)}" ${c === cat ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="f-estado">Estado</label>
            <select id="f-estado">
              ${estados.map((e) => `<option value="${escapeHtml(e)}" ${(existing ? existing.Estado : 'Bueno') === e ? 'selected' : ''}>${escapeHtml(e)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="grid-2">
          <div class="field">
            <label for="f-total">Cantidad total *</label>
            <input id="f-total" type="number" min="0" required value="${escapeHtml(existing ? existing.Cantidad_total : '1')}" />
          </div>
          <div class="field">
            <label for="f-disp">Disponible *</label>
            <input id="f-disp" type="number" min="0" required value="${escapeHtml(existing ? existing.Cantidad_disponible : '1')}" />
          </div>
        </div>

        <div class="grid-3">
          <div class="field">
            <label for="f-armario">Armario / Puerta</label>
            <input id="f-armario" type="text" value="${escapeHtml(existing ? (existing.Armario || existing.Puerta || '') : '')}" placeholder="Ej. 6" />
          </div>
          <div class="field">
            <label for="f-estante">Estante</label>
            <input id="f-estante" type="text" value="${escapeHtml(existing ? existing.Estante : '')}" placeholder="Ej. 2" />
          </div>
          <div class="field">
            <label for="f-caja">Caja</label>
            <input id="f-caja" type="text" value="${escapeHtml(existing ? existing.Caja : '')}" placeholder="Ej. A" />
          </div>
        </div>

        <div class="field">
          <label for="f-obs">Observaciones</label>
          <textarea id="f-obs" placeholder="Detalles técnicos, estado, accesorios...">${escapeHtml(existing ? existing.Observaciones : '')}</textarea>
        </div>

        <div class="field">
          <label for="f-activo">Activo en catálogo</label>
          <select id="f-activo">
            <option value="Sí" ${(!existing || existing.Activo !== 'No') ? 'selected' : ''}>Sí</option>
            <option value="No" ${(existing && existing.Activo === 'No') ? 'selected' : ''}>No (oculto a docentes)</option>
          </select>
        </div>

        <button id="btn-save-item" type="submit" class="btn btn-primary btn-block">
          ${existing ? 'Guardar cambios' : 'Cargar al inventario'}
        </button>
      </form>
    `);

    const handleFile = async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const status = document.getElementById('photo-status');
      status.textContent = 'Comprimiendo foto para subida rápida...';
      try {
        pendingPhoto = await compressImageFile(file, 1280, 0.78);
        const img = document.getElementById('photo-preview');
        img.src = pendingPhoto.base64;
        img.classList.remove('hidden');
        const kb = Math.round((pendingPhoto.base64.length * 0.75) / 1024);
        status.textContent = `Foto lista (${kb} KB). Se guardará en Google Drive.`;
      } catch (err) {
        status.textContent = err.message;
      }
    };

    document.getElementById('input-camera').addEventListener('change', handleFile);
    document.getElementById('input-gallery').addEventListener('change', handleFile);

    // Sincronizar disponible con total al crear nuevo
    if (!existing) {
      document.getElementById('f-total').addEventListener('input', (e) => {
        document.getElementById('f-disp').value = e.target.value;
      });
    }

    document.getElementById('item-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const btn = document.getElementById('btn-save-item');
      btn.disabled = true;
      btn.textContent = pendingPhoto ? 'Subiendo foto y guardando...' : 'Guardando...';
      try {
        const res = await window.API.call(isHerr ? 'saveHerramienta' : 'saveMaterial', {
          payload: {
            id,
            nombre: document.getElementById('f-nombre').value.trim(),
            categoria: document.getElementById('f-cat').value,
            estado: document.getElementById('f-estado').value,
            cantidadTotal: Number(document.getElementById('f-total').value || 0),
            cantidadDisponible: Number(document.getElementById('f-disp').value || 0),
            armario: document.getElementById('f-armario').value.trim(),
            puerta: document.getElementById('f-armario').value.trim(),
            estante: document.getElementById('f-estante').value.trim(),
            caja: document.getElementById('f-caja').value.trim(),
            observaciones: document.getElementById('f-obs').value.trim(),
            activo: document.getElementById('f-activo').value,
            fotoBase64: pendingPhoto ? pendingPhoto.base64 : '',
            fotoMime: pendingPhoto ? pendingPhoto.mime : ''
          }
        });
        if (!res.ok) throw new Error(res.error || 'Error al guardar');
        closeModal();
        showToast(existing ? 'Ítem actualizado' : `Cargado como ${res.id}`);
        await app.sync(true);
      } catch (err) {
        showToast(err.message);
        btn.disabled = false;
        btn.textContent = existing ? 'Guardar cambios' : 'Cargar al inventario';
      }
    });
  }

  return { render, openItemDetail, openItemForm };
})();
