window.API = (() => {
  const SESSION_KEY = 'lab_fisica_session_v2';

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function setSession(session) {
    if (!session) {
      localStorage.removeItem(SESSION_KEY);
    } else {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
  }

  function cacheKey(email) {
    return `lab_fisica_cache_v2_${String(email || '').toLowerCase()}`;
  }

  function getCachedBootstrap(email) {
    try {
      const raw = localStorage.getItem(cacheKey(email));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function setCachedBootstrap(email, data) {
    try {
      localStorage.setItem(cacheKey(email), JSON.stringify({ ts: Date.now(), data }));
    } catch {
      // Ignorar si excede cuota localStorage
    }
  }

  function clearCache(email) {
    if (email) localStorage.removeItem(cacheKey(email));
  }

  async function call(action, body = {}) {
    const url = window.APP_CONFIG && window.APP_CONFIG.API_URL;
    if (!url) throw new Error('Falta configurar API_URL en config.js');

    const session = getSession();
    const payload = {
      action,
      token: session ? session.token : '',
      ...body
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });

    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(
        'El Apps Script no devolvió JSON válido. Verifica que Api.gs esté desplegado como Aplicación web (Cualquier persona).'
      );
    }

    if (json.unauthorized) {
      setSession(null);
      window.dispatchEvent(new CustomEvent('lab:unauthorized'));
    }
    return json;
  }

  return {
    getSession,
    setSession,
    getCachedBootstrap,
    setCachedBootstrap,
    clearCache,
    call
  };
})();
