## What this changes

Arreglos que salieron de una auditoría del código, rehechos sobre `b7ddee8`: de seguridad y privacidad, de funciones que fallaban (sobre todo en Windows), del motor, de traducción y de las pruebas. Cada commit es independiente y explica en su mensaje qué cambia y por qué.

La auditoría completa, con lo que queda pendiente por prioridad, está en [`docs/auditoria-1.0.0.md`](docs/auditoria-1.0.0.md). Si prefieres no tenerla en el repositorio, el commit `89564dc` se puede quitar sin afectar a los demás. El fallo de los metadatos con `../` no está aquí porque `b7ddee8` ya lo corrige con `safepath.js`.

**Descargas de CurseForge** (lo encontraste al probar en Windows)

- **Las descargas que pasan por una redirección fallaban siempre** (`309de02`): "Could not connect: https://edge.forgecdn.net/… (Redirect was cancelled)".
  - Havi Hub sigue esas redirecciones a mano para que la clave de CurseForge solo llegue a sus servidores, con `redirect: 'manual'`, y el `net.fetch` de Electron no lo admite.
  - Por lo mismo fallaban la página de respaldo del motor y la comprobación de `social.js`.
  - Ahora esas peticiones usan `net.request`. El nuevo `scripts/e2e-redirects.cjs` lo comprueba dentro de Electron real: falla con el código anterior y pasa con el arreglo.

**Opciones y teclas de los perfiles** (lo mostró el log de tu prueba)

- **Los perfiles nuevos perdían todas las opciones y teclas de Havi Hub** (`6b64541`).
  - El `options.txt` que escribe Havi Hub no tenía línea `version:`, así que Minecraft lo tomaba por uno de antes de la 1.13 e intentaba convertir las teclas numéricas antiguas.
  - La conversión fallaba con `key.keyboard.…` ("Failed to load options" en el log) y Minecraft descartaba el archivo entero. Por eso no se tomaban tus teclas y salía la pantalla de bienvenida de Minecraft.
  - Ahora esos archivos llevan una versión, así que Minecraft los lee tal cual. Los que guardó el propio juego no se tocan.
- **Al instalar un modpack que trae sus propias teclas, Havi Hub pregunta** (`0a3221c`): las tuyas o las del autor. Antes se perdían sin aviso. Lo comprueba `scripts/e2e-modpack-keys.mjs`.
- **La skin en un mundo de un jugador:** en tu log, Mojang respondió 429 (demasiadas peticiones) cuando el juego pidió tu perfil. No viene de Havi Hub; está explicado en la auditoría.

**Rutas en Windows** (lo mostraron las pruebas en Windows)

- **`safepath.js` rechazaba archivos que sí estaban dentro de su carpeta** (`d0ccac8`).
  - Pasaba cuando la carpeta todavía no existía y el camino tenía un enlace o un nombre corto de Windows (`C:\Users\RUNNER~1\…`): comparaba una ruta resuelta con otra sin resolver.
  - En Windows eso dejaba vacío un perfil importado y hacía fallar instalaciones.
  - Ahora las dos rutas se resuelven igual. Un enlace que lleva afuera se sigue rechazando.

**Cuentas y tutorial**

- **Volver al motor anterior podía borrar cuentas** (`549c66e`). La vuelta atrás restauraba `accounts.json` desde la copia hecha al actualizar, que puede tener días; una cuenta agregada o un token renovado después se perdían. Ahora se restaura solo si el archivo actual no se puede leer o el motor nuevo cambió su formato (`formatVersion`). `prismlauncher.cfg` se sigue restaurando como antes.
- **El tutorial salía encima de "Preparando Minecraft"** (`2c60ac6`) cuando Havi Hub arrancaba sin los archivos del juego (reinstalación, caché borrada). Ahora lo muestra `WelcomeGate`, cuando ya no tiene nada que mostrar. Lo encontró `e2e-welcome.mjs` ("C: the app behind is hidden"), que también fallaba en `b7ddee8`.

**Lista de proyectos (diseño Modrinth)**

- **Sin el hueco bajo la descripción** (`523c95b`): la tarjeta sigue el `ProjectCard.vue` de Modrinth (GPL-3.0). Las etiquetas van al pie, como píldoras con el ícono y el color de cada cargador, con 4 como máximo y el resto en "+N". El título, el autor, la descripción, las cifras y el botón de instalar tienen los tamaños de Modrinth, y la fecha dice solo "Hace 20 días" ("Actualizado…" al pasar el mouse).
- **Los mods muestran dónde se instalan:** "Cliente", "Servidor" o "Cliente y servidor", explicado al pasar el mouse.

**Seguridad**

