<p align="center">
  <img src="build/icon.png" alt="" width="112">
</p>

<h1 align="center">Havi Hub</h1>

<p align="center">
  Launcher libre y de código abierto para Minecraft Java Edition, para Windows y Linux.<br>
  <a href="README.md">Read in English</a>
</p>

Havi Hub es un launcher de escritorio construido sobre [Prism Launcher](https://prismlauncher.org), que usa como motor de juego. Reúne en un solo lugar los perfiles, las cuentas y los ajustes, y permite buscar e instalar mods y modpacks de CurseForge y Modrinth sin salir de la aplicación. La interfaz está disponible en español y en inglés.

<p align="center">
  <img src="docs/screenshots/curseforge/es/home.webp" alt="La página de inicio de Havi Hub, en el diseño estilo CurseForge" width="900">
</p>

## Funciones

- Dos diseños a elección, uno similar a la app de CurseForge y otro similar a la app de Modrinth. Ambos tienen las mismas funciones.
- Búsqueda e instalación de mods, modpacks, resource packs, shaders, data packs y mundos de CurseForge y Modrinth, con dependencias y actualizaciones a cargo del launcher.
- Importación de perfiles desde CurseForge, Modrinth y Prism Launcher. Los perfiles también se pueden mantener sincronizados con Prism Launcher y con las apps de CurseForge y Modrinth, desde una sola ventana.
- Inicio de sesión con cuenta de Microsoft. Las cuentas offline, pensadas para LAN y servidores en modo offline, solo se pueden agregar después de iniciar sesión con una cuenta que tenga el juego.
- Ajustes por perfil (Java, memoria, variables de entorno, comandos de inicio), además de opciones del juego y teclas predeterminadas con las que parten los perfiles nuevos.
- Visor de skins en 3D con las skins por defecto del juego, buscador de servidores con los más conocidos y la lista de Modrinth, galería de capturas de todos los perfiles y varios temas, también de temporada.
- Sin anuncios ni telemetría. Havi Hub no tiene servidores propios: las cuentas, los perfiles y los ajustes se quedan en el computador. Los servicios a los que se conecta están en la [política de privacidad](https://havihub.github.io/privacy/); la página de Inicio muestra las redes del autor, que solo se cargan después de que la bienvenida del primer inicio pregunta por ellas, y se pueden configurar para cargarse solo al abrirlas (en la bienvenida o en Ajustes → Privacidad).

## Capturas

### Estilo CurseForge

| | |
|---|---|
| ![Crear una instancia](docs/screenshots/curseforge/es/new-instance.webp) | ![Explorar](docs/screenshots/curseforge/es/browse.webp) |
| Crear una instancia: versión de Minecraft y cargador de mods. | Mods y modpacks filtrados por versión del juego, cargador y categoría. |
| ![Servidores](docs/screenshots/curseforge/es/servers.webp) | ![Capturas](docs/screenshots/curseforge/es/gallery.webp) |
| Los servidores más conocidos y la lista de Modrinth en un solo buscador. | Las capturas de todos los perfiles, con filtros. |
| ![Skins 3D](docs/screenshots/curseforge/es/skins.webp) | ![Importar perfiles](docs/screenshots/curseforge/es/import.webp) |
| Tu skin en un mundo de Minecraft, con las animaciones del propio juego. | Importar perfiles desde CurseForge, Modrinth y Prism Launcher. |

### Estilo Modrinth

| | |
|---|---|
| ![Crear una instancia](docs/screenshots/modrinth/es/new-instance.webp) | ![Explorar](docs/screenshots/modrinth/es/browse.webp) |
| Crear una instancia: versión de Minecraft y cargador de mods. | Mods y modpacks filtrados por versión del juego, cargador y categoría. |
| ![Servidores](docs/screenshots/modrinth/es/servers.webp) | ![Capturas](docs/screenshots/modrinth/es/gallery.webp) |
| Los servidores más conocidos y la lista de Modrinth en un solo buscador. | Las capturas de todos los perfiles, con filtros. |
| ![Skins 3D](docs/screenshots/modrinth/es/skins.webp) | ![Importar perfiles](docs/screenshots/modrinth/es/import.webp) |
| Tu skin en un mundo de Minecraft, con las animaciones del propio juego. | Importar perfiles desde CurseForge, Modrinth y Prism Launcher. |

### Temas de temporada

Se ponen solos en su fecha, en los dos diseños.

| | Estilo CurseForge | Estilo Modrinth |
|---|---|---|
| **Halloween**<br>25 de octubre al 1 de noviembre | ![Halloween, estilo CurseForge](docs/screenshots/curseforge/es/season-halloween.webp) | ![Halloween, estilo Modrinth](docs/screenshots/modrinth/es/season-halloween.webp) |
| **Navidad**<br>19 al 26 de diciembre | ![Navidad, estilo CurseForge](docs/screenshots/curseforge/es/season-christmas.webp) | ![Navidad, estilo Modrinth](docs/screenshots/modrinth/es/season-christmas.webp) |
| **Año Nuevo**<br>27 de diciembre al 2 de enero | ![Año Nuevo, estilo CurseForge](docs/screenshots/curseforge/es/season-newyear.webp) | ![Año Nuevo, estilo Modrinth](docs/screenshots/modrinth/es/season-newyear.webp) |

## Descarga

Los instaladores se publican en la página de [Releases](https://github.com/havihub/HaviHub/releases).

| Sistema | Archivo |
|---|---|
| Windows 10 y 11 (64 bits) | `HaviHub-<versión>-Setup.exe` (instalador) o `HaviHub-<versión>-portable.exe` |
| Linux (x86-64), cualquier distribución | `HaviHub-<versión>-linux-x86_64.AppImage` |
| Debian, Ubuntu y derivadas | `HaviHub-<versión>-linux-amd64.deb` |

Las versiones para Windows todavía no tienen firma digital, por lo que SmartScreen puede mostrar un aviso la primera vez que se abren ("Más información" y luego "Ejecutar de todas formas"). Cada release indica la suma SHA-256 de cada archivo. Cómo se compilan y cómo se van a firmar los archivos está en la [Code signing policy](https://havihub.github.io/code-signing-policy/).

Para jugar se necesita una cuenta de Microsoft que tenga Minecraft Java Edition. La primera vez que se abre, Havi Hub descarga su motor de juego, de unos 45 MB.

## Cómo funciona

Prism Launcher no viene incluido en los instaladores. La primera vez que se abre, Havi Hub descarga la versión portable oficial desde las [releases de Prism Launcher](https://github.com/PrismLauncher/PrismLauncher/releases), la compara con la suma SHA-256 que publica GitHub y desde entonces la mantiene actualizada. Antes de usarla, Havi Hub cambia el nombre, el logo y la página de confirmación de inicio de sesión que muestra el motor, para que sus ventanas coincidan con el resto de la aplicación. Ese cambio está completo en [`src/main/engine-brand.js`](src/main/engine-brand.js).

Las imágenes y los sonidos del juego (el logo de Minecraft, bloques, objetos, skins) se leen de los archivos de Minecraft que están en el computador. Si el juego todavía no se ha descargado, Havi Hub baja una vez su archivo de cliente desde los servidores de Mojang. Ninguna imagen ni sonido de Mojang se incluye en este repositorio ni en los instaladores.

Los datos se guardan en:

- Windows: `%APPDATA%\havihub` (perfiles, cuentas y ajustes) y `%LOCALAPPDATA%\havihub` (el motor).
- Linux: `~/.config/havihub`.

En Windows, desinstalar Havi Hub borra la aplicación y su motor, pero conserva los perfiles, los mundos y los ajustes.

## Compilar desde el código

Se necesita Node.js 22 o superior. Para el instalador de Windows también se necesita [Zig](https://ziglang.org), que compila un pequeño programa auxiliar (la forma más simple de obtenerlo es `pip install ziglang`).

```sh
git clone https://github.com/havihub/HaviHub.git
cd HaviHub
npm ci
npm start            # compilar y abrir
npm test             # pruebas
npm run dist:win     # instalador, versión portable y zip de Windows, en release/
npm run dist:linux   # AppImage y .deb, en release/ (en Linux)
```

Las versiones oficiales incluyen la API key de CurseForge propia de Havi Hub, que no forma parte del código. Para compilar con una key propia, se define la variable de entorno `HAVIHUB_CF_KEY` antes de compilar. Sin key, la aplicación funciona con Modrinth y cada persona puede ingresar su propia key de CurseForge en Ajustes → Addons.

## Contribuir

Los reportes de errores, las sugerencias y los pull requests son bienvenidos, en español o en inglés. Antes, revisa [CONTRIBUTING.md](CONTRIBUTING.md). Los problemas de seguridad se informan de forma privada, como se explica en [SECURITY.md](SECURITY.md).

## Licencia

Havi Hub es software libre, publicado bajo la [Licencia Pública General de GNU, versión 3](LICENSE).
Copyright © 2026 Havikun.

Los componentes de terceros incluidos en la aplicación, con sus licencias, se pueden ver en Ajustes → Licencias.

## Aviso

NO ES UN PRODUCTO OFICIAL DE MINECRAFT. NO ESTÁ APROBADO POR MOJANG NI MICROSOFT, NI ASOCIADO CON ELLOS.

Havi Hub no está afiliado ni respaldado por el proyecto Prism Launcher, CurseForge (Overwolf) ni Modrinth. Sus nombres y logos se usan solo para indicar de dónde viene cada contenido. Minecraft es una marca de Mojang AB.
