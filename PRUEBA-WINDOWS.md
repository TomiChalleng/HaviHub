# Probar los cambios de Tomi en Windows (versión 5)

Hola Havi. Gracias por probar y por el log, sirvieron mucho. En esta versión está arreglado lo que encontraste:

- **El error de CurseForge** ("Could not connect… Redirect was cancelled"): ahora esos mods se descargan.
- **Tus teclas no se aplicaban.** El log mostró la causa: Minecraft no lograba leer el archivo de opciones que Havi Hub crea para los perfiles nuevos y lo descartaba entero. Por eso no tomaba tus teclas (ni el resto de tus opciones) y salía la pantalla de bienvenida de Minecraft. Ya no pasa.
- **Modpacks que traen sus propias teclas:** al instalar uno, Havi Hub ahora te pregunta si usar **tus teclas** o **las del modpack**.
- **Las tarjetas de Descubrir** (diseño Modrinth): ahora se ven como en la página de Modrinth, sin el espacio vacío, y los mods dicen si van en el **Cliente**, el **Servidor** o en **Cliente y servidor**.
- **Compartir un perfil ya no manda tus datos sin querer:** al compartirlo como Prism (.zip), tus comandos y variables de entorno se quedan afuera, salvo que marques una casilla nueva.
- **Tus cuentas de Minecraft ya no se pierden** si una actualización del motor falla y Havi Hub vuelve a la versión anterior.

