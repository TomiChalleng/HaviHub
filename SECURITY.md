# Security policy

*La versión en español está más abajo.*

## Supported versions

Only the latest release receives security fixes. Before reporting a problem, please check that it still happens with the most recent version on the [Releases](https://github.com/havihub/HaviHub/releases) page.

## Reporting a vulnerability

Please do not report security problems in public issues or pull requests. Report them privately through GitHub instead: open the **Security** tab of this repository and choose **Report a vulnerability**, or go directly to the [report form](https://github.com/havihub/HaviHub/security/advisories/new). Only the project's maintainers can see the report.

A useful report includes:

- what the problem is and what someone could do with it;
- the steps to reproduce it, or a proof of concept;
- the Havi Hub version, how it was installed and the operating system.

Havi Hub is maintained by one person, so a reply may take a few days. Once the problem is confirmed, a fix will be prepared and published in a new release, and you will be credited in the advisory unless you prefer otherwise. Please keep the problem private until the fix has been published.

## Scope

This policy covers the code in this repository and the files published in its releases. Some examples of problems to report here:

- a modpack, profile or world that, when installed or imported, can write files outside the folders Havi Hub uses;
- account data, such as a sign-in token, stored or sent where it should not be;
- a way to make Havi Hub download and run something other than the official Prism Launcher build.

Problems in Prism Launcher itself, which Havi Hub uses as its game engine, should be reported to the [Prism Launcher project](https://github.com/PrismLauncher/PrismLauncher/security). Malicious mods or modpacks should be reported to their authors and to the site that publishes them; both CurseForge and Modrinth let you report a project from its page.

## Official downloads

Havi Hub is published only on the [Releases](https://github.com/havihub/HaviHub/releases) page of this repository, which is also where the download buttons of [havihub.github.io](https://havihub.github.io) lead. Every release includes a `SHA256SUMS.txt` file with the SHA-256 checksum of each file. Copies offered on other sites are not official, even if they have the same name.

---

# Política de seguridad

## Versiones con soporte

Solo la última versión recibe correcciones de seguridad. Antes de reportar un problema, revisa que siga pasando con la versión más reciente de la página de [Releases](https://github.com/havihub/HaviHub/releases).

## Reportar una vulnerabilidad

No reportes problemas de seguridad en issues ni en pull requests públicos. Repórtalos en privado a través de GitHub: abre la pestaña **Security** de este repositorio y elige **Report a vulnerability**, o entra directamente al [formulario](https://github.com/havihub/HaviHub/security/advisories/new). Solo los mantenedores del proyecto pueden ver el reporte.

Un reporte útil incluye:

- cuál es el problema y qué podría hacer alguien con él;
- los pasos para reproducirlo, o una prueba de concepto;
- la versión de Havi Hub, cómo se instaló y el sistema operativo.

Havi Hub lo mantiene una sola persona, así que la respuesta puede tardar unos días. Cuando el problema se confirme, se preparará una corrección y se publicará en una versión nueva, y el aviso de seguridad te dará el crédito, salvo que prefieras lo contrario. Te pido no hacer público el problema hasta que la corrección esté publicada.

## Alcance

Esta política cubre el código de este repositorio y los archivos publicados en sus versiones. Algunos ejemplos de problemas que corresponde reportar aquí:

- un modpack, perfil o mundo que, al instalarse o importarse, pueda escribir archivos fuera de las carpetas que usa Havi Hub;
- datos de una cuenta, como un token de inicio de sesión, guardados o enviados donde no corresponde;
- una forma de hacer que Havi Hub descargue y ejecute algo distinto de la versión oficial de Prism Launcher.

Los problemas del propio Prism Launcher, que Havi Hub usa como motor de juego, se reportan al [proyecto Prism Launcher](https://github.com/PrismLauncher/PrismLauncher/security). Los mods o modpacks maliciosos se reportan a sus autores y al sitio que los publica; tanto CurseForge como Modrinth permiten reportar un proyecto desde su página.

## Descargas oficiales

Havi Hub se publica solo en la página de [Releases](https://github.com/havihub/HaviHub/releases) de este repositorio, que es también adonde llevan los botones de descarga de [havihub.github.io](https://havihub.github.io). Cada versión incluye un archivo `SHA256SUMS.txt` con la suma SHA-256 de cada archivo. Las copias que se ofrecen en otros sitios no son oficiales, aunque tengan el mismo nombre.
