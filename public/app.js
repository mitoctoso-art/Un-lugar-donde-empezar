/* =========================================================
   Cliente que habla con el servidor (server.js) vía fetch.
   Todo lo que ves aquí depende de una cuenta real guardada
   en el servidor (data/db.json), no en el navegador.
   ========================================================= */

let currentUser = null;
let authMode = 'login'; // 'login' | 'register'

/* ---------- utilidades ---------- */

async function api(path, options = {}) {
  let res;
  try {
    res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      ...options
    });
  } catch (networkErr) {
    const err = new Error('No se pudo conectar con el servidor.');
    err.network = true;
    throw err;
  }

  let data = {};
  try {
    data = await res.json();
  } catch (parseErr) {
    // El servidor no respondió JSON. Suele pasar si esta página se abrió
    // con Live Server (u otro puerto) en vez de con "npm start".
    const err = new Error('El servidor no respondió correctamente.');
    err.network = true;
    throw err;
  }

  if (!res.ok) {
    const err = new Error(data.error || 'Error de red');
    err.data = data;
    throw err;
  }
  return data;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function networkMessage() {
  return 'No se pudo conectar con el servidor. Verifica que lo iniciaste con "npm start" en la terminal y que estás en http://localhost:3000 (no en Live Server ni abriendo el archivo directamente).';
}

function logButtonPress(action) {
  if (!currentUser) return;
  api('/api/actions', { method: 'POST', body: JSON.stringify({ action }) }).catch(() => {});
}

function closeSidePanels(exceptId) {
  ['historialPanel', 'changePwPanel', 'adminPanel'].forEach((id) => {
    if (id !== exceptId) document.getElementById(id).classList.remove('open');
  });
}

/* ---------- validación de contraseña (en vivo, en el formulario) ---------- */

function checkPasswordRules(password) {
  return {
    length: password.length >= 8,
    letter: /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ]/.test(password)
  };
}

function isStrongPasswordClient(password) {
  const r = checkPasswordRules(password);
  return r.length && r.letter && r.number && r.symbol;
}

function renderPasswordRules(password) {
  const rules = checkPasswordRules(password);
  document.querySelectorAll('#passwordRules li').forEach((li) => {
    const rule = li.dataset.rule;
    li.classList.toggle('rule-ok', !!rules[rule]);
  });
}

/* ---------- autenticación ---------- */

async function checkSession() {
  try {
    const data = await api('/api/me');
    enterApp(data.user, false);
  } catch (e) {
    if (e.network) {
      const warn = document.getElementById('connectionWarning');
      warn.textContent = networkMessage();
      warn.style.display = 'block';
    }
    showAuthScreen();
  }
}

function showAuthScreen() {
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('appContent').style.display = 'none';
}

function setAuthMode(mode) {
  authMode = mode;
  const title = document.getElementById('authTitle');
  const subtitle = document.getElementById('authSubtitle');
  const submitBtn = document.getElementById('authSubmitBtn');
  const switchBtn = document.getElementById('authSwitchBtn');
  const passwordInput = document.getElementById('passwordInput');
  const rulesList = document.getElementById('passwordRules');

  document.getElementById('authError').textContent = '';

  if (mode === 'login') {
    title.textContent = 'Iniciar sesión';
    subtitle.textContent = 'Ingresa con tu cuenta para participar en la comunidad.';
    submitBtn.textContent = 'Iniciar sesión';
    switchBtn.textContent = '¿No tienes cuenta? Crear una';
    passwordInput.autocomplete = 'current-password';
    rulesList.style.display = 'none';
  } else {
    title.textContent = 'Crear cuenta';
    subtitle.textContent = 'Elige un usuario y una contraseña. Solo tú los conoces.';
    submitBtn.textContent = 'Crear cuenta';
    switchBtn.textContent = '¿Ya tienes cuenta? Iniciar sesión';
    passwordInput.autocomplete = 'new-password';
    rulesList.style.display = 'block';
    renderPasswordRules(passwordInput.value);
  }
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('usernameInput').value.trim();
  const password = document.getElementById('passwordInput').value;
  const errorEl = document.getElementById('authError');
  errorEl.textContent = '';

  if (authMode === 'register' && !isStrongPasswordClient(password)) {
    errorEl.textContent = 'La contraseña debe tener 8+ caracteres, con letras, números y un símbolo.';
    return;
  }

  const endpoint = authMode === 'login' ? '/api/login' : '/api/register';
  try {
    const data = await api(endpoint, { method: 'POST', body: JSON.stringify({ username, password }) });
    enterApp(data.user, data.isNew);
  } catch (err) {
    if (err.network) {
      errorEl.textContent = networkMessage();
    } else {
      errorEl.textContent = (err.data && err.data.error) || 'No se pudo completar la acción.';
    }
  }
}

