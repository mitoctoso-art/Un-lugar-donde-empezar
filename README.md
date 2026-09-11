# Apoyo y prevención — servidor con comunidad y administración

Servidor real (Node.js + Express) con **cuentas de usuario propias**, publicaciones, comentarios, reacciones de apoyo y un **panel de administración** para monitorear cuántas personas se registran y qué tanto se usa la comunidad.

## Requisitos

- [Node.js](https://nodejs.org) versión 18 o superior (incluye `npm`).
- No necesita instalar ninguna base de datos aparte: los datos se guardan en un archivo `data/db.json` que el servidor crea solo.

## Cómo ejecutarlo

1. Descomprime la carpeta y ábrela en VS Code (`Archivo > Abrir carpeta...`).
2. Abre una terminal en VS Code (`Terminal > Nueva terminal`) y ejecuta:
   ```
   npm install
   ```
   Descarga las 4 librerías que usa el proyecto (Express, express-session, bcryptjs, lowdb). No requiere compiladores ni herramientas adicionales.
3. Luego ejecuta:
   ```
   npm start
   ```
4. Abre tu navegador en **http://localhost:3000**

> **Importante:** este proyecto necesita el servidor corriendo. No lo abras con la extensión Live Server ni hagas doble clic en `index.html` — si lo haces, el login fallará porque no hay nada respondiendo en `/api/...`. Siempre entra por `http://localhost:3000` después de `npm start`.

Para que otra persona en la misma red Wi-Fi entre desde su propio celular o laptop, usa la IP de tu computadora en vez de `localhost`, por ejemplo `http://192.168.1.15:3000` (revisa tu IP local con `ipconfig` en Windows o `ifconfig`/`ip a` en Mac/Linux), y comparte esa dirección.

## Cuenta de administrador (se crea sola)

La primera vez que ejecutas `npm start`, el servidor crea automáticamente una cuenta de administrador si todavía no existe ninguna:

```
Usuario:    admin
Contraseña: Admin#2026
```

Con esa cuenta puedes entrar a la app normalmente y verás un botón extra en la barra superior: **"Panel de administración"**. Ahí puedes ver:

- Total de usuarios registrados, y cuántos se registraron en los últimos 7 días.
- Total de publicaciones, comentarios y reacciones de apoyo (para llevar la "contabilidad" de uso).
- Una tabla con cada usuario: nombre, fecha de registro, cuántas publicaciones y comentarios ha hecho.

**Cambia esa contraseña apenas puedas** desde "Cambiar contraseña" en la barra superior, o define tus propias credenciales antes del primer arranque con variables de entorno:

```
ADMIN_USERNAME=tu_usuario ADMIN_PASSWORD=TuClave9! npm start
```

## Inicio de sesión: qué se corrigió

- El usuario ahora se guarda también en minúsculas internamente, así que **no importa si escribes "Karolay" o "karolay"** al iniciar sesión — antes esto podía causar que pareciera que el login "no funcionaba" si el usuario se registró con mayúsculas distintas.
- Si el servidor no está corriendo (o abriste la página desde Live Server en otro puerto), ahora la pantalla de inicio de sesión te avisa explícitamente en vez de fallar en silencio.
- El mensaje de "usuario o contraseña incorrectos" es el mismo tanto si el usuario no existe como si la contraseña está mal, por seguridad (para no revelar qué usuarios existen) — si es tu primera vez, usa "¿No tienes cuenta? Crear una".

## Contraseñas

Toda contraseña nueva (registro, cambio de contraseña) debe tener:

- Al menos 8 caracteres
- Al menos una letra
- Al menos un número
- Al menos un símbolo (por ejemplo: `@ # $ % ! ?`)

Ejemplo válido: `Piura25@`. La regla se valida tanto en el navegador (aviso en vivo mientras escribes) como en el servidor (no se puede saltar editando el HTML).

## Qué incluye

- **Cuentas reales**: registro con usuario + contraseña (hash con bcrypt), inicio de sesión con cookies de sesión, cambio de contraseña.
- **Roles**: cada usuario tiene `role: "user"` o `role: "admin"`. Solo la cuenta admin ve el panel de administración; las rutas `/api/admin/...` están protegidas en el servidor, no solo ocultas en el navegador.
- **Comunidad**: cualquier usuario con cuenta puede publicar cómo se siente o una idea, comentar en publicaciones de otros (dar apoyo o consejo), y reaccionar con "🤍 Apoyo".
- **Filtro de riesgo**: si una publicación o comentario contiene frases asociadas a riesgo de autolesión o suicidio, no se guarda — en su lugar se muestra la Línea 113 para llamar de inmediato.
- **Historial de pulsaciones**: cada acción importante (publicar, comentar, dar apoyo, llamar a una línea, respiración) queda registrada por usuario, consultable desde "Ver mi historial".
- Recursos de ayuda inmediata, señales de alerta, respiración guiada 4-7-8 y guía para acompañar a alguien más.

## Estructura

```
├── server.js            → servidor Express y toda la API (rutas /api/...)
├── db.js                → conexión a la base de datos (lowdb, guarda en data/db.json)
├── lib/
│   ├── riskFilter.js     → patrones de frases de riesgo
│   └── validators.js     → regla de contraseña fuerte (compartida por registro y admin)
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js            → login/registro, comunidad, comentarios, panel admin, respiración
├── data/                 → aquí se crea db.json (no se sube a git)
└── package.json
```

## Limitaciones a tener en cuenta

Este servidor está pensado para correr en tu propia máquina o en una red local (por ejemplo, para una demo de clase). Antes de exponerlo en internet a personas reales, considera:

- **Cambia el secreto de sesión**: en `server.js`, la variable `SESSION_SECRET` tiene un valor de ejemplo. Configúrala como variable de entorno con un valor propio y secreto.
- **Cambia la contraseña de admin** apenas la uses la primera vez.
- **No hay moderación humana**: el filtro de riesgo es automático y basado en palabras clave; puede fallar en ambos sentidos. Una comunidad real de salud mental necesita moderadores humanos, no solo un filtro.
- **El almacenamiento (`lowdb`) es simple**: guarda todo en un archivo JSON. Funciona bien para un proyecto de clase o un grupo pequeño; para una comunidad más grande conviene migrar a PostgreSQL o MongoDB.
- Contenido informativo, no reemplaza atención profesional. Si tú o alguien que conoces está en peligro inmediato, llama al 106 (SAMU) o acude a la emergencia más cercana.