- **`.mrpack` con direcciones `file:`** (`a14420a`). `http.download` copia archivos `file:`, así que con solo importar un pack se podía copiar cualquier archivo del PC al perfil. En Windows, `file://servidor/…` además conecta con ese servidor y le envía las credenciales del usuario. Ahora se usan solo direcciones HTTPS (como pide el formato de Modrinth), se prueban todos los espejos en orden y se comprueba el sha512. Usa el `safeRelPath` y el `resolveRelInside` de `safepath.js`.
- **Perfiles de Prism (.zip) que ejecutan programas al iniciar** (`b1e9107`). Antes de importar un perfil que trae comandos propios, un Java propio, argumentos como `-javaagent`, variables como `LD_PRELOAD` o librerías nativas, Havi Hub los muestra y se elige: importar sin ellos (el botón por defecto), con ellos, o cancelar.
- **Compartir un perfil como `.zip` de Prism ya no lleva los comandos, el Java ni las variables de entorno de tu PC** (`b59fb31`), que pueden tener un token o tu carpeta de usuario. Si el perfil tiene alguno, "Compartir perfil" muestra la casilla "Incluir mis comandos y variables de entorno", desmarcada. El perfil en tu PC no cambia.
- **Defensa en profundidad** (`0384234`). `app.openPath` solo abre carpetas e imágenes (en Windows, abrir un programa lo ejecuta). Se quita `app.readFile`, que nada usaba. Los iframes de las descripciones se comprueban por su dirección real y no comparando texto.

**Motor**

- **Solo versiones de Prism probadas** (`3c0814f`). `TESTED_VERSION` (hoy `11.1.1`) es la versión más nueva que se instala; una más nueva espera a que se pruebe con `scripts/engine-smoke.mjs` y se suba la constante. Complementa la vuelta atrás de `b7ddee8`: esa detecta una versión que no arranca, y esto evita una que arranca pero cambió algo de lo que Havi Hub depende. Ya existe `12.0.0-pre1`.
- **Actualizar el motor solo con su SHA-256** (`a59ad70`). La página `releases/latest` y el feed de respaldo no traen el SHA-256. La primera instalación sigue adelante igual; una actualización espera a la próxima comprobación con la API.

**Proceso**

- **`auto-merge.yml` corre las pruebas antes de fusionar** (`355f1e9`): `npm ci`, `npm test` y `npm run build` sobre el resultado, y solo si pasan sube a `main`, borra la rama y lanza la release. Si fallan, `main` y la rama quedan como estaban. `ci.yml` corre también en Windows.
- **`auto-merge.yml` no corre en forks** (`c4d4f81`). Al subir esta rama a mi fork (que tiene Actions activo), el workflow intentó fusionarla en el `main` del fork y borrarla. Solo falló porque ese `main` tenía otra historia. Con `if: github.event.repository.fork == false` sigue igual en este repositorio y en cualquier otro que lo use, pero no toca las ramas de quien colabora desde un fork.

**Traducción**

- **Textos del proceso principal** (`fec1ad9`). Errores, panel de descargas y motivos de instalación llegaban siempre en español. Ahora siguen la convención de la interfaz: se escriben en español con `{variables}` mediante `new UserError('…', vars)` y `tr('…', vars)` (`src/shared/usertext.js`), y la interfaz los traduce con `t()`.
- Incluye los textos nuevos del instalador de Java.
- `gen.mjs` ahora también recoge estas plantillas, y **ya no borra** las traducciones que no encuentra en el código. Antes habría borrado 31 de las tuyas, como las del diagnóstico de logs. `i18n-en.js` conserva su orden y las traducciones nuevas van al final.
- Una prueba falla si algún texto queda sin traducción. Está documentado en `CONTRIBUTING.md`.
- **El informe de "Reparar perfil" y el error "Ruta inválida"** (`a6c94fe`) también se traducen ahora.

**Pruebas**

- **En Windows ya no falla ninguna prueba** (en `b7ddee8` fallaban 20). 12 eran de `make-import-fixtures.mjs`, que no creaba nada en Windows (`d037a10`): comparaba `import.meta.url` con `file://${process.argv[1]}`, y en Windows eso es `file:///D:/…` contra `file://D:\…`. Las 2 de los accesos directos de Linux ahora solo corren en Linux.
- **Las 22 pruebas con la app real (`scripts/e2e*.mjs`) pasan** (`406ebe6`, `7b6b6eb`, `bc4f75f`); en `b7ddee8` fallaban 6. Fallaban por la hora del día (el filtro "Hoy" de la galería entre las 00:00 y las 02:24), por Java 25 (`mock-net.cjs` ahora responde como Adoptium, así que el paso "launch" también prueba el instalador de Java), por esperas fijas demasiado cortas, por el tutorial tapando la pantalla y por cosas que 1.0.0 cambió (`.mr-prev`, `.ac-filters-btn` repetido).

## How it was tested

- Pruebas unitarias nuevas para cada cambio; las de los arreglos se comprobaron fallando sin la corrección.
- `npm test`: en Linux, 150 pruebas, 148 pasan y 2 se omiten (ya lo estaban); en Windows (GitHub Actions) no falla ninguna. `npm run build` sin errores.
- Con la app real (Electron + Xvfb, Linux): pasan los 22 `scripts/e2e*.mjs`, entre ellos los nuevos `e2e-import-settings.mjs` (el aviso al importar) y `e2e-modpack-keys.mjs` (la pregunta de las teclas). `e2e-blocked.mjs` puede fallar si corren varios a la vez en una máquina cargada; solo pasa.
- `scripts/e2e-redirects.cjs` (nuevo): las redirecciones manuales dentro de Electron real.
- Probado por ti en Windows con una versión portable de la rama; lo que encontraste (CurseForge, teclas, tarjetas) ya está corregido.

- [x] `npm test` passes
- [x] New interface text has its English translation in `src/renderer/lib/i18n-en.js`