function enterApp(user, isNew) {
  currentUser = user;
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appContent').style.display = 'block';
  document.getElementById('userGreeting').textContent = isNew
    ? `Cuenta creada — bienvenido, ${user.username}`
    : `Bienvenido de nuevo, ${user.username}`;
  document.getElementById('usernameInput').value = '';
  document.getElementById('passwordInput').value = '';
  document.getElementById('toggleAdminBtn').style.display = user.role === 'admin' ? 'inline' : 'none';
  loadWall();
}

async function logout() {
  try {
    await api('/api/logout', { method: 'POST' });
  } catch (e) {
    /* seguimos igual */
  }
  currentUser = null;
  document.getElementById('historialPanel').classList.remove('open');
  document.getElementById('changePwPanel').classList.remove('open');
  document.getElementById('adminPanel').classList.remove('open');
  setAuthMode('login');
  showAuthScreen();
}

/* ---------- cambiar contraseña ---------- */

async function handleChangePassword(e) {
  e.preventDefault();
  const currentPassword = document.getElementById('currentPasswordInput').value;
  const newPassword = document.getElementById('newPasswordInput').value;
  const msgEl = document.getElementById('changePwMsg');
  msgEl.textContent = '';
  msgEl.style.color = '';

  if (!isStrongPasswordClient(newPassword)) {
    msgEl.textContent = 'La nueva contraseña debe tener 8+ caracteres, con letras, números y un símbolo.';
    return;
  }

  try {
    await api('/api/me/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword })
    });
    msgEl.style.color = 'var(--sage)';
    msgEl.textContent = 'Contraseña actualizada.';
    document.getElementById('currentPasswordInput').value = '';
    document.getElementById('newPasswordInput').value = '';
    logButtonPress('Botón: Cambiar contraseña');
  } catch (err) {
    msgEl.textContent = err.network ? networkMessage() : (err.data && err.data.error) || 'No se pudo actualizar.';
  }
}

/* ---------- panel de historial ---------- */

async function openHistorial() {
  closeSidePanels('historialPanel');
  const panel = document.getElementById('historialPanel');
  panel.classList.add('open');
  const listEl = document.getElementById('logList');
  const countEl = document.getElementById('logCount');
  listEl.innerHTML = '<li class="log-empty">Cargando…</li>';
  try {
    const data = await api('/api/me/logs');
    countEl.textContent = data.logs.length;
    if (data.logs.length === 0) {
      listEl.innerHTML = '<li class="log-empty">Todavía no hay pulsaciones registradas.</li>';
      return;
    }
    listEl.innerHTML = data.logs
      .map((entry) => {
        const date = new Date(entry.timestamp);
        return `<li><span class="log-action">${escapeHtml(entry.action)}</span><span class="log-time">${date.toLocaleString('es-PE')}</span></li>`;
      })
      .join('');
  } catch (e) {
    listEl.innerHTML = '<li class="log-empty">No se pudo cargar el historial.</li>';
  }
}

/* ---------- panel de administración ---------- */

