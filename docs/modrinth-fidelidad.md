# Fidelidad del layout "Modrinth": comparación con el código original

Comparación línea a línea entre el layout **Modrinth** de Havi Hub (`src/renderer/modrinth/*`, `mr.css`
y los estilos compartidos que hereda) y el **Modrinth App** oficial.

- Fuente de Modrinth: `github.com/modrinth/code`, commit `0444aa6` (2026-11-20).
  - Shell: `apps/app-frontend/src/App.vue`, `app/shell/title-bar/*`, `app/shell/sidebar/*`, `components/ui/NavButton.vue`, `components/ui/QuickInstanceSwitcher.vue`
  - Sistema de diseño: `packages/assets/styles/{variables,defaults,classes}.scss`, `packages/tooling-config/tailwind/tailwind-preset.ts`, `packages/ui/src/components/**`
- Fuente de Havi Hub: rama actual, `f9aad59`.

Las reglas generales que salen de esta comparación, para dibujar cualquier pantalla al estilo
Modrinth, están en [`formula-modrinth.md`](./formula-modrinth.md).

Solo se comparan interfaces que existen en ambos launchers. Lo que es propio de Havi Hub está en la
[sección 12](#12-interfaces-exclusivas-de-havi-hub-fuera-de-esta-comparación).

---

## 0. Antes de nada: cómo convertir medidas

Havi Hub dibuja con un zoom de ventana de **0.8** (`BASE_ZOOM` en `src/main/main.js:145`) y el layout
Modrinth fija `html { font-size: 20px }` (`mr.css:7`). Modrinth App no tiene zoom: `1rem = 16px`.

| Unidad en Havi Hub | Equivale en pantalla a | Para igualar N px de Modrinth usar |
|---|---|---|
| `rem` en `mr.css` | 16 px por rem (igual que Modrinth) | `N / 16 rem` |
| `px` en CSS | 0.8 px | `N × 1.25 px` |
| `<Icon size={n}>` | 0.8·n px | `size={N × 1.25}` (16→20, 20→25, 24→30) |
| `AccountAvatar size`, `Spinner size`, etc. | 0.8·n px | `N × 1.25` |

**Consecuencia:** todo lo que está en `rem` coincide; todo lo que está en `px` o en props numéricas
sale un **20 % más pequeño** que en Modrinth. Casi todos los iconos del layout tienen este problema
(los de la barra de navegación miden 19.2 px en vez de 24 px).

En este documento, salvo que se diga otra cosa, **las medidas están en px de pantalla**.

---

## 1. Problemas globales (afectan a todas las pantallas)

### 1.1 Tamaño base del texto: 12.8 px en lugar de 16 px  ★ el de más impacto

`html[data-layout='modrinth'] body { font-size: 0.8rem }` (`mr.css:22`) y `.mr-app { font-size: 0.8rem }`
dejan el texto heredado en **12.8 px**. Modrinth usa `body { font-size: 16px }` y casi todo hereda
`text-base` (16 px). Los tamaños secundarios son `text-sm` = 14 px y `text-xs` = 12 px.

Escala tipográfica de Modrinth (`defaults.scss` + Tailwind):

| Token | px | Dónde se usa |
|---|---|---|
| `text-xs` | 12 | subtítulo "Minecraft account", chips de filtros resumidos |
| `text-sm` | 14 | metadatos secundarios, tags, pills de filtro, pestañas NavTabs, barra de estado |
| `text-base` | 16 | **texto por defecto**, botones, nombres en tarjetas, breadcrumbs, menús, encabezados de sidebar |
| `text-lg` | 18 | título de tarjeta de proyecto en modo grid |
| `text-xl` | 20 | título de tarjeta de proyecto en modo lista |
| `text-2xl` | 24 | títulos de página (Library, Jump back in, nombre de instancia, modales) |

Cambio: `body`/`.mr-app` a `1rem`, y revisar cada `font-size` en `mr.css` con esta tabla
(hoy hay 0.65rem, 0.7rem, 0.75rem, 0.8rem, 0.9rem, 1.05rem, 1.1rem que no existen en Modrinth).

### 1.2 Pesos tipográficos

Modrinth: regular 400 en el body, **500 (medium) para texto de interfaz**, **600 (semibold) para
títulos, botones y nombres**, 700 en pestañas NavTabs, 800 (extrabold) solo en botones `xl` y en el
título de la pestaña activa de ajustes. Havi Hub usa 700 en todos los títulos (`.mr-h2`,
`.mr-inst-head-text h1`, `.mr-group-toggle`, `.mr-result-title strong`, `.modal-head h2`) y 800 en el
título del proyecto: hay que bajarlos a **600**. Además Modrinth **no usa `letter-spacing`**:
quitar el `-0.01em` de `.mr-h2`, `.mr-wordmark` y `.page h1`.

La fuente (Inter 400–800 de `@fontsource/inter`) ya es la correcta.

### 1.3 Iconos: Material Symbols rellenos → Lucide de trazo

Casi todos los iconos de Havi Hub salen de `icons-bold.js` (Material Symbols, rellenos o peso 600,
pensados para el layout CurseForge). Modrinth usa **Lucide** (`packages/assets/icons`, `lucide-static
0.562`, licencia ISC): `viewBox 0 0 24 24`, `fill: none`, `stroke-width: 2`, `stroke-linecap/linejoin:
round`. Ejemplos visibles: el ▶ de "Inicio" es un triángulo **contorneado** (`play.svg`), no relleno; la
brújula, la camiseta, el engranaje, la descarga, los tres puntos, etc., son de trazo.

Cambio: dar al layout Modrinth su propio juego de iconos Lucide (se pueden importar los SVG de
`lucide-static`) y que `Icon` lo elija cuando `data-layout='modrinth'`. Tamaños estándar de Modrinth:
16 px (`size-4`), 20 px (`size-5`, el más común), 24 px (`size-6`/`text-2xl`, navegación y botones xl).

### 1.4 Tokens de color que faltan

La paleta "Modrinth (original)" de `src/shared/themes.js` coincide con `variables.scss` (surface-1, 3,
4, 5, textos y estados), y las variantes OLED y claro también. Faltan estos tokens, que Modrinth usa
en sitios concretos:

| Token Modrinth | Oscuro | OLED | Claro | Uso |
|---|---|---|---|---|
| `--surface-1-5` | `#1a1c20` | `#050506` | `#ededed` | filas impares de la tabla de contenido |
| `--surface-2` | `#1d1f23` | `#09090a` | `#f5f5f5` | filas pares, fondo del checkbox sin marcar |
| `--surface-2-5` | `#222429` | `#0c0d11` | `#eef1f5` | fila seleccionada |
| `--color-button-border` | `rgba(193,190,209,.12)` | igual | `rgba(161,161,161,.35)` | bordes de checklist y pasos |
| `--color-brand-shadow` | `rgba(27,217,106,.7)` | igual | `rgba(0,175,92,.7)` | anillo de foco (4 px) |
| `--brand-gradient-bg` | `linear-gradient(0deg, rgba(14,35,19,.2), rgba(55,137,73,.1))` | `…rgba(22,66,51,.15), rgba(55,137,73,.1)` | `…rgba(68,182,138,.175), rgba(58,250,112,.125)` | fondo de la barra derecha |
| `--brand-gradient-border` | `rgba(155,255,160,.08)` | igual | `rgba(32,64,32,.15)` | bordes dentro de la barra derecha |
| `--brand-gradient-button` | `rgba(255,255,255,.08)` | igual | `rgba(255,255,255,.5)` | fondo de botones/tarjetas dentro de la barra derecha |
| `--brand-gradient-fade-out-color` | `linear-gradient(to bottom, rgba(24,30,31,0), #171d1e 80%)` | — | `…rgba(213,235,224,0), #d0ece0 70%` | difuminado arriba/abajo de la barra derecha |
| `--color-tooltip-bg` | = surface-3 | = surface-3 | = surface-3 | tooltips |
| `--color-gray` | `#9fa4b3` | igual | `#595b61` | perilla del toggle apagado |
| `--color-focus-ring` | `#ea80ff` | igual | igual | contorno de foco de tarjetas |
| `--color-platform-*` | fabric `#dbb69b`, quilt `#c796f9`, forge `#959eef`, neoforge `#f99e6b`… | igual | fabric `#8a7b71`, forge `#5b6197`… | color de texto de las etiquetas de loader |
| `--shadow-card` | `rgba(0,0,0,.25) 0 2px 4px` | igual | `rgba(50,50,100,.1) 0 2px 4px` | avatares, NavTabs |

`--mr-tint` (accent 10 %) se usa como `--color-green-bg`, que en Modrinth oscuro es **20 %**.

### 1.5 Radios: Modrinth no usa una escala `sm/md/lg/xl` única

Havi Hub reduce todo a `--mr-r-sm/md/lg/xl` (8/12/16/20). Modrinth usa radios distintos según el
componente; los reales son:

| Radio | Componentes |
|---|---|
| 50 % / `full` | IconButton (por defecto **circulares**), NavButton, flechas atrás/adelante, toggle, TagItem, NavTabs, paginación |
| 6 px (`rounded-md`) | checkbox, avatar del breadcrumb |
| 8 px (`rounded-lg`, `--radius-sm`) | botón `xs`, tooltip, tarjeta compacta |
| 10 px | botón `sm`, elementos de menú |
| 12 px (`rounded-xl`) | botón `md`, input estándar, pills de filtro, tarjeta de cuenta, pasos del checklist, pill de estado de la barra de título |
| 14 px | botón `lg`, input `medium/large`, panel de menú, pestañas del modal de ajustes, avatar de "Jump back in" |
| 16 px (`rounded-2xl`) | botón `xl`, tarjeta de proyecto, imagen de la tarjeta de instancia, modal, checklist, icono de la tabla de contenido |
| 20 px (`--radius-xl`) | tarjeta de instancia, fila de "Jump back in", tabla de contenido, modal de ajustes, barra flotante de selección, esquina del panel |
| `tamaño × 16/96` | **todos los `Avatar`** (ver 1.6) |

### 1.6 Avatares (iconos de instancia y de proyecto)

`packages/ui/src/components/base/Avatar.vue` define la fórmula que Modrinth aplica a toda imagen
cuadrada:

```css
border-radius: calc(16 / 96 * size);   /* 64px → 10.67px, 48px → 8px, 96px → 16px */
outline: 1px solid rgb(255 255 255 / 15%);
outline-offset: -1px;
background-color: var(--color-button-bg);
object-fit: contain;                    /* no cover */
box-shadow: var(--shadow-card);         /* salvo no-shadow */
/* pad-transparent-corners: si la imagen tiene esquinas transparentes → padding: size × 6/96 */
/* sin imagen: cubo isométrico gris (#9a9a9a, trazo 5 sobre 104×104) */
/* tint-by: fondo color-mix(button-bg, oklch(50% 75% <hue>) 5%) */
```

Havi Hub usa `border-radius: var(--mr-r-md)` fijo y `object-fit: cover` para todas las imágenes
(`mr.css:2215`). Algunos componentes sobrescriben el radio a propósito (tarjeta de biblioteca 16 px,
"Jump back in" 14 px, icono de la tabla 16 px + borde surface-5); esos se indican en cada sección.

### 1.7 Botones (`ButtonFrame.vue`)

| Tamaño | Alto | Radio | Padding X | Texto | Iconos |
|---|---|---|---|---|---|
| `xs` | 28 | 8 | 6 | 14 px / 600 | 16 |
| `sm` | 32 | 10 | 6 | 14 px / 600 | 16 |
| **`md` (por defecto)** | **36** | **12** | **10** | **16 px / 600** | **20** |
| `lg` | 40 | 14 | 16 | 16 px / 600 | 20 |
| `xl` | 48 | 16 | 14 | 16 px / **800** | 24 |

Gap entre icono y texto: 4 / 4 / 6 / 8 / 8 px. Los botones solo-icono son cuadrados del alto y
**circulares por defecto** (`IconButton` tiene `circular: true`).

Tipos:
- **base**: fondo surface-4, texto contrast, icono text-primary, `box-shadow: inset 0 0 0 1px var(--surface-5), 0 1px 1px rgba(0,0,0,.12)`.
- **colored** (brand/red/…): fondo del color, texto `--color-accent-contrast` (negro en oscuro, blanco en claro),
  `box-shadow: 0 0 0 1px color-mix(color 30%, transparent), 0 2px 4px rgba(0,0,0,.04), 0 5px 8px rgba(0,0,0,.04), 0 10px 18px rgba(0,0,0,.03), 0 24px 48px rgba(0,0,0,.03)`
  y un `::before` con borde degradado de 1 px `linear-gradient(180deg, rgba(255,255,255,.3), transparent)`.
- **outlined**: transparente, `box-shadow: 0 0 0 1px var(--surface-5)`.
- **quiet**: transparente, texto `--color-base`; al pasar el ratón, fondo surface-4.

Interacción: `hover → filter: brightness(1.25)` (0.9 en tema claro), `active → scale(.97)`,
foco → `ring 4px var(--color-brand-shadow)`, deshabilitado `opacity .5`, transición
`background-color, color, box-shadow, filter, opacity, transform 150ms ease-out`.

Diferencias con `.mr-btn` / `.mr-icon-btn` (`mr.css:623`, `663`): texto 12.8 px en vez de 16 px,
padding 14 px en vez de 10 px, sin el anillo interior de surface-5 (base) ni el degradado/sombras
(colored), hover 1.2 en vez de 1.25 (0.92 en vez de 0.9 en claro), active .97 ✓, `.mr-icon-btn`
cuadrado con radio 12 px en vez de circular, `.lg` = 44 px (no existe en Modrinth: es 40 `lg` o 48 `xl`).
Los `.btn` compartidos sobrescritos en `mr.css:1648+` tienen los mismos problemas.

### 1.8 Inputs (`InputFrame.vue`, `Input.vue`)

| Tamaño | Alto | Radio | Padding X | Texto |
|---|---|---|---|---|
| small | 32 | 12 | 12 | 14 |
| **standard** | **36** | **12** | **12** | **16** |
| medium | 40 | 14 | 16 | 16 |
| large | 48 | 14 | 16 | 16 |

Fondo surface-4, **borde 1 px surface-5**, texto 16 px / 500 text-primary (contrast al enfocar),
placeholder text-secondary, icono 20 px text-secondary al 60 % (contrast al 100 % al enfocar). Foco:
`ring 4px brand-shadow` (no cambia el color del borde). Botón de borrar integrado.

`.mr-search` (`mr.css:717`): borde transparente → surface-5; foco con borde accent → anillo de 4 px;
texto 12.8 → 16 px; icono 14.4 → 20 px; `.lg` mide 44 px → 48 px con radio 14 px.

### 1.9 Controles pequeños

| Control | Modrinth | Havi Hub hoy |
|---|---|---|
| **Toggle** | 48×24, `p-1`, borde 1 px surface-5, apagado fondo button-bg y perilla 16 px `--color-gray`; encendido fondo brand y perilla **negra 90 %** desplazada 24 px; versión `small` 40×20 con perilla 12 px | 40×22.4 sin borde, perilla 16 px text-muted; encendida **blanca** (`components.css:128`) |
| **Checkbox** | 20×20, radio 6 px, borde 1 px; vacío fondo **surface-2** borde surface-5; marcado fondo brand, borde button-border, check negro trazo 3; `active scale .95` | 19.2×19.2, radio 4.8 (`.3rem`), fondo surface2 (#34363c), sin borde |
| **TagItem** (chips) | pill, `px-2 py-1`, 14 px / **400**, fondo button-bg, borde 1 px surface-5, texto secondary, iconos 16; loaders con `--color-platform-*` | `.mr-tag` 24 px de alto, 10.4 px / 600, sin borde, sin color por loader |
| **BulletDivider** | punto de 6 px, surface-5, `mx-0.5` | `.mr-dot` 4 px text-muted |
| **Tooltip** | fondo surface-3, texto contrast, `padding .625rem .75rem`, radio 8 px, 14.4 px / 500, `line-height 1`, borde 1 px surface-5, `drop-shadow(0 2px .4rem rgba(0,0,0,.5))`, con flecha | el de CurseForge: fondo surface2, texto text2, padding 14/16, radio 1.6 px, sin borde, `line-height 1.25` (`components.css:993`, sin override en `mr.css`) |

### 1.10 Menús emergentes (`button-menu.ts`)

- Panel: radio **14 px**, fondo surface-3, `shadow-lg`, **ring 1 px surface-5**, padding 8 px, con **flecha** de 10 px girada 45° que apunta al botón.
- Elemento: alto mínimo 40, radio 10, `px-3 py-2`, **16 px / 600**, texto contrast, iconos 20 px text-primary, hover surface-4. Tonos (rojo/verde) con `--button-menu-item-tone`.
- Separador: 1 px surface-5, `my-1`. Encabezado: 12 px / 700, mayúsculas, `tracking-wide`, secondary.

Havi Hub (`mr.css:1635`): radio 12, borde surface2 (#34363c) en vez de surface-5, texto 12.8 px,
elementos con radio 8, sin flecha, sombra `0 12px 32px rgba(0,0,0,.4)`.

### 1.11 Modales (`NewModal.vue`)

- Caja: fondo surface-3, radio **16 px**, borde 1 px surface-5.
- Cabecera: `p-6`, borde inferior surface-5, título **24 px / 600** contrast, botón cerrar = IconButton base circular de 36 px.
- Cuerpo `p-6`; acciones `p-4` (con separador superior opcional).
- Fondo: `linear-gradient(to bottom, rgba(29,48,43,.52), rgba(14,21,26,.95))` + `backdrop-filter: blur(5px)`; variantes `warning` (`rgba(48,38,29,.52)→rgba(26,20,14,.95)`) y `danger` (`rgba(43,18,26,.52)→rgba(49,10,15,.95)`).
- Entrada: `opacity 0 → 1`, `scale .97 → 1`, 0.2 s, con origen en la posición del ratón.

Havi Hub (`mr.css:1688`): radio 20, borde surface2, cabecera 17.6/20 px con título 17.6 px / 700,
cuerpo 12/20 px, pie 14/20 px; fondo `--overlay` plano sin blur.

### 1.12 Pestañas (`NavTabs.vue`)

Contenedor pill: fondo surface-3, `p-1`, **borde 1 px surface-4 + `--shadow-card`**, texto **14 px /
700**. Pestaña `px-4 py-2`, gap 8, icono 20 px; inactiva **text-secondary** sin fondo al pasar el
ratón (solo `active: scale(.95)`); activa texto brand. El fondo activo es **un indicador que se
desliza** (`position:absolute`, brand-highlight, transición 80 ms `cubic-bezier(.4,0,.2,1)` en
left/right/top/bottom); si la ruta es una subpágina, el indicador es button-bg.

`.mr-tabs`/`.mr-tab` y `.tabs` compartidas (`mr.css:829`, `2103`): texto 12.8 px / 600, color text2,
hover con fondo surface2 (no existe), fondo activo fijo por pestaña (sin deslizamiento), sin sombra,
contadores dentro de la pestaña (no existen).

### 1.13 Movimiento e interacción

- Curva de Modrinth: `--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1)` (Havi Hub ya la usa en `.mr-navbtn`).
- Tarjetas clicables (`SmartClickable`): hover `brightness(1.25)`, título subrayado, icono a opacidad .85; `active scale(.98)`; foco `outline .25rem #ea80ff`.
- Tarjetas de biblioteca: hover `brightness(1.1)`, `active scale(.95)`.
- Acordeones: altura animada con `grid-template-rows 0.3s ease-out-expo`; el chevron (`DropdownIcon`, que apunta hacia abajo) **rota 180°** en 300 ms. Havi Hub cambia el icono (`chevronRight`/`chevronDown`) sin animación.

### 1.14 Barras de desplazamiento

Modrinth: 16 px de ancho con borde transparente de 5 px → pulgar visible de ~6 px, radio 16 px, color
`--color-scrollbar` (= surface-5), pista transparente; la barra derecha usa OverlayScrollbars (barra
superpuesta que no ocupa espacio). Havi Hub: 8 px (10 CSS px) con el estilo compartido.

---

## 2. Marco de la aplicación

| Elemento | Modrinth | Havi Hub | Estado |
|---|---|---|---|
| Grid | barra de título 3rem, barra izquierda 4rem, barra derecha **300 px** | 3rem / 4rem / 18.75rem (= 300 px) | ✓ |
| Fondo del marco | surface-3 | `--sidebar` (= surface-3) | ✓ |
| Panel de contenido | fondo surface-1, esquina sup. izq. 20 px | igual | ✓ |
| Contorno del panel | `::before` fijo encima del contenido (z 30): borde 1 px surface-5, radio 20, **`box-shadow: 1px 1px 15px rgba(0,0,0,.1) inset`** | borde 1 px superior e izquierdo surface3, sin sombra interior | falta la sombra interior |
| Barra de carga | `LoadingBar` de 2rem de zona, pegada bajo la barra de título y recortada con la esquina de 20 px | no existe | añadir |
| Ventana mínima | 1100×700, inicial 1280×800 | 832×528 px de pantalla (1040×660 × 0.8) | revisar |

## 3. Barra de título (`app/shell/title-bar`)

| Elemento | Modrinth | Havi Hub (`MrShell.jsx` TitleBar, `mr.css:39–209`) |
|---|---|---|
| Márgenes | `pl-1` + `p-2` → contenido a 12 px del borde | 12 px ✓ |
| Logotipo | `TextLogo` de **28 px** de alto, color contrast | logo 20.8 px + texto 16.8 px / 800 con `letter-spacing` (la marca es propia; igualar la altura total a 28 px) |
| Separación logo → flechas | 8 px (`ml-2`) | 4 + 8 px |
| Flechas atrás/adelante | IconButton outlined **circular** 28×28, borde 1 px surface-4 + anillo 1 px surface-5, sin fondo; chevron 16 px text-primary; deshabilitada: **solo el icono** al 20 %; gap 8 | cuadradas con radio 8, borde surface2; chevron 12.8 px; deshabilitada: todo el botón al 35 %; hover rellena surface2 |
| Breadcrumbs | `pl-4` (16 px) tras las flechas, gap 8 entre elementos, **16 px / 500**, `leading-6`; anteriores **text-primary** → contrast al pasar el ratón (sin subrayado); último contrast; separador chevron **20 px** text-primary; pueden llevar avatar de 20 px (radio 6) o icono 20 px; si no caben, máscara degradada de 12 px y desplazamiento animado de 10 s al pasar el ratón | 12.8 px / 600, anteriores text-muted y subrayado al pasar; separador 11.2 px; sin avatar de la instancia; recorte con elipsis y `max-width 14rem` |
| Botón de descargas | IconButton quiet 36 px; **solo aparece si hay descargas** activas; las descargas se muestran como notificación emergente abajo a la derecha | siempre visible; anillo de progreso propio; abre un popover |
| Indicador de instancia en ejecución | **siempre visible**: borde 1 px surface-5, radio 12, `py-1.5 px-3`, **14 px / 500**, gap 8. Sin nada: punto de 8 px secondary + "No instances running" en secondary. Con instancia: icono "online" verde, nombre contrast (subrayado al pasar), `StopCircle` 20 px rojo, `TerminalSquare` 20 px secondary (abre los logs); con varias, desplegable para elegir la principal | solo aparece mientras se juega; pill rellena surface2, radio 999, alto 36, 600; punto accent con halo; botón stop cuadrado |
| Botón "⋯" | no existe en Modrinth | propio de Havi Hub (ver 12) |
| Separación acciones → controles | `mr-3` (12 px) | 12 px ✓ |
| Controles de ventana | bloque fijo arriba a la derecha de 48 px de alto, fondo surface-3, **esquina inf. izq. 16 px**, `px-1.5`, gap 8; tres IconButton **quiet circulares de 36 px** con iconos 20 px; cerrar: hover **fondo `--color-red` (#ff496e) e icono negro** | botones rectangulares de 44×48 a ras del borde (estilo Windows), iconos 12–13.6 px; cerrar hover `#e81123` e icono blanco |

## 4. Barra de navegación izquierda (`App.vue`, `NavButton.vue`, `QuickInstanceSwitcher.vue`)

| Elemento | Modrinth | Havi Hub (`MrShell.jsx` NavBar, `mr.css:210–340`) |
|---|---|---|
| Padding / gap | `p-2 pt-0`, gap 4 | ✓ |
| Botón | 48×48 circular, icono **24 px**, color text-primary | 48×48 ✓, icono **19.2 px** |
| Hover | fondo **surface-4 directo** + texto contrast (`transition-all`) | `::before` que crece de 0.4 a 1 (en Modrinth esa animación es solo para el estado activo) |
| Activo | `::before` brand-highlight que pasa de `scale .4, opacity 0` a `1`, 0.25 s ease-out-expo; texto brand; **icono con `drop-shadow(0 0 .5rem black)`** | igual pero sin el `drop-shadow` |
| Subpágina | fondo button-bg + **texto contrast** | fondo surface2, texto text2 |
| Icono de Inicio | ▶ Lucide de trazo, desplazado 2 px a la derecha (`ml-0.5`) | ▶ relleno sin desplazamiento |
| Separador superior | contenedor de 17 px de alto con línea **32×1 px** surface-5 | 24×1 px, margen 4 px |
| Instancias recientes | cantidad **automática según la altura disponible** (hasta el máximo), ordenadas por `max(creada, última vez jugada)`, incluye las nunca jugadas; cada una es un NavButton circular de 48 px con **Avatar de 28 px** (radio 4.67 px, contorno 15 %, rellena esquinas transparentes); activa = círculo brand-highlight detrás; instalando = avatar al 25 % de brillo y escala .85 con spinner 16 px; menú contextual: Play/Stop, View instance, Open folder | máximo 4, solo las jugadas; imagen de 40 px con radio 12 en un botón con radio 12; activa = anillo interior de 2 px accent; punto verde cuando está en ejecución (no existe en Modrinth) |
| Separador inferior | línea 32×1 px surface-5 con `py-2`, **arrastrable** para cambiar cuántas instancias se ven (rojo al pasarse del límite) | no existe |
| Botón "+" (crear instancia) | NavButton normal | con **borde discontinuo** de 1.5 px (no existe en Modrinth) |
| Ajustes y cuenta | al fondo, avatar de cuenta 32 px circular sin sombra | ✓ posición; avatar 25.6 px |
| Animación de entrada | instancias nuevas entran con `scale .5 → 1`, `translate -2rem`, y un "pop" brand-highlight | no hay |

## 5. Barra derecha (`app/shell/sidebar`)

### 5.1 Contenedor

| | Modrinth | Havi Hub (`mr.css:386–470`) |
|---|---|---|
| Páginas donde aparece | **todas** por defecto (se puede ocultar con un botón en la barra de título si el ajuste lo permite); forzada en Browse, Project y User | solo home/library/instance/browse/discover; oculta en Project, Skins, Capturas, Servidores, Ayuda |
| Fondo | `--brand-gradient-bg` (ver 1.4) | `linear-gradient(accent 6% → 2.5%)`: tono distinto (accent puro en vez de verdes apagados) |
| Borde izquierdo | 1 px `--brand-gradient-border` + sombra `-15px 0 15px -15px rgba(0,0,0,.1) inset` a su izquierda | 1 px `--border` (#34363c) |
| Bordes entre secciones | 1 px `--brand-gradient-border` | 1 px accent 10 % |
| Tokens dentro | `--color-button-bg` y `--surface-4` = `rgba(255,255,255,.08)`; `--surface-5` y divisores = `--brand-gradient-border` | colores fijos por componente |
| Scroll | OverlayScrollbars + difuminados de 32 px arriba/abajo (`--brand-gradient-fade-out-color`) | scroll nativo, sin difuminados |
| `margin-top` | 1 px (`mt-px`) | 0 |
| Orden | 1) checklist de primeros pasos (**también encima del contenido de Browse**), 2) contenido teletransportado de la página **o** 3) "Playing as", amigos, banner, noticias | contenido de la página **o** (Jugando como, Primeros pasos, Descargando, canales de Havikun) |

### 5.2 "Playing as"

- Sección `p-4`; título **16 px / 500 text-primary** (Havi Hub: 12.8 px / 600 en blanco). Solo se muestra si ya se inició sesión en Minecraft alguna vez.
- Tarjeta: `mt-2` (8 px), fondo button-bg (blanco 8 %), **borde 1 px surface-5** (verde 8 %), radio 12, `px-3 py-2`, gap 8; Avatar 36 px (radio 6); nombre 16 px contrast; debajo "Minecraft account" 12 px secondary; chevron 20 px que **rota**.
- **Se despliega en el sitio** (acordeón, no un menú flotante): lista de cuentas con radio-buttons de 20 px (brand si es la activa), avatar 24 px, nombre (activa 600 contrast, resto text-primary), botón de borrar circular con hover rojo, y botón "Add account" a lo ancho.
- Sin cuentas: tarjeta con texto y botón colored brand "Sign in to Minecraft".
- Havi Hub: sin borde, padding 8/12/8/8, gap 12, avatar 28.8 px con radio 8, subtítulo 11.2 px, abre un **popover**.

### 5.3 Checklist "primeros pasos" (`features/onboarding/checklist.vue`)

- Sección `px-3 py-4`, separador inferior.
- Tarjeta-acordeón abierta por defecto, radio **16 px**, texto 16 px. Cabecera: fondo button-bg, borde 1 px button-border, `p-3`, título 600 contrast `leading-6`, chevron que rota; hover `brightness(1.1)`. Cuerpo: borde surface-5 sin borde superior, fondo button-bg, `p-3`, gap 8.
- Paso: botón de **40 px** de alto, radio 12, borde 1 px button-border, fondo button-bg, `px-4`, gap 8, texto text-primary 500, sombra `0 1px .5px rgba(0,0,0,.12)`; icono radio-button vacío 20 px; hover `brightness(1.1)`, active `brightness(.9)`.
- Completado: opacidad .5, círculo de 18 px **relleno con text-primary** con un check negro de 12 px, texto tachado en secondary.
- Havi Hub: título suelto `h3` + chevron, pasos con fondo blanco 5 %, radio 12, sin borde, iconos `checkCircle`/`circle` de 16 px, completado en accent.

### 5.4 Noticias (referencia para los canales de Havikun)

`h3` 16 px / 500 text-primary con `mb-4`; tarjetas `NewsArticleCard` separadas 16 px; al final un
botón **colored brand xl** "View all news". Es la plantilla a seguir para "Canales de Havikun"
(sección 12).

## 6. Ajustes (`features/settings/app-settings-modal` → `TabbedModal.vue`)

| | Modrinth | Havi Hub (`mr.css:515–595`) |
|---|---|---|
| Tamaño | **928 px** de ancho; cuerpo de `min(65vh, 640px)` + cabecera | 66rem × 46rem (1056 × 736) |
| Caja | fondo surface-3, radio 20, borde surface-5 | radio 20 ✓, fondo surface ✓, borde surface2 |
| Cabecera | barra con "Settings" **24 px / 600**, botón cerrar circular base 36 px, `p-6`, borde inferior | sin cabecera; botón cerrar flotante arriba a la derecha |
| Fondo de la app | degradado + blur 5 px (como todos los modales) | negro 60 %, sin blur |
| Columna de pestañas | **250 px**, `px-4 pt-4`, gap 8, borde derecho surface-5, fondo surface-3 | 240 px, `padding 20/12`, borde surface2 |
| Pestaña | alto **44 px**, radio **14**, `px-4`, gap 8, **16 px / 600**, icono 20 px; inactiva text-primary, hover surface-4 + contrast; activa fondo **`color-mix(brand 30%, transparent)`** y texto brand; `active scale(.97)` | 12.8 px / 600, radio 12, padding 8/12, activa brand-highlight (25 %) |
| Títulos de categoría | 14 px / **800**, mayúsculas, secondary, `px-4 pb-1.5 pt-1` | 11.2 px / 600 |
| Zona de contenido | fondo surface-3 (misma que la caja) | fondo `--bg` (surface-1) |
| Cambios sin guardar | barra flotante `UnsavedChangesPopup` abajo | — |

## 7. Inicio / Biblioteca (`pages/Index.vue`, `components/ui/library/*`)

### 7.1 Página

`p-6` y **gap 12 px** entre bloques (Havi Hub: gap 16 px en `.mr-page`).

### 7.2 "Jump back in" (`RecentWorldsList.vue`, `InstanceItem.vue`)

| | Modrinth | Havi Hub (`MrHome.jsx` JumpBackIn, `mr.css:916`) |
|---|---|---|
| Título | 24 px / 600 `leading-none`, **plegable** (acordeón con chevron), `mt-1 mb-3` | `.mr-h2` 24 px / 700, no plegable |
| Disposición | **filas a todo el ancho**, una columna (dos solo si cada una cabe a ≥670 px), gap 12 | rejilla de tarjetas de ≥17rem |
| Elementos | hasta **5**; mezcla instancias **y mundos/servidores** recientes; instancias nuevas con etiqueta "New" verde y fondo surface-2 con borde discontinuo; **redimensionable** arrastrando una manija de dos líneas | 4 instancias |
| Fila | **80 px** de alto, fondo surface-3, borde 1 px surface-4, radio **20**, `p-3`, grid `auto · 3fr · 4fr · auto`, gap 8 | radio 16, padding 12, flex |
| Icono | Avatar **48 px** con radio **14** | 44 px con radio 12 |
| Textos | nombre 16 px / 600 contrast; debajo, 14 px secondary: "Fabric 1.20.1 • hace 2 horas" con punto de 6 px | nombre 12.8 px; icono de reloj + "Jugado hace…" 11.2 px |
| Acciones | botón **colored green md** "Play" (o red "Stop") + **menú "⋮" quiet** | botón brand/danger con texto, sin menú |
| Interacción | hover `brightness(1.1)` (se anula al pasar sobre los botones), `active scale(.99)`, menú contextual | `brightness(1.08)` |

### 7.3 Encabezado y barra de herramientas de la biblioteca

- Título "Library" 24 px / **600** (Havi Hub 700 + letter-spacing).
- **Dos filas** (`flex-col gap-2`):
  1. Input de búsqueda estándar (min 16rem, **ocupa el resto**) · botón base "New group" (icono `square-plus`) · botón colored brand "New instance".
  2. Menú de orden · separador vertical 1×24 px surface-5 con `mx-2` · menú de filtros.
- Havi Hub: una sola fila con búsqueda de ancho fijo, combos "Ordenar"/"Agrupar", espaciador, "Nuevo grupo", "Importar" y "Crear instancia".

### 7.4 Grupos

| | Modrinth | Havi Hub (`mr.css:1010–1075`) |
|---|---|---|
| Contenedor | sin padding ni borde; `pb-3` | padding 8 px, borde discontinuo transparente de 2 px, radio 20 |
| Cabecera | **40 px**, **borde inferior 1 px surface-5**, gap 8 | 36 px mínimo, sin borde |
| Chevron | `DropdownIcon` 20 px secondary (primary al pasar), **rota 180°** | cambia entre `chevronRight`/`chevronDown` de 14.4 px |
| Nombre | **16 px / 600 text-primary** → contrast al pasar; editable en el sitio | 14.4 px / 700 contrast |
| Contador | **TagItem** (pill con borde surface-3 y fondo surface-2) | texto suelto 12 px muted |
| Acciones | botones de grupo a la derecha (mover arriba/abajo, añadir, renombrar, borrar) | menú "⋯" |
| Rejilla | `mt-2.5` (10 px) | gap 8 |
| Indicador al soltar | rectángulo 8 px más ancho, radio 12, borde **2 px discontinuo contrast al 40 %** | borde accent y fondo tintado |
| Grupo vacío | 16 px secondary al 80 % | 12 px muted con margen izquierdo |
| Favoritos | grupo especial "Favorites" arriba | — |

### 7.5 Tarjeta de instancia (`instance-card-view.vue`, `instance-card.vue`)

| | Modrinth | Havi Hub (`mr.css:1062–1150`) |
|---|---|---|
| Rejilla | ancho mínimo **10rem (8rem si la ventana mide <1280 px)**, gap 12 | 10rem fijo ✓, gap 12 ✓ |
| Tarjeta | fondo surface-3, borde 1 px surface-4, radio **20**, `p-3`, gap 12, contenido alineado abajo | ✓ |
| Imagen | cuadrada, radio **16**, Avatar sin sombra, rellena esquinas transparentes | ✓ radio; `object-fit: cover` en vez de `contain` |
| Botón Play | **IconButton colored brand `lg` (40 px, circular)** en un hueco de 48 px a 6 px de la esquina; `origin-bottom`, `scale .75 → 1` y opacidad al pasar el ratón; con sombras de "colored" | 44 px, sombra `0 4px 12px rgba(0,0,0,.35)` |
| Stop | IconButton colored **red** lg, siempre visible | ✓ (danger) |
| Instalando | velo surface-1 al 30 % + spinner al 30 % del ancho | spinner 16 px dentro del botón |
| Nombre | **16 px / 600** contrast, `leading-5`, tooltip si se corta | 12.8 px / 600 |
| Versión | **14 px / 500** text-primary, `capitalize`, `leading-[18px]` | 11.2 px / 500 |
| Interacción | hover `brightness(1.1)`, **pulsada `scale(.95)`**, foco `outline 2px -2px` | `scale(.97)` |
| Seleccionada | borde text-primary al 40 % + `brightness(1.1)` (selección múltiple con botón propio) | — |
| Modo compacto | fila de 64 px, icono 40 px radio 8 | — |

## 8. Página de instancia (`pages/instance/layout.vue`, `components/page-header`)

| | Modrinth | Havi Hub (`MrInstance.jsx`, `mr.css:1151–1240`) |
|---|---|---|
| Espaciado | cabecera `p-6 pr-2 pb-4`; pestañas `px-6`; contenido `p-6 pt-4` | bloques con gap 20 dentro de padding 24 |
| Separador | la cabecera (`PageHeader`) tiene **borde inferior divider** y `pb-4` | sin separador |
| Icono | Avatar 64 px → radio **10.67**, contorno blanco 15 %, `--shadow-card` | radio 16, sin contorno ni sombra |
| Título | **24 px / 600** `leading-none` contrast | 24 px / 700 |
| Metadatos | `gap-x 1.625rem` (26 px) con **punto de 6 px surface-5** centrado en el hueco; texto **secondary 500** `leading-none`; iconos **20 px**: icono del propio loader + "Fabric 1.20.1", `Timer` tiempo jugado, `Clock` "última vez" | gap 8, punto de 4 px, texto text2, iconos 12.8 px |
| Botón Play | **colored brand `xl`**: 48 px, radio 16, `px-3.5`, **16 px / 800**, icono 24 | `lg` 44 px, radio 12, 14.4 px / 600, icono 16 |
| Elegir mundo/servidor | en Modrinth solo las instancias de servidor usan `SplitButton` (mismo tamaño xl) | botón partido siempre (función propia; aplicar el estilo de SplitButton) |
| Stop | colored **red** xl "Stop" con `StopCircle` | danger ✓ |
| Ajustes | IconButton **base xl** (48 px circular con anillo surface-5), icono 24 | 44 px, icono 17.6 |
| Más | IconButton **quiet xl**, icono `MoreVertical` 24 | 44 px quiet ✓ forma |
| Pestañas | NavTabs (ver 1.12). Orden: **Content, (Files), Screenshots, Worlds, Logs, (Share)**; iconos `Boxes`, `FolderOpen`, `Image`, `Globe`, `TerminalSquare`, `UserPlus`; sin contadores | orden Contenido, Mundos, Registros, Capturas; contador de mundos |

## 9. Pestaña de contenido (`layouts/shared/content-tab`)

### 9.1 Barra de herramientas

- Fila 1: **Input `medium`** (40 px, radio 14) que ocupa el resto, con placeholder "Search N projects…" · botón **outlined `lg`** "Upload files" (`FolderOpen`) · botón **colored brand `lg`** "Browse content" (`Compass`).
  Havi Hub: búsqueda de 36 px, botón base y botón brand `md`.
- Fila 2 (gap-x 16, gap-y 8): menú de orden (botón de **34 px**, 14 px / 500, icono del modo + chevron) · separador 1×24 px surface-5 · **FilterPills** · filtros de metadatos (dropdowns de 34 px).
  Havi Hub: `<select>` dentro de una caja, icono de filtro, `.mr-pill` con contadores, pill "ghost" de estado, botones de texto "Actualizar todo"/"Recargar".
- **FilterPills**: icono `Filter` 20 px secondary, gap 6; pill **radio 12 (no 999)**, borde 1 px, `px-3 py-1.5`, **14 px / 500**; inactiva borde surface-5, **fondo transparente**, text-primary, hover surface-3; activa borde brand, fondo brand-highlight, texto brand. Sin contadores.

### 9.2 Tabla (`ContentCardTable.vue`, `ContentCardItem.vue`)

| | Modrinth | Havi Hub (`mr.css:1297–1420`) |
|---|---|---|
| Contenedor | borde 1 px **surface-4**, radio **20**, `shadow-sm` | borde surface2 ✓ color, radio 16, sin sombra |
| Cabecera | **48 px**, fondo surface-3, `px-3`, gap-x 16, **pegajosa** (al quedar pegada pierde las esquinas y gana `shadow-md`); textos **600 secondary**; columnas Project / Version ordenables con chevron 16 | 44 px, texto contrast, no pegajosa |
| Columnas | `minmax(0,1.2fr) · minmax(0,1fr) · <ancho medido de acciones>`; se reorganiza en compact/stacked/narrow según el ancho | `2.75rem · 2.4fr · 1.6fr · 15.5rem` |
| Filas | **74 px**; fondos **alternos surface-2 / surface-1.5**, seleccionada **surface-2.5**; separador superior surface-4; deshabilitada `opacity .5 + grayscale` | 60 px, fondo surface-1 uniforme, hover blanco 2 %, seleccionada accent 10 %; deshabilitada `opacity .5` sin grayscale |
| Celda de proyecto | checkbox, gap 16; icono **48 px radio 16 con borde surface-5**; nombre 16 px / 600 contrast `leading-6` con **icono del tipo de proyecto 20 px** antes; debajo **avatar del autor 24 px** + nombre 14 px secondary | icono 40 px radio 12; icono de tipo 11.2 px después del nombre; subtítulo 11.2 px |
| Celda de versión | número de versión 600 contrast; nombre de archivo secondary | versión contrast + 11.2 px muted |
| Acciones | gap 8: actualizar (IconButton, hover **verde**), cambiar versión (`ArrowLeftRight`), **Toggle 48×24**, borrar, "⋮"; iconos 20 px | iconos 14.4 px; toggle 40×22.4 |
| Selección múltiple | **barra flotante** abajo (`FloatingActionBar`): radio 20, fondo surface-3, borde surface-5, sombras `0 1px 3px rgba(0,0,0,.3), 0 6px 10px rgba(0,0,0,.15)`, `px-3 py-2.5`, con avatares apilados de 32 px y separadores 1×24 | barra en línea encima de la tabla con fondo tintado |
| Contenido gestionado | tarjeta "ManagedContentCard" del modpack arriba + título "Additional content" 20 px / 600 | — |

## 10. Descubrir contenido (`layouts/shared/browse-tab`)

### 10.1 Página

| | Modrinth | Havi Hub (`MrBrowse.jsx`, `mr.css:1430–1630`) |
|---|---|---|
| Página | `p-6`, **gap 8** | padding 24, gap 16 |
| Cabecera "instalando en" | **pegajosa**, `-mx-6 -mt-6 mb-4`, fondo surface-1, esquina 20, borde inferior surface-5, `px-6 py-4`; PageHeader: botón atrás **IconButton base xl** (48 px) con `LeftArrow`, Avatar 48 px, título **24 px / 600** `leading-8` truncado, metadatos (loader, versión) con puntos | botón 36 px, imagen 36 px, "Agregando contenido a" 11.2 px + nombre 14.4 px, chip |
| Pestañas de tipo | NavTabs (ver 1.12) | `.mr-tabs` |
| Búsqueda | Input **`large`** (48 px, radio 14) a todo el ancho, placeholder "Search modpacks…" | 44 px, radio 12, borde accent al enfocar |
| Controles | Combobox base **16rem** con prefijo "Sort by:" (600 text-primary) · Combobox **9rem** "View:" (resultados por página) · IconButton de modo de vista (lista/grid/galería) · **paginación** a la derecha | combo "Ordenar por", selector de fuente (propio), contador de proyectos |
| Filtros activos | chips de filtros seleccionados bajo los controles (`SearchFilterControl`) | — |
| Resultados | lista con gap 12 (o grid `minmax(350px,1fr)`), **paginación** también abajo a la derecha | lista con scroll infinito |
| Paginación | botones circulares de 36 px, página actual brand-highlight | — |

### 10.2 Tarjeta de resultado (`ProjectCard.vue`, modo lista)

| | Modrinth | Havi Hub |
|---|---|---|
| Tarjeta | fondo surface-3, borde 1 px surface-4, radio **16**, `p-4`, grid `gap-x 12 gap-y 8` | ✓ |
| Áreas | `icon info actions actions / icon info dummy stats / icon tags tags stats`; bajo 850 px de ancho de tarjeta el icono baja a 64 px y las etiquetas ocupan toda la fila; bajo 550 px todo se apila | áreas `icon info actions / icon tags stats`, sin container queries |
| Icono | Avatar **100 px** (radio 16.67, contorno 15 %, `object-fit: contain`) | 100 px ✓, radio 16, `cover` |
| Título | **20 px / 600** contrast `leading-none`, una línea, **subrayado al pasar sobre la tarjeta** | 17.6 px / 700 |
| Autor | "by X" en **secondary 400**, el nombre subraya al pasar | muted |
| Resumen | **16 px / 400**, 2 líneas, color base | 12.8 px text2, `line-height 1.4` |
| Acciones | botones/IconButton a la derecha (gap 4) | ✓ |
| Estadísticas | descargas (`Download` 20 px) y seguidores (`Heart` 20 px) en **500**, gap 12; fecha "Updated x ago" con icono 20 px | iconos 11.2–13.6 px, fecha 11.2 px |
| Etiquetas | entorno (cliente/servidor) + categorías como **TagItem** con icono 16 px; loaders con su color `--color-platform-*`; desbordamiento con "+N" | `.mr-tag` sin icono, sin borde, sin colores |
| Hover | `brightness(1.25)`, icono a opacidad .85, `active scale(.98)`, foco `outline 4px #ea80ff` | `brightness(1.06)` |

### 10.3 Filtros en la barra derecha (`sidebar.vue`, `SearchSidebarFilter.vue`, `SearchFilterOption.vue`)

| | Modrinth | Havi Hub |
|---|---|---|
| "Hide installed" | sección `p-4` con **Toggle `small`** (40×20) y etiqueta 500 contrast | `mr-side-switch` con toggle grande |
| Sección de filtro | acordeón; cabecera **botón a todo el ancho** `px-3 py-3` con **hover fondo button-bg**, `h3` 16 px, chevron 20 px que rota; separador `--brand-gradient-border`; la primera con `pt-4` | `.mr-side-section` con `h3` 12.8 px / 600 |
| Resumen plegado | si está plegada y tiene selección, chips 12 px / 700 secondary en fondo button-bg | — |
| Opciones | **no son checkboxes**: filas de botón `rounded-xl px-2 py-1`, **14 px / 600 secondary**; hover fondo button-bg + contrast y aparece un ✓ (o 🚫) de 16 px a la derecha; **incluida = fondo brand-highlight + contrast**; **excluida = fondo red-highlight**; botón aparte para excluir; subopciones desplegables | `Checkbox` + texto 12 px (`.mr-check`), hover blanco 4 % |
| Contenido | `mt-2 mb-3`, panel interior `ml-2 mr-3` | lista con alto máximo de 16rem y scroll propio |
| Filtro bloqueado | caja con **borde discontinuo de 2 px** divider, radio 16, `p-3`, texto 700 + descripción 14 px secondary + botón "Unlock" | texto con candado y enlaces |

## 11. Otras páginas compartidas en el layout Modrinth

### 11.1 Proyecto (`pages/project/Index.vue`, `ProjectPageHeader.vue`)

- La **barra derecha se muestra** con la información del proyecto (compatibilidad, enlaces, etiquetas, creadores, detalles), cada bloque como sección con separador. Havi Hub la oculta y muestra esa información dentro de la página.
- Cabecera pegajosa como la de Browse cuando se instala en una instancia.
- `PageHeader`: Avatar **96 px** (radio 16), título **24 px / 600**, resumen de 2 líneas (`max-w 44rem`), metadatos (descargas, seguidores, fecha…) con puntos, acciones con botón de instalar **colored brand xl**, y separador inferior.
  Havi Hub (`mr.css:2142–2160`): icono radio 20, título **28 px / 800**.
- Pestañas NavTabs (Description, Versions, Gallery…).

### 11.2 Skins (`pages/Skins.vue`)

Modrinth muestra el modelo 3D **sin marco** sobre el fondo de la página (alto `80vh`, `sticky top-6`),
con el nombre en 24 px / 700 y botones de acción debajo; las skins en una rejilla de `SkinButton`. Si
no hay sesión, una barra inferior pegajosa (radio 20, surface-3, borde surface-5, `p-4`). La vista de
Havi Hub (tarjeta con escena de cielo y barra de herramientas) es propia; revisar al aplicar la
fórmula.

### 11.3 Capturas (`components/ui/screenshots-page`)

Título 24 px / 700, grupos con cabecera, rejilla de tarjetas, barra de herramientas con separadores
1×24 px surface-5 y contador 16 px / 600 `tabular-nums`. Havi Hub usa la galería compartida con
estilo CurseForge y retoques de radio.

---

## 12. Interfaces exclusivas de Havi Hub (fuera de esta comparación)

No existen en Modrinth App; se rediseñarán con la fórmula cuando esté cerrada. Para cada una se
anota el componente de Modrinth más parecido, que servirá de plantilla:

| Interfaz de Havi Hub | Plantilla de Modrinth |
|---|---|
| Canales de Havikun y tarjeta de apoyo (`MrSocials.jsx`) | sección de noticias de la barra derecha (5.4) |
| "Descargando" en la barra derecha | notificaciones emergentes de descarga (`PopupNotificationPanel`) |
| Modpacks populares en Inicio | tarjeta de proyecto en modo grid (`ProjectCard` grid, `minmax(350px,1fr)`) |
| Agrupar por loader/versión, importar, imagen de grupo | barra de la biblioteca + menús (7.3, 1.10) |
| Selector de fuente (Modrinth/CurseForge/Ambos) | NavTabs en modo local o FilterPills |
| Botón "⋯" de la barra de título | IconButton quiet + menú (1.10) |
| Elegir mundo/servidor al jugar | `SplitButton` xl |
| Barra de destinos al arrastrar perfiles (`.dropbar`) | `FloatingActionBar` |
| Servidores (página) | WorldItem de "Jump back in" + tarjetas de servidor de Browse |
| Decoraciones de temporada | — |
| Bienvenida / elección de layout | `WelcomeScreen.vue` |

---

## 13. Orden de trabajo recomendado

1. **Base tipográfica** (1.1, 1.2) y **conversión de iconos y px** (0, 1.3): es lo que más se nota en todas las pantallas.
2. **Tokens** que faltan (1.4) y fórmula de **Avatar** (1.6).
3. **Primitivas**: botones, inputs, toggle, checkbox, TagItem, tooltip, menú, modal, NavTabs (1.7–1.12). Al tenerlas como clases `mr-*` reutilizables, el resto de pantallas se arregla casi solo.
4. **Shell**: barra de título, barra izquierda, barra derecha (2–5).
5. **Pantallas**: Inicio/Biblioteca, Instancia, Contenido, Browse, Proyecto, Ajustes (6–11).
6. Interacciones y animaciones finas (1.13, 1.14).

---

## 14. Estado de la implementación

### Hecho

- **Unidades y tipografía**: el layout trabaja a 1rem = 16 px reales; `src/renderer/modrinth/mrsize.js` (`IC`, `AV`, `mpx`) da los tamaños en px para props como `<Icon size>`. Texto base 16 px, títulos a 600, sin `letter-spacing`. Las páginas y diálogos compartidos conservan su tamaño (`.page`, cuerpo de los modales, ajustes).
- **Iconos**: `src/renderer/components/icons-modrinth.js`, generado por `scripts/icons/build-modrinth-icons.mjs` desde los SVG del propio Modrinth (y Lucide para los que no tiene). `Icon` los usa cuando el layout es Modrinth (contexto `IconSet`, en `lib/store.jsx`); el layout CurseForge sigue con los suyos.
- **Tokens**: `lib/theme.js` deriva los que faltan (`--mr-surface-1-5/2/2-5`, `--mr-brand-gradient-*`, `--mr-brand-shadow`, `--mr-hover-brightness`, `--mr-platform-*`…) de la paleta, así que funcionan con cualquier tema.
- **Primitivas** (`mr.css`): botones sm/md/lg/xl y tipos base/colored/outlined/quiet con sus sombras y el borde degradado, botones de icono circulares, botón partido, Combobox, inputs standard/medium/large con anillo de foco, TagItem, FilterPills, NavTabs con indicador deslizante, Toggle 48×24, Checkbox 20 px, tooltip, menús (14 px de radio, anillo surface-5), modales (degradado + blur), acordeones con `grid-template-rows`.
- **Shell**: barra de título (flechas circulares, breadcrumbs de 16 px con avatar y desplazamiento al desbordar, estado "No hay instancias en ejecución" siempre visible, descargas solo cuando hay, controles de ventana redondos), barra izquierda (hover directo, `drop-shadow`, instancias recientes según el alto con avatar de 28 px y menú contextual, divisores de 32 px, "+" sin borde), panel con contorno y sombra interior, barra derecha en todas las páginas con el degradado, bordes y difuminados de Modrinth, primeros pasos arriba, "Jugando como" que se despliega en el sitio, ajustes como TabbedModal (cabecera, 250 px de pestañas de 44 px).
- **Pantallas**: "Volver a jugar" en filas de 80 px (hasta 5, con las nuevas), biblioteca con barra en dos filas, grupos con línea inferior y contador, tarjetas con Play `lg`; instancia con cabecera `PageHeader`, metadatos con puntos, botones xl y pestañas en el orden de Modrinth; contenido con barra de Modrinth, tabla de filas alternas de 74 px y barra flotante de selección; Descubrir con cabecera fija, búsqueda grande, tarjetas de resultado de Modrinth y filtros como filas.

### Pendiente o distinto a propósito

- Las imágenes de instancia siguen con `object-fit: cover` (Havi Hub acepta fotos no cuadradas; Modrinth las recorta en su editor).
- Descubrir mantiene el scroll infinito y el selector de fuente propios; Modrinth pagina y tiene "View:" y modos de vista.
- Los menús emergentes no tienen la flecha de 10 px de Modrinth.
- El divisor de instancias recientes no se arrastra (la cantidad es automática).
- Las páginas compartidas (Servidores, Skins, Capturas, Mundos, Registros, Proyecto, Ajustes, diálogos) ya siguen la fórmula (`mr-shared.css`, `mr-pages.css`); Servidores tiene los filtros en la barra derecha. Falta que la página de proyecto lleve su información (compatibilidad, enlaces, creadores, detalles) en la barra derecha, como Modrinth, y rediseñar la bienvenida.
- No hay barra de carga bajo la barra de título ni botón para ocultar la barra derecha.
