const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./db');
const { containsRisk, RISK_MESSAGE } = require('./lib/riskFilter');
const { isStrongPassword, PASSWORD_RULES_MESSAGE } = require('./lib/validators');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(
  session({
    // Cambia este secreto antes de usar el servidor fuera de tu máquina
    // (variable de entorno SESSION_SECRET).
    secret: process.env.SESSION_SECRET || 'cambia-este-secreto-en-produccion',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 1000 * 60 * 60 * 24 * 7 }
  })
);

/* ============ UTILIDADES ============ */

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function nowISO() {
  return new Date().toISOString();
}

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'No autenticado.' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'No autenticado.' });
  const user = db.get('users').find({ id: req.session.userId }).value();
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'No tienes permiso para ver esto.' });
  }
  next();
}

function logAction(userId, action) {
  db.get('logs').push({ id: generateId(), userId, action, timestamp: nowISO() }).write();
}

function publicUser(user) {
  return { id: user.id, username: user.username, role: user.role || 'user', createdAt: user.createdAt };
}

function findUserByUsername(name) {
  const key = name.trim().toLowerCase();
  return db.get('users').find({ usernameLower: key }).value();
}

/* ============ CUENTA ADMINISTRADORA (se crea sola la primera vez) ============ */

function ensureAdminAccount() {
  const existingAdmin = db.get('users').find({ role: 'admin' }).value();
  if (existingAdmin) return;

  const defaultUsername = 'admin';
  const defaultPassword = 'Admin#2026'; // cumple la política: letras, números y símbolo, 8+ caracteres

  const admin = {
    id: generateId(),
    username: defaultUsername,
    usernameLower: defaultUsername.toLowerCase(),
    passwordHash: bcrypt.hashSync(defaultPassword, 10),
    role: 'admin',
    createdAt: nowISO()
  };
  db.get('users').push(admin).write();

  console.log('\n============================================');
  console.log(' Cuenta administradora creada automáticamente');
  console.log(` Usuario:    ${defaultUsername}`);
  console.log(` Contraseña: ${defaultPassword}`);
  console.log(' Cámbiala apenas inicies sesión (ver README).');
  console.log('============================================\n');
}

ensureAdminAccount();

/* ============ AUTENTICACIÓN ============ */

app.post('/api/register', (req, res) => {
  const { username, password } = req.body || {};
  const name = (username || '').trim();

  if (!name || name.length < 3) {
    return res.status(400).json({ error: 'El usuario debe tener al menos 3 caracteres.' });
  }
  if (!isStrongPassword(password)) {
    return res.status(400).json({
      error: 'La contraseña debe tener mínimo 8 caracteres y combinar letras, números y al menos un signo (ej. #, @, %).'
    });
  }

  const existing = findUserByUsername(name);
  if (existing) {
    return res.status(409).json({ error: 'Ese usuario ya existe. Intenta iniciar sesión.' });
  }

  const user = {
    id: generateId(),
    username: name,
    usernameLower: name.toLowerCase(),
    passwordHash: bcrypt.hashSync(password, 10),
    role: 'user',
    createdAt: nowISO()
  };
  db.get('users').push(user).write();
  req.session.userId = user.id;
  logAction(user.id, 'Registro de cuenta');
  res.json({ user: publicUser(user), isNew: true });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const name = (username || '').trim();

  if (!name || !password) {
    return res.status(400).json({ error: 'Escribe tu usuario y tu contraseña.' });
  }

  const user = findUserByUsername(name);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  }
  req.session.userId = user.id;
  logAction(user.id, 'Inicio de sesión');
  res.json({ user: publicUser(user), isNew: false });
});

app.post('/api/logout', requireAuth, (req, res) => {
  logAction(req.session.userId, 'Cierre de sesión');
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'No autenticado.' });
  const user = db.get('users').find({ id: req.session.userId }).value();
  if (!user) return res.status(401).json({ error: 'No autenticado.' });
  res.json({ user: publicUser(user) });
});

app.patch('/api/me/password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const user = db.get('users').find({ id: req.session.userId }).value();
  if (!user || !bcrypt.compareSync(currentPassword || '', user.passwordHash)) {
    return res.status(401).json({ error: 'Tu contraseña actual no coincide.' });
  }
  if (!isStrongPassword(newPassword)) {
    return res.status(400).json({
      error: 'La nueva contraseña debe tener mínimo 8 caracteres y combinar letras, números y al menos un signo.'
    });
  }
  db.get('users')
    .find({ id: req.session.userId })
    .assign({ passwordHash: bcrypt.hashSync(newPassword, 10) })
    .write();
  logAction(req.session.userId, 'Cambio de contraseña');
  res.json({ ok: true });
});

/* ============ REGISTRO DE PULSACIONES (botones sueltos) ============ */

app.post('/api/actions', requireAuth, (req, res) => {
  const { action } = req.body || {};
  if (!action) return res.status(400).json({ error: 'Falta la acción.' });
  logAction(req.session.userId, action);
  res.json({ ok: true });
});

app.get('/api/me/logs', requireAuth, (req, res) => {
  const logs = db
    .get('logs')
    .filter({ userId: req.session.userId })
    .orderBy(['timestamp'], ['desc'])
    .take(200)
    .value();
  res.json({ logs });
});

/* ============ PUBLICACIONES ============ */