async function openAdminPanel() {
  closeSidePanels('adminPanel');
  const panel = document.getElementById('adminPanel');
  panel.classList.add('open');
  const container = document.getElementById('adminStats');
  container.innerHTML = 'Cargando…';
  try {
    const [statsData, usersData] = await Promise.all([api('/api/admin/stats'), api('/api/admin/users')]);

    const rows = usersData.users
      .map(
        (u) => `
        <tr>
          <td>${escapeHtml(u.username)}${u.role === 'admin' ? ' <span class="role-badge">admin</span>' : ''}</td>
          <td>${new Date(u.createdAt).toLocaleDateString('es-PE')}</td>
          <td>${u.postCount}</td>
          <td>${u.commentCount}</td>
        </tr>`
      )
      .join('');

    container.innerHTML = `
      <div class="admin-summary">
        <div class="admin-summary-card"><div class="admin-summary-number">${statsData.totalUsers}</div><div class="admin-summary-label">Usuarios registrados</div></div>
        <div class="admin-summary-card"><div class="admin-summary-number">${statsData.newThisWeek}</div><div class="admin-summary-label">Nuevos (7 días)</div></div>
        <div class="admin-summary-card"><div class="admin-summary-number">${statsData.totalPosts}</div><div class="admin-summary-label">Publicaciones</div></div>
        <div class="admin-summary-card"><div class="admin-summary-number">${statsData.totalComments}</div><div class="admin-summary-label">Comentarios</div></div>
        <div class="admin-summary-card"><div class="admin-summary-number">${statsData.totalSupports}</div><div class="admin-summary-label">Reacciones de apoyo</div></div>
      </div>
      <table class="admin-user-table">
        <thead><tr><th>Usuario</th><th>Registro</th><th>Posts</th><th>Coment.</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  } catch (e) {
    container.innerHTML = e.network ? networkMessage() : 'No se pudo cargar la información.';
  }
}

/* ---------- comunidad: publicaciones ---------- */

async function loadWall() {
  const feed = document.getElementById('wallFeed');
  feed.textContent = 'Cargando publicaciones…';
  try {
    const data = await api('/api/posts');
    renderWall(data.posts);
  } catch (e) {
    feed.innerHTML = `<p class="wall-empty">${e.network ? networkMessage() : 'No se pudieron cargar las publicaciones.'}</p>`;
  }
}

function renderWall(posts) {
  const feed = document.getElementById('wallFeed');
  if (posts.length === 0) {
    feed.innerHTML = '<p class="wall-empty">Todavía nadie ha publicado nada. Puedes ser la primera persona.</p>';
    return;
  }
  feed.innerHTML = posts
    .map((post) => {
      const date = new Date(post.createdAt);
      return `
        <div class="wall-post" data-post-id="${post.id}">
          <div class="wall-post-text">${escapeHtml(post.text)}</div>
          <div class="wall-post-meta">
            <span>${escapeHtml(post.author)} · ${date.toLocaleString('es-PE')}</span>
            <div class="wall-post-actions">
              <button class="comment-toggle-btn" data-action="toggle-comments">💬 ${post.commentCount}</button>
              <button class="heart-btn${post.supportedByMe ? ' hearted' : ''}" data-action="support">
                🤍 Apoyo${post.supportCount ? ' · ' + post.supportCount : ''}
              </button>
            </div>
          </div>
          <div class="comments-section">
            <ul class="comment-list"><li class="comment-empty">Cargando comentarios…</li></ul>
            <div class="comment-form">
              <input type="text" class="sans comment-input" maxlength="300" placeholder="Ofrece apoyo o un consejo...">
              <button class="btn secondary" data-action="send-comment">Comentar</button>
            </div>
            <p class="comment-risk-msg"></p>
          </div>
        </div>
      `;
    })
    .join('');
}

async function submitPost() {
  const input = document.getElementById('postInput');
  const charCount = document.getElementById('charCount');
  const text = input.value.trim();
  if (!text) {
    input.focus();
    return;
  }

  try {
    const data = await api('/api/posts', { method: 'POST', body: JSON.stringify({ text }) });
    if (data.risky) {
      showPostRisk(data.message);
      return;
    }
    hidePostRisk();
    input.value = '';
    charCount.textContent = '500 caracteres restantes';
    loadWall();
  } catch (err) {
    alert(err.network ? networkMessage() : (err.data && err.data.error) || 'No se pudo publicar.');
  }
}

function showPostRisk(message) {
  document.getElementById('postRiskMessage').textContent = message;
  const notice = document.getElementById('postRiskNotice');
  notice.classList.add('show');
  notice.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hidePostRisk() {
  document.getElementById('postRiskNotice').classList.remove('show');
}

/* ---------- comunidad: apoyo y comentarios (delegación de eventos) ---------- */

function initWallEvents() {
  const feed = document.getElementById('wallFeed');

  feed.addEventListener('click', async (e) => {
    const postEl = e.target.closest('.wall-post');
    if (!postEl) return;
    const postId = postEl.dataset.postId;

    if (e.target.closest('[data-action="support"]')) {
      logButtonPress('Botón: Apoyo a una publicación');
      try {
        await api(`/api/posts/${postId}/support`, { method: 'POST' });
        loadWall();
      } catch (err) {
        /* silencioso */
      }
      return;
    }

    if (e.target.closest('[data-action="toggle-comments"]')) {
      const section = postEl.querySelector('.comments-section');
      const opening = !section.classList.contains('open');
      section.classList.toggle('open');
      if (opening) {
        loadComments(postId, section);
      }
      return;
    }

    if (e.target.closest('[data-action="send-comment"]')) {
      const input = postEl.querySelector('.comment-input');
      const text = input.value.trim();
      if (!text) {
        input.focus();
        return;
      }
      const riskMsgEl = postEl.querySelector('.comment-risk-msg');
      try {
        const data = await api(`/api/posts/${postId}/comments`, {
          method: 'POST',
          body: JSON.stringify({ text })
        });
        if (data.risky) {
          riskMsgEl.textContent = data.message;
          riskMsgEl.classList.add('show');
          return;
        }
        riskMsgEl.classList.remove('show');
        input.value = '';
        logButtonPress('Botón: Comentar en una publicación');
        const section = postEl.querySelector('.comments-section');
        loadComments(postId, section);
        loadWall(); // refresca el contador de comentarios
      } catch (err) {
        alert(err.network ? networkMessage() : (err.data && err.data.error) || 'No se pudo comentar.');
      }
    }
  });
}

async function loadComments(postId, sectionEl) {
  const listEl = sectionEl.querySelector('.comment-list');
  listEl.innerHTML = '<li class="comment-empty">Cargando comentarios…</li>';
  try {
    const data = await api(`/api/posts/${postId}/comments`);
    if (data.comments.length === 0) {
      listEl.innerHTML = '<li class="comment-empty">Todavía no hay comentarios. Sé el primero en responder.</li>';
      return;
    }
    listEl.innerHTML = data.comments
      .map((c) => {
        const date = new Date(c.createdAt);
        return `<li class="comment-item"><span class="comment-author">${escapeHtml(c.author)}</span>${escapeHtml(c.text)}<span class="comment-time">${date.toLocaleString('es-PE')}</span></li>`;
      })
      .join('');
  } catch (e) {
    listEl.innerHTML = '<li class="comment-empty">No se pudieron cargar los comentarios.</li>';
  }
}

/* ---------- respiración 4-7-8 ---------- */

let running = false;
let cycleTimeout;
let cycleNum = 0;

function startBreathing() {
  if (running) return;
  running = true;
  cycleNum = 0;
  runCycle();
}

function stopBreathing() {
  running = false;
  clearTimeout(cycleTimeout);
  const circle = document.getElementById('breathCircle');
  circle.className = 'breath-circle';
  circle.style.transition = 'transform 0.6s ease';
  circle.style.transform = 'scale(1)';
  circle.textContent = 'Inhala';
  document.getElementById('breathCount').textContent = '';
}

function runCycle() {
  if (!running) return;
  cycleNum++;
  const circle = document.getElementById('breathCircle');
  const countEl = document.getElementById('breathCount');
  countEl.textContent = 'Ciclo ' + cycleNum;

  circle.className = 'breath-circle grow';
  circle.textContent = 'Inhala (4s)';

  cycleTimeout = setTimeout(() => {
    if (!running) return;
    circle.className = 'breath-circle hold grow';
    circle.textContent = 'Sostén (7s)';

    cycleTimeout = setTimeout(() => {
      if (!running) return;
      circle.className = 'breath-circle shrink';
      circle.textContent = 'Exhala (8s)';

      cycleTimeout = setTimeout(() => {
        if (!running) return;
        runCycle();
      }, 8000);
    }, 7000);
  }, 4000);
}

/* ---------- arranque ---------- */

document.addEventListener('DOMContentLoaded', () => {
  setAuthMode('login');
  document.getElementById('authForm').addEventListener('submit', handleAuthSubmit);
  document.getElementById('authSwitchBtn').addEventListener('click', () => {
    setAuthMode(authMode === 'login' ? 'register' : 'login');
  });
  document.getElementById('passwordInput').addEventListener('input', (e) => {
    if (authMode === 'register') renderPasswordRules(e.target.value);
  });

  document.getElementById('logoutBtn').addEventListener('click', logout);

  document.getElementById('toggleHistorialBtn').addEventListener('click', openHistorial);
  document.getElementById('closeHistorialBtn').addEventListener('click', () => {
    document.getElementById('historialPanel').classList.remove('open');
  });

  document.getElementById('toggleChangePwBtn').addEventListener('click', () => {
    closeSidePanels('changePwPanel');
    document.getElementById('changePwPanel').classList.add('open');
  });
  document.getElementById('closeChangePwBtn').addEventListener('click', () => {
    document.getElementById('changePwPanel').classList.remove('open');
  });
  document.getElementById('changePwForm').addEventListener('submit', handleChangePassword);

  document.getElementById('toggleAdminBtn').addEventListener('click', openAdminPanel);
  document.getElementById('closeAdminBtn').addEventListener('click', () => {
    document.getElementById('adminPanel').classList.remove('open');
  });

  document.getElementById('floatHelpBtn').addEventListener('click', () => {
    logButtonPress('Botón: Ayuda ahora');
    document.getElementById('ayuda').scrollIntoView({ behavior: 'smooth' });
  });

  document.querySelectorAll('.dial').forEach((link) => {
    link.addEventListener('click', () => logButtonPress(link.dataset.log || 'Botón: Llamar'));
  });

  document.getElementById('startBtn').addEventListener('click', () => {
    logButtonPress('Botón: Comenzar respiración');
    startBreathing();
  });
  document.getElementById('stopBtn').addEventListener('click', () => {
    logButtonPress('Botón: Detener respiración');
    stopBreathing();
  });

  document.getElementById('postInput').addEventListener('input', (e) => {
    document.getElementById('charCount').textContent = (500 - e.target.value.length) + ' caracteres restantes';
  });
  document.getElementById('publishBtn').addEventListener('click', submitPost);
  document.getElementById('dismissPostRiskBtn').addEventListener('click', hidePostRisk);

  initWallEvents();
  checkSession();
});
