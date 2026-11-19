(() => {
  const { showToast, openModal, closeModal, loadScriptOnce } = window.Utils;

  const app = {
    session: null,
    state: {
      materiales: [],
      herramientas: [],
      pedidos: [],
      itemsPedido: [],
      movimientos: [],
      altasBajas: [],
      mantenimiento: [],
      usuarios: [],
      listas: {},
      config: {}
    },
    cart: [],
    currentTab: 'inventory',
    tabParams: {},

    isPreparador() {
      const r = this.session && this.session.user && this.session.user.rol;
      return r === 'preparador' || r === 'admin';
    },

    addToCart(item) {
      const existing = this.cart.find((c) => c.id === item.id && c.tipoItem === item.tipoItem);
      if (existing) {
        if (existing.cantidad < (item.disponible || 999)) existing.cantidad++;
      } else {
        this.cart.push({ ...item, cantidad: 1 });
      }
      this.updateNavBadges();
      showToast(`Agregado: ${item.nombre}`);
    },

    navigate(tab, params = {}) {
      this.currentTab = tab;
      this.tabParams = params;
      this.renderNav();
      this.renderCurrentView();
      window.scrollTo({ top: 0, behavior: 'instant' });
    },

    renderNav() {
      const nav = document.getElementById('bottom-nav');
      const isPrep = this.isPreparador();
      const cartCount = this.cart.reduce((s, c) => s + c.cantidad, 0);
      const pendOrders = (this.state.pedidos || []).filter((p) => p.Estado === 'Pendiente').length;
      const pendUsers = (this.state.usuarios || []).filter((u) => String(u.Estado_usuario || '').toLowerCase() === 'pendiente').length;

      const items = isPrep
        ? [
            { id: 'inventory', label: 'Inventario', icon: '📦' },
            { id: 'stock', label: 'Altas/Bajas', icon: '⇅' },
            { id: 'orders', label: 'Pedidos', icon: '📋', badge: pendOrders },
            { id: 'cart', label: 'Pedir', icon: '🛒', badge: cartCount },
            { id: 'admin', label: 'Admin', icon: '⚙️', badge: pendUsers }
          ]
        : [
            { id: 'inventory', label: 'Inventario', icon: '📦' },
            { id: 'cart', label: 'Nuevo Pedido', icon: '🛒', badge: cartCount },
            { id: 'orders', label: 'Mis Pedidos', icon: '📋' }
          ];

      nav.innerHTML = items.map((it) => `
        <button class="nav-item ${this.currentTab === it.id ? 'active' : ''}" data-nav="${it.id}">
          <span style="font-size:1.2rem;line-height:1">${it.icon}</span>
          <span>${it.label}</span>
          ${it.badge ? `<span class="nav-badge">${it.badge}</span>` : ''}
        </button>
      `).join('');

      nav.querySelectorAll('[data-nav]').forEach((b) => {
        b.addEventListener('click', () => this.navigate(b.dataset.nav));
      });
    },

    updateNavBadges() {
      this.renderNav();
    },

    renderCurrentView() {
      const main = document.getElementById('main-content');
      if (this.currentTab === 'inventory') window.ViewsInventory.render(main, this);
      else if (this.currentTab === 'stock' && this.isPreparador()) window.ViewsStock.render(main, this, this.tabParams);
      else if (this.currentTab === 'cart') window.ViewsOrders.renderCart(main, this);
      else if (this.currentTab === 'orders') window.ViewsOrders.renderOrders(main, this);
      else if (this.currentTab === 'admin' && this.isPreparador()) window.ViewsAdmin.render(main, this, this.tabParams);
      else window.ViewsInventory.render(main, this);
    },

    async sync(silent = false) {
      const banner = document.getElementById('sync-banner');
      if (!silent) banner.classList.remove('hidden');
      try {
        const res = await window.API.call('bootstrap');
        if (!res.ok) throw new Error(res.error || 'Error al sincronizar');
        this.state = {
          materiales: res.materiales || [],
          herramientas: res.herramientas || [],
          pedidos: res.pedidos || [],
          itemsPedido: res.itemsPedido || [],
          movimientos: res.movimientos || [],
          altasBajas: res.altasBajas || [],
          mantenimiento: res.mantenimiento || [],
          usuarios: res.usuarios || [],
          listas: res.listas || {},
          config: res.config || {}
        };
        if (this.session && this.session.user) {
          window.API.setCachedBootstrap(this.session.user.email, this.state);
        }
        this.renderNav();
        this.renderCurrentView();
      } catch (err) {
        showToast(err.message);
      } finally {
        banner.classList.add('hidden');
      }
    },

    enterApp(session) {
      this.session = session;
      document.getElementById('auth-screen').classList.add('hidden');
      document.getElementById('app-shell').classList.remove('hidden');
      document.getElementById('topbar-user').textContent = `${session.user.nombre} · ${session.user.rol}`;

      // Carga instantánea desde caché local del celular
      const cached = window.API.getCachedBootstrap(session.user.email);
      if (cached && cached.data) {
        this.state = cached.data;
        this.renderNav();
        this.renderCurrentView();
        this.sync(true); // Refresco silencioso en segundo plano
      } else {
        this.renderNav();
        document.getElementById('main-content').innerHTML = `<div class="card empty-state">Cargando inventario del laboratorio...</div>`;
        this.sync(false);
      }
    },

    logout() {
      if (this.session && this.session.user) {
        window.API.clearCache(this.session.user.email);
      }
      window.API.setSession(null);
      this.session = null;
      this.cart = [];
      document.getElementById('app-shell').classList.add('hidden');
      document.getElementById('auth-screen').classList.remove('hidden');
    }
  };

  /* ================= QR SCANNER (CÁMARA DEL CELULAR) ================= */
  async function openQrScanner() {
    openModal('Escanear código QR', `
      <div id="qr-reader" style="width:100%;border-radius:12px;overflow:hidden"></div>
      <p class="muted" style="text-align:center;margin-top:8px">Apunta la cámara a la etiqueta QR del material.</p>
    `);
    let scanner = null;
    try {
      await loadScriptOnce('https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js');
      scanner = new window.Html5Qrcode('qr-reader');
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          scanner.stop().catch(() => {});
          closeModal();
          handleQrDecoded(decodedText);
        }
      );
      const origClose = document.getElementById('modal-close').onclick;
      document.getElementById('modal-close').onclick = () => {
        scanner.stop().catch(() => {});
        if (origClose) origClose();
        else closeModal();
      };
    } catch (err) {
      document.getElementById('qr-reader').innerHTML = `<div class="alert alert-error">No se pudo acceder a la cámara: ${err.message || err}</div>`;
    }
  }

  function handleQrDecoded(text) {
    const m = String(text || '').match(/(MAT-\d+|HER-\d+)/i);
    if (!m) {
      showToast('QR leído: ' + text);
      return;
    }
    const id = m[1].toUpperCase();
    const mat = (app.state.materiales || []).find((x) => String(x.ID_material).toUpperCase() === id);
    if (mat) return window.ViewsInventory.openItemDetail(mat, 'material', app);
    const her = (app.state.herramientas || []).find((x) => String(x.ID_herramienta).toUpperCase() === id);
    if (her) return window.ViewsInventory.openItemDetail(her, 'herramienta', app);
    showToast(`No se encontró ${id} en el inventario`);
  }

  /* ================= AUTH UI ================= */
  function initAuth() {
    const tabLogin = document.getElementById('tab-login');
    const tabReg = document.getElementById('tab-register');
    const formLogin = document.getElementById('form-login');
    const formReg = document.getElementById('form-register');
    const loginMsg = document.getElementById('login-msg');
    const regMsg = document.getElementById('reg-msg');

    const showAlert = (el, text, kind = 'error') => {
      el.textContent = text;
      el.className = `alert alert-${kind}`;
    };

    tabLogin.addEventListener('click', () => {
      tabLogin.classList.add('active');
      tabReg.classList.remove('active');
      formLogin.classList.remove('hidden');
      formReg.classList.add('hidden');
    });

    tabReg.addEventListener('click', () => {
      tabReg.classList.add('active');
      tabLogin.classList.remove('active');
      formReg.classList.remove('hidden');
      formLogin.classList.add('hidden');
    });

    formLogin.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      loginMsg.classList.add('hidden');
      const btn = document.getElementById('btn-login');
      btn.disabled = true;
      btn.textContent = 'Verificando...';
      try {
        const res = await window.API.call('login', {
          email: document.getElementById('login-email').value.trim(),
          pin: document.getElementById('login-pin').value.trim()
        });
        if (!res.ok) {
          showAlert(loginMsg, res.error || 'No se pudo iniciar sesión.', res.pending ? 'warn' : 'error');
          return;
        }
        const session = { token: res.token, user: res.user };
        window.API.setSession(session);
        app.enterApp(session);
      } catch (err) {
        showAlert(loginMsg, err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Ingresar';
      }
    });

    formReg.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      regMsg.classList.add('hidden');
      const btn = document.getElementById('btn-register');
      btn.disabled = true;
      btn.textContent = 'Enviando solicitud...';
      try {
        const res = await window.API.call('registerTeacher', {
          email: document.getElementById('reg-email').value.trim(),
          nombre: document.getElementById('reg-nombre').value.trim(),
          apellido: document.getElementById('reg-apellido').value.trim()
        });
        if (!res.ok) {
          showAlert(regMsg, res.error || 'No se pudo enviar la solicitud.', res.pending ? 'warn' : 'error');
          return;
        }
        showAlert(regMsg, res.message, 'ok');
        formReg.reset();
      } catch (err) {
        showAlert(regMsg, err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Solicitar alta de docente';
      }
    });
  }

  /* ================= BOOT ================= */
  document.addEventListener('DOMContentLoaded', () => {
    initAuth();

    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-backdrop').addEventListener('click', (e) => {
      if (e.target.id === 'modal-backdrop') closeModal();
    });
    document.getElementById('btn-sync').addEventListener('click', () => app.sync(false));
    document.getElementById('btn-logout').addEventListener('click', () => app.logout());
    document.getElementById('btn-scan-qr').addEventListener('click', openQrScanner);
    window.addEventListener('lab:unauthorized', () => app.logout());

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    const saved = window.API.getSession();
    if (saved && saved.token && saved.user) {
      app.enterApp(saved);
    }
  });
})();