**Descarga:** [HaviHub-prueba-PR1.exe](https://github.com/TomiChalleng/HaviHub/releases/download/prueba-pr1/HaviHub-prueba-PR1.exe) (105 MB). Se abre con doble clic y no se instala. Si el navegador avisa que el archivo "no se descarga con frecuencia", elige **Conservar**.

---

## Antes de empezar

1. **Cierra tu Havi Hub normal del todo.** No basta con la X: si queda junto al reloj, haz clic derecho en su ícono y elige **Salir de Havi Hub** (si no lo ves, abre la flechita **^** junto al reloj). Si queda abierto, la versión de prueba no arranca y se abre la normal.
2. **Haz doble clic en HaviHub-prueba-PR1.exe.** Si Windows muestra "Windows protegió su PC", pulsa **Más información** y luego **Ejecutar de todas formas**.

**Sobre tus perfiles:** la versión de prueba usa **los mismos perfiles, cuentas y ajustes** que tu Havi Hub normal. No borra nada, y lo que crees en la prueba lo puedes eliminar después.

---

## Qué probar

Marca cada punto cuando lo hayas probado.

### 1. Tus teclas en un perfil nuevo (lo más importante)

- [ ] Crea un perfil nuevo (por ejemplo, Fabric en la última versión) y juega.
- [ ] Dentro del juego, revisa **Opciones → Controles**: tienen que estar **tus teclas**, las de Ajustes → Minecraft → Teclas.

La pantalla de bienvenida de Minecraft ("Welcome to Minecraft… Narrator") puede salir **una vez** en un perfil recién creado. Es normal: Minecraft la muestra en cualquier instalación nueva. Lo que no debe pasar es que se pierdan tus teclas.

### 2. Tus teclas en perfiles que ya tenías

Los perfiles que creaste antes quedaron con las teclas por defecto de Minecraft. Para arreglarlos de una vez:

- [ ] Ve a **Ajustes → Minecraft → Teclas** y pulsa **Aplicar las teclas a todos los perfiles** (con el juego cerrado).
- [ ] Abre uno de esos perfiles y revisa que estén tus teclas.

### 3. Mods de CurseForge

- [ ] Instala los mismos mods de CurseForge que antes daban error (por ejemplo **Balm** o **ImmediatelyFast**). Deben descargarse sin el mensaje "Could not connect".

### 4. Modpacks y la pregunta de las teclas

- [ ] Instala un modpack desde Descubrir (por ejemplo **Fabulously Optimized**). Debe descargarse completo y abrir el juego.
- [ ] Si el modpack trae sus propias teclas, al terminar aparece una ventana: **"¿Qué teclas quieres usar en…?"**. Elige **Mis teclas** y revisa en el juego que estén las tuyas.

### 5. Las tarjetas de Descubrir (diseño Modrinth)

- [ ] Con el diseño Modrinth, abre **Descubrir contenido**. Las tarjetas deben verse como en la página de Modrinth: las etiquetas abajo, con el color de cada cargador (Fabric, Forge…), y un botón **Instalar** grande.
- [ ] Si un mod tiene muchas etiquetas, se ven 4 y un **+1** (o +2…). Al pasar el mouse por el **+1** dice cuáles faltan.
- [ ] En la pestaña **Mods**, cada mod debe decir **Cliente**, **Servidor** o **Cliente y servidor**. Al pasar el mouse por encima explica qué significa.

### 6. Compartir e importar un perfil con comandos

Al compartir un perfil, tus comandos ya no se mandan salvo que lo elijas. Y si alguien te pasa un perfil que ejecuta programas al iniciar, Havi Hub avisa antes de importarlo.

1. Haz clic derecho en un perfil → **Opciones del perfil** → **Al iniciar**.
2. Activa **Comandos personalizados** y en **Antes de iniciar** escribe: `cmd /c echo hola`. Guarda.
3. Haz clic derecho en ese perfil → **Compartir perfil** → elige **Prism (.zip)**.
   - [ ] Debe aparecer la casilla **Incluir mis comandos y variables de entorno**, desmarcada, y abajo dice "Antes de iniciar".
   - **Márcala** (si no, el comando no viaja en el archivo y no hay nada que avisar) y pulsa **Exportar**. Guárdalo en el Escritorio.
4. Ve a **Importar → Desde un archivo (.zip / .mrpack)…** y elige ese archivo.
   - [ ] Debe aparecer una ventana que dice **"Este perfil ejecuta programas al iniciar"** y muestra `cmd /c echo hola`.
5. Prueba los tres botones (repite el paso 4 para cada uno):
   - [ ] **Cancelar**: no se importa nada.
   - [ ] **Importar sin ellos**: aparece el perfil nuevo y, en sus Opciones → Al iniciar, ya no tiene el comando.
   - [ ] **Importar con ellos**: aparece el perfil nuevo y conserva el comando.
6. Exporta el mismo perfil otra vez, ahora **sin marcar** la casilla, e impórtalo.
   - [ ] Esta vez **no** aparece el aviso, y el perfil nuevo no tiene el comando.

Al terminar, puedes eliminar los perfiles importados y quitarle el comando al perfil original.

### 7. Abrir capturas y carpetas

- [ ] En **Capturas**, abre una captura y pulsa **Abrir** (arriba a la derecha). Debe abrirse con el visor de fotos de Windows.
- [ ] Dentro de un perfil, en **Contenido**, el botón de carpeta debe abrir la carpeta en el Explorador.
- [ ] En la pestaña **Mundos** de un perfil, **Abrir carpeta** debe hacer lo mismo.

### 8. Inglés

- [ ] En **Ajustes → Idiomas**, elige **English**.
- [ ] Instala cualquier mod. El panel de descargas (la flechita de descargas) debe estar **en inglés**.
- [ ] Vuelve a poner **Español** al terminar.

### 9. Videos en las páginas de mods

- [ ] Abre la página de un mod que tenga un video de YouTube en su descripción. El video debe verse igual que antes.

---

## Sobre la skin en un mundo de un jugador

En tu log se ve que, al abrir el juego, **Mojang rechazó la petición de tu skin por "demasiadas peticiones"** (un límite de sus servidores, no de Havi Hub). Sin esa respuesta, Minecraft pone la skin por defecto. En Hypixel sí se ve porque ahí la skin la manda el servidor.

Havi Hub no le pide tu skin a Mojang al abrir el juego, así que no viene de ahí. Para confirmarlo:

- [ ] Prueba con un perfil **sin mods**.
- [ ] Si usas una VPN, prueba sin ella.
- [ ] Espera un minuto entre cerrar y volver a abrir el juego.

Si aun así no sale tu skin en un perfil sin mods, mándame el log de esa partida.

---

## Al terminar

1. Cierra la versión de prueba: clic derecho en su ícono junto al reloj → **Salir de Havi Hub**.
2. Borra el archivo **HaviHub-prueba-PR1.exe**.
3. Abre tu Havi Hub normal como siempre.

## Si algo falla

Mándame una **captura de pantalla** del error. Si el problema es con el juego, abre el perfil → **Logs** → botón de la flechita hacia arriba (**Subir a mclo.gs y copiar el enlace**) y mándame ese enlace. Lo corrijo antes de que lo aceptes.

## Si todo funciona

1. Entra a **https://github.com/havihub/HaviHub/pull/1**.
2. Si arriba aparece un botón **Approve and run**, púlsalo: GitHub corre las pruebas automáticas. Espera a que terminen.
3. Abajo, pulsa **Merge pull request** y luego **Confirm merge**.

**Importante:** acepta el PR **antes** de publicar otra versión de Havi Hub, o antes de pedirle a tu Claude que suba cambios nuevos. Si publicas antes, mis cambios quedan desfasados y tengo que rehacerlos.

En el PR también está el archivo `docs/auditoria-1.0.0.md`, con todo lo que revisé y lo que recomiendo hacer después. Si quieres, pídele a tu Claude que te lo resuma.