function decoratePost(post, currentUserId) {
  const author = db.get('users').find({ id: post.userId }).value();
  const commentCount = db.get('comments').filter({ postId: post.id }).size().value();
  const supportRows = db.get('supports').filter({ postId: post.id }).value();
  return {
    id: post.id,
    text: post.text,
    createdAt: post.createdAt,
    authorId: post.userId,
    author: author ? author.username : 'usuario eliminado',
    commentCount,
    supportCount: supportRows.length,
    supportedByMe: supportRows.some((s) => s.userId === currentUserId)
  };
}

app.get('/api/posts', requireAuth, (req, res) => {
  const posts = db.get('posts').orderBy(['createdAt'], ['desc']).value();
  res.json({ posts: posts.map((p) => decoratePost(p, req.session.userId)) });
});

app.post('/api/posts', requireAuth, (req, res) => {
  const text = ((req.body || {}).text || '').trim();
  if (!text) return res.status(400).json({ error: 'Escribe algo antes de publicar.' });
  if (text.length > 500) return res.status(400).json({ error: 'Máximo 500 caracteres.' });

  if (containsRisk(text)) {
    return res.json({ risky: true, message: RISK_MESSAGE });
  }

  const post = { id: generateId(), userId: req.session.userId, text, createdAt: nowISO() };
  db.get('posts').push(post).write();
  logAction(req.session.userId, 'Publicar en la comunidad');
  res.json({ post: decoratePost(post, req.session.userId) });
});

app.post('/api/posts/:id/support', requireAuth, (req, res) => {
  const postId = req.params.id;
  const post = db.get('posts').find({ id: postId }).value();
  if (!post) return res.status(404).json({ error: 'Publicación no encontrada.' });

  const existing = db.get('supports').find({ postId, userId: req.session.userId }).value();
  if (existing) {
    db.get('supports').remove({ postId, userId: req.session.userId }).write();
  } else {
    db.get('supports').push({ postId, userId: req.session.userId, createdAt: nowISO() }).write();
    logAction(req.session.userId, 'Dar apoyo a una publicación');
  }
  res.json({ post: decoratePost(post, req.session.userId) });
});

/* ============ COMENTARIOS ============ */

app.get('/api/posts/:id/comments', requireAuth, (req, res) => {
  const postId = req.params.id;
  const comments = db
    .get('comments')
    .filter({ postId })
    .orderBy(['createdAt'], ['asc'])
    .value()
    .map((c) => {
      const author = db.get('users').find({ id: c.userId }).value();
      return {
        id: c.id,
        text: c.text,
        createdAt: c.createdAt,
        author: author ? author.username : 'usuario eliminado'
      };
    });
  res.json({ comments });
});

app.post('/api/posts/:id/comments', requireAuth, (req, res) => {
  const postId = req.params.id;
  const post = db.get('posts').find({ id: postId }).value();
  if (!post) return res.status(404).json({ error: 'Publicación no encontrada.' });

  const text = ((req.body || {}).text || '').trim();
  if (!text) return res.status(400).json({ error: 'Escribe un comentario.' });
  if (text.length > 300) return res.status(400).json({ error: 'Máximo 300 caracteres.' });

  if (containsRisk(text)) {
    return res.json({ risky: true, message: RISK_MESSAGE });
  }

  const comment = { id: generateId(), postId, userId: req.session.userId, text, createdAt: nowISO() };
  db.get('comments').push(comment).write();
  logAction(req.session.userId, 'Comentar en una publicación');

  const author = db.get('users').find({ id: req.session.userId }).value();
  res.json({
    comment: { id: comment.id, text: comment.text, createdAt: comment.createdAt, author: author.username }
  });
});

/* ============ PANEL DE ADMINISTRACIÓN ============ */

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const users = db.get('users').value();
  const posts = db.get('posts').value();
  const comments = db.get('comments').value();
  const supports = db.get('supports').value();

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newThisWeek = users.filter((u) => new Date(u.createdAt).getTime() >= sevenDaysAgo).length;

  const recentUsers = [...users]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 20)
    .map((u) => ({ username: u.username, role: u.role || 'user', createdAt: u.createdAt }));

  res.json({
    totalUsers: users.length,
    newThisWeek,
    totalPosts: posts.length,
    totalComments: comments.length,
    totalSupports: supports.length,
    recentUsers
  });
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
  const users = db.get('users').orderBy(['createdAt'], ['desc']).value();
  const list = users.map((u) => ({
    id: u.id,
    username: u.username,
    role: u.role || 'user',
    createdAt: u.createdAt,
    postCount: db.get('posts').filter({ userId: u.id }).size().value(),
    commentCount: db.get('comments').filter({ userId: u.id }).size().value()
  }));
  res.json({ users: list });
});

app.get('/api/admin/posts', requireAdmin, (req, res) => {
  const posts = db.get('posts').orderBy(['createdAt'], ['desc']).value();
  res.json({ posts: posts.map((p) => decoratePost(p, req.session.userId)) });
});

app.delete('/api/admin/posts/:id', requireAdmin, (req, res) => {
  const postId = req.params.id;
  db.get('comments').remove({ postId }).write();
  db.get('supports').remove({ postId }).write();
  db.get('posts').remove({ id: postId }).write();
  logAction(req.session.userId, 'Admin: eliminar publicación');
  res.json({ ok: true });
});

app.delete('/api/admin/comments/:id', requireAdmin, (req, res) => {
  db.get('comments').remove({ id: req.params.id }).write();
  logAction(req.session.userId, 'Admin: eliminar comentario');
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
