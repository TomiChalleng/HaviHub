# La fórmula del estilo Modrinth

Reglas para dibujar **cualquier** pantalla de Havi Hub como la dibujaría la app de Modrinth,
también las que Modrinth no tiene. Salen del código de Modrinth App
(`github.com/modrinth/code`: `packages/assets/styles`, `packages/ui`, `apps/app-frontend`) y de lo
que ya está implementado en `src/renderer/modrinth/mr.css`. La comparación pantalla por pantalla
está en [`modrinth-fidelidad.md`](./modrinth-fidelidad.md).

Cómo leerla: primero los **fundamentos** (unidades, superficies, texto, tamaños, radios, espacios,
iconos, movimiento), luego el **catálogo de componentes** con la clase `mr-*` que lo implementa, y
al final las **recetas de pantalla** y una **lista de comprobación** para aplicarla.

---

## 0. El proceso, en seis pasos

Para convertir una pantalla:

1. **Clasificarla**: ¿es una página, una lista, una rejilla, una tabla, un formulario en modal, una sección de ajustes o algo de la barra derecha? Cada caso tiene receta (sección 10).
2. **Elegir el componente de Modrinth más parecido** y copiar su estructura, no solo sus colores (sección 9).
3. **Asignar superficies por nivel** (sección 2): lo que está dentro de algo sube un nivel.
4. **Asignar a cada texto un rol** (sección 3): rol → tamaño, peso y color fijos.
5. **Medir con la escala** (secciones 4 a 6): alturas, radios y espacios solo de las tablas.
6. **Revisar con la lista** de la sección 11.

---

## 1. Unidades

El layout trabaja con `1rem = 16 px reales`, el rem de Modrinth (la ventana va a zoom 0.8 y el
layout pone `html { font-size: 20px }`).

| Para N px de Modrinth | Escribir |
|---|---|
| en CSS | `N / 16 rem` (nunca `px`: saldría un 20 % más chico) |
| en una prop numérica (`<Icon size>`, `Spinner`, `AccountAvatar`) | `mpx(N)` o las constantes de `mrsize.js`: `IC.s4` = 16, `IC.s5` = 20, `IC.s6` = 24; `AV.a24`… |
| un borde de 1 px | `1px` (se queda en 1 px físico; es lo que se busca) |

Equivalencias de Tailwind que aparecen en el código de Modrinth: `1` = 0.25rem, `1.5` = 0.375rem,
`2` = 0.5rem, `2.5` = 0.625rem, `3` = 0.75rem, `4` = 1rem, `6` = 1.5rem, `8` = 2rem, `12` = 3rem.

---

## 2. Superficies: la escala de elevación

Modrinth no usa sombras para separar capas: usa **cinco superficies** y bordes de la superficie
siguiente.

| Nivel | Token (`mr.css`) | Oscuro | Qué va ahí |
|---|---|---|---|
| 1 | `--mr-surface-1` | `#16181c` | fondo de la página (el panel redondeado) |
| 1.5 · 2 · 2.5 | `--mr-surface-1-5/2/2-5` | `#1a1c20` · `#1d1f23` · `#222429` | zonas "hundidas": filas alternas de tablas, listas dentro de un modal, checkbox vacío; 2.5 = seleccionado |
| 3 | `--mr-surface-3` | `#27292e` | **tarjetas**, modales, menús, tooltips, barra de título y barra izquierda |
| 4 | `--mr-surface-4` (= `--mr-button-bg`) | `#34363c` | **controles**: botones, inputs, chips; hover de lo transparente |
| 5 | `--mr-surface-5` | `#42444a` | **bordes de controles**, divisores fuertes, puntos separadores, pulgar del scroll |

Reglas:

- **R1. Un nivel por contención.** Página (1) → tarjeta (3) → control (4) → su borde (5).
- **R2. El borde es el nivel siguiente.** Tarjeta s3 con borde s4; botón s4 con anillo interior s5; input s4 con borde s5.
- **R3. Lo seleccionado no cambia de superficie: se tiñe.** Fondo `--mr-hl` (marca al 25 %) y texto `--mr-brand`. Excepción: filas de tabla (s2.5) y tarjetas de instancia (borde text-primary al 40 % + brillo 1.1).
- **R4. Divisores:** entre bloques de una página, 1 px `--mr-divider` (= s4); dentro de controles o listas compactas, s5.
- **R5. Sombras solo para lo que flota:** menús (`shadow-lg` + anillo s5), barras flotantes, botones de color (sombra en capas) y avatares (`--mr-shadow-card`). Nada más lleva sombra.
- **R6. En la barra derecha** las superficies cambian solas: dentro de `.mr-sidebar`, `--mr-button-bg`/`--mr-surface-4` = blanco 8 % y `--mr-surface-5`/divisores = `--mr-brand-gradient-border`. Cualquier componente puesto ahí hereda el aspecto correcto sin reglas nuevas.
- **R7. Todo sale de la paleta.** Nunca un hex fijo: los tokens `--mr-*` se derivan del tema en `lib/theme.js`, así funciona con cualquier tema y en claro.

Colores de estado: marca `--mr-brand` (verde), `--success`, `--warning` (naranja), `--danger`
(rojo), `--info` (azul). Para fondos de estado: color al 10 % (claro) / 20 % (oscuro); para
resaltes: al 25 %.

---

## 3. Texto: roles

Tres colores y nada más:

| Token | Oscuro | Para |
|---|---|---|
| `--mr-contrast` | `#ffffff` | títulos, nombres, valores, lo seleccionado, el texto de los botones |
| `--mr-primary` | `#b0bac5` | texto corrido, etiquetas de navegación, iconos de botones |
| `--mr-secondary` | `#96a2b0` | metadatos, placeholders, cabeceras de columna, pestañas inactivas, ayudas |

Cada texto tiene un **rol**, y el rol fija todo:

| Rol | Tamaño | Peso | Color | Interlineado | Ejemplos de Modrinth |
|---|---|---|---|---|---|
| Título de página | 1.5rem (24) | 600 | contrast | 1 | nombre de instancia, "Library", título de modal |
| Título de sección grande | 1.25rem (20) | 600 | contrast | 1.25 | "Additional content", título de tarjeta de proyecto |
| Título de sección de ajustes | 1.125rem (18) | 800 | contrast | — | `SettingsLabel` |
| Título de tarjeta/opción | 1.125rem (18) | 600 | contrast | 1.5rem | `SettingsOptionCard`, cabecera de aviso |
| Nombre en lista/tarjeta | 1rem (16) | 600 | contrast | 1.25–1.5rem | instancia, fila de contenido, cuenta |
| Cuerpo | 1rem (16) | 400 | primary | normal | resumen de proyecto, textos de modal |
| Etiqueta de interfaz | 1rem (16) | 500 | primary | 1.5rem | breadcrumbs, título "Playing as", menú |
| Botón / pestaña de ajustes | 1rem (16) | 600 (800 en xl) | contrast | 1.25rem | botones md–xl |
| Metadato | 0.875rem (14) | 500 | secondary | 1–1.25rem | "Fabric 1.20.1 • hace 2 h", cabeceras de tabla (600) |
| Pestaña (NavTabs) | 0.875rem (14) | 700 | secondary → brand | 1.25rem | pestañas de página |
| Tag / chip | 0.875rem (14) | 400 | secondary | 1 | categorías, contador de grupo |
| Pill de filtro | 0.875rem (14) | 500 | primary → brand | 1.25rem | `FilterPills` |
| Micro | 0.75rem (12) | 400–500 | secondary | — | subtítulo "Minecraft account" |
| Encabezado de menú | 0.75rem (12) | 700, mayúsculas, `tracking .025em` | secondary | — | grupos de menú |
| Categoría de navegación | 0.875rem (14) | 800, mayúsculas | secondary | 1.25rem | categorías del modal de ajustes |

Reglas:

- **R8. Inter 400–800, sin `letter-spacing`** salvo en los encabezados en mayúsculas.
- **R9. Nunca menos de 12 px.** Si algo "no cabe", se trunca con elipsis, no se achica.
- **R10. Un solo título por bloque**: el resto baja de rol.
- **R11. Lo clicable que es texto** (nombres, autores) se subraya al pasar el ratón; no cambia de color.

---

## 4. Alturas: la escala de controles

| Alto | Nombre | Radio | Padding X | Texto | Icono | Para |
|---|---|---|---|---|---|---|
| 1.75rem (28) | xs | 0.5rem | 0.375rem | 14/600 | 16 | flechas de la barra de título, acciones mínimas |
| 2rem (32) | sm | 0.625rem | 0.375rem | 14/600 | 16 | acciones de grupo, input small |
| 2.125rem (34) | — | 0.75rem | — | 14/500 | 20 | menú de orden y filtros de una tabla |
| **2.25rem (36)** | **md (por defecto)** | 0.75rem | 0.625rem (botón) · 0.75rem (input) | 16/600 | 20 | **barras de herramientas**, inputs, combos, botones de tarjeta |
| 2.5rem (40) | lg | 0.875rem | 1rem | 16/600 | 20 | acciones principales de una sección (contenido), input medium, pasos de checklist, Play en tarjeta |
| 2.75rem (44) | — | 0.875rem | 1rem | 16/600 | 20 | pestañas del modal de ajustes |
| **3rem (48)** | xl | 1rem | 0.875rem | 16/**800** | 24 | **acción principal de la página** (Play, Instalar), input large, botones de la barra izquierda |

Alturas de bloques:

| Bloque | Alto |
|---|---|
| barra de título | 3rem |
| cabecera de tabla | 3rem |
| fila de tabla | 4.625rem (74) |
| fila de lista grande ("Jump back in", mundos) | 5rem (80) |
| elemento de menú | mínimo 2.5rem |

**R12.** Una pantalla tiene **una sola acción xl** (o un grupo: Play + ajustes + más). Las barras de
herramientas son md; las acciones de una sección, lg.

---

## 5. Radios

El radio **crece con el tamaño** del elemento:

| Elemento | Radio |
|---|---|
| checkbox, avatar de breadcrumb | 0.375rem (6) |
| botón xs, tooltip | 0.5rem (8) |
| botón sm, elemento de menú | 0.625rem (10) |
| botón md, input, combo, pill de filtro, tarjeta de cuenta, paso de checklist, pill de estado | 0.75rem (12) |
| botón lg, input medium/large, panel de menú, pestaña de ajustes | 0.875rem (14) |
| botón xl, **tarjeta de lista** (proyecto, aviso, opción de ajustes), modal, imagen de tarjeta de instancia, checklist | 1rem (16) |
| **tarjeta de rejilla** (instancia), fila grande, tabla, modal de ajustes, barra flotante, esquina del panel | 1.25rem (20) |
| botón de icono, botón de navegación, pestañas, tags, toggle, indicador | 999px (círculo/píldora) |
| **avatar / icono cuadrado de N px** | `calc(N * 16 / 96)` (64 → 10.7, 48 → 8, 96 → 16) |

**R13.** Lo que sea solo-icono es **circular**. Lo que tenga texto es rectángulo redondeado según
su alto. Etiquetas y pestañas son píldoras.

---

## 6. Espacios

Escala: `0.25 · 0.5 · 0.75 · 1 · 1.5rem` (4 · 8 · 12 · 16 · 24 px). Casi todo es 8 o 12.

| Dónde | Valor |
|---|---|
| padding de página | 1.5rem |
| entre bloques de una página | 0.75rem (Inicio, Descubrir 0.5rem) · 1rem (pestaña de contenido) |
| cabecera de página → pestañas → contenido | 1rem (cabecera con `pb` 1rem y divisor) · 1rem |
| padding de tarjeta de rejilla / fila grande | 0.75rem |
| padding de tarjeta de lista, aviso, opción de ajustes, sección de barra derecha | 1rem |
| padding de modal (cabecera y cuerpo) | 1.5rem; acciones 1rem |
| gap en barras de herramientas, entre botones, entre tarjetas | 0.5rem (botones) · 0.75rem (tarjetas) |
| gap icono ↔ texto | 0.375rem (md) · 0.5rem (lg, xl, metadatos) · 0.25rem (xs, sm, tags) |
| gap entre metadatos | 1.625rem con un punto de 0.375rem centrado |
| gap etiqueta ↔ campo en formularios | 0.625rem |
| separador vertical en una barra | 1px × 1.5rem, surface-5 |

**R14.** Los bloques se separan con **espacio**, no con cajas. Una caja (tarjeta) solo cuando el
contenido es una entidad (una instancia, un proyecto, una cuenta, una opción).

---

## 7. Iconos

- **R15.** Lucide de trazo 2, en las copias de Modrinth (`icons-modrinth.js`). Si falta uno, añadirlo a `MAP` en `scripts/icons/build-modrinth-icons.mjs` (Modrinth primero, Lucide después) y regenerar. Nunca un icono relleno, salvo radio-button marcado y spinner.
- **R16.** Tamaño por defecto 20 px; 16 en controles xs/sm, tags y chips; 24 en la barra izquierda, botones xl y la cabecera de página.
- **R17.** Color: en botón base, `--mr-primary` (el texto va en contrast); en botón de color, el del texto; en metadatos, el del texto (secondary); los de tipo de proyecto, primary.
- **R18.** Icono de cada tipo de proyecto: modpack `packageOpen`, mod `box`, resource pack `paintbrush`, shader `glasses`, data pack `braces`, plugin `plug`. Loaders: el logo propio del loader.
- **R19.** Cabecera de modal, título de página y tarjetas **no llevan icono decorativo** delante del título (sí avatar si es una entidad).

---

## 8. Interacción y movimiento

| Estado | Regla |
|---|---|
| hover de botones y tarjetas clicables | `filter: brightness(var(--mr-hover-brightness))` (1.25 oscuro / 0.9 claro); tarjetas de instancia y filas grandes 1.1 |
| hover de lo transparente (quiet, filas de menú, filtros) | fondo `--mr-surface-4` (o `--mr-button-bg` en la barra derecha) |
| pulsado | `scale(0.97)` botones · 0.95 tarjetas de instancia, pestañas, botón de navegación · 0.98 tarjetas de lista · 0.99 filas grandes |
| foco | anillo `0 0 0 0.25rem var(--mr-brand-shadow)`; tarjetas: `outline 0.25rem var(--mr-focus-ring)` |
| deshabilitado | `opacity: 0.5; cursor: not-allowed` (no gris, no tachado) |
| acción oculta hasta el hover | `opacity 0 → 1` y `scale 0.75 → 1` desde abajo (Play de tarjeta) o solo opacidad (acciones de grupo) |
| transición estándar | 150 ms `ease-out` sobre color, fondo, sombra, filtro, opacidad y transform |
| plegar/desplegar | `grid-template-rows 0fr → 1fr`, 0.3 s `--mr-ease-out-expo`; el chevron (`dropdown`) rota 180° |
| aparecer (menús) | 125 ms `ease-out-expo`, desde `scale(0.9, 0.3)` |
| aparecer (modales) | 200 ms, `opacity` y `scale 0.97 → 1`; fondo degradado + `blur(5px)` |
| selección deslizante (pestañas) | el resaltado se mueve 80 ms `cubic-bezier(.4,0,.2,1)` |

**R20.** Todo respeta `data-reduce-motion` (ya lo hace `base.css`).

---

## 9. Catálogo de componentes

| Componente de Modrinth | Clase en Havi Hub | Notas |
|---|---|---|
| `Button` base | `.mr-btn` | tamaños `.sm .lg .xl`; tipos `.brand .green .danger .outlined .quiet` |
| `IconButton` | `.mr-icon-btn` | circular; mismos tamaños y tipos; `.green-hover`, `.danger-hover`, `.brand-text` |
| `SplitButton` | `.mr-split` + `.mr-split-more` | 1 px entre partes |
| `Combobox` (trigger base) | `.mr-combo` (+ `.mr-combo-prefix/-value/-chevron`, `.w16`) | menú con `.mr-combo-pop` |
| `Input` | `.mr-search` (`.medium`, `.lg`, `.grow`) + `.mr-input-clear` | icono a 60 % hasta el foco |
| `TagItem` | `.mr-chip` (`.green`, `.loader-*`) | píldora con borde |
| `FilterPills` | `.mr-pill` (`.on`) | radio 12, borde, fondo transparente |
| `NavTabs` | `MrTabs` (`.mr-tabs`, `.mr-tab`, `.mr-tab-slider`) | también `.tabs` compartidas |
| `Toggle` | `Toggle` de `ui.jsx` (estilo en `mr.css`), `.mr-toggle-sm` | 48×24 / 40×20 |
| `Checkbox` | `Checkbox` de `ui.jsx` (estilo en `mr.css`) | 20 px, radio 6 |
| `Accordion` | `.open` + `.mr-collapse > div` + `.mr-chevron` | |
| `Avatar` | contenedor con radio `N*16/96`, `outline` blanco 15 %, `--mr-shadow-card` | ejemplos: `.mr-inst-head-art`, `.mr-jump-art`, `.mr-quick-art` |
| `PageHeader` | `.mr-inst-head` (+ `-art`, `-text`, `.mr-inst-meta`, `.mr-meta-item`, `.mr-inst-actions`) | generalizar como `.mr-page-head` al aplicarla |
| `ProjectCard` (lista) | `.mr-result` | rejilla de áreas + container queries |
| `InstanceCardView` | `.mr-inst` | |
| `InstanceItem` / `WorldItem` | `.mr-jump-item` | fila de 80 px |
| `ContentCardTable` | `.mr-table`, `.mr-tr`, `.mr-th` | |
| `FloatingActionBar` | `.mr-bulk`, `.dropbar` | |
| `ButtonMenu` / `ContextMenu` | `Popover` + `.menu` (estilo en `mr.css`) | |
| `Tooltip` | `.tip` (estilo en `mr.css`) | |
| `NewModal` | `Modal` (estilo en `mr.css`) | |
| `TabbedModal` | `.mr-settings-window` | |
| `Admonition` | `.mr-notice` (`.warn`, `.err`) | falta `info`, `success` y la cabecera de 18 px (ver abajo) |
| `EmptyState` | `.mr-empty` | Modrinth: ilustración ≤200 px, título 24/600 contrast, texto secondary, acciones a 2rem |

Componentes que faltaban y ya están en el kit de `mr.css` (sección "the formula's kit"):
`.mr-page-head`, `.mr-admonition` (`.warning .critical .success .neutral`), `.mr-option-card`,
`.mr-settings-label`, `.mr-form-group`, `.mr-label`, `.mr-desc`, `.mr-modal-zone`, `.mr-radio-row`,
`.mr-radio-card`. Sus valores:

| Componente | Valores |
|---|---|
| `Admonition` completo | rejilla `1.5rem · 1fr · auto`, gap-x 0.5rem, radio 1rem, borde 1 px y fondo del color al 20 % (info azul, warning naranja, critical rojo, success verde, neutral s4/s3), `p` 1rem; icono 24 px del color; cabecera 18/600 `leading 1.5rem`; cuerpo 16/400 contrast al 85 % |
| `SettingsOptionCard` | rejilla `1fr · auto`, gap 1.5rem, `p` 1rem, radio 1rem, borde s4, fondo s3; título 18/600 contrast con icono 20 primary; descripción 16 secondary |
| `SettingsFormGroup` | columna gap 0.5rem; etiqueta 16/600 contrast; descripción secondary 400 |
| etiqueta de formulario en modal | 16/600 contrast, gap 0.625rem con el campo |
| zona de lista en modal | fondo s2, `py` 1rem, separada por 1 px divider, alto fijo con scroll |
| `RadioButtons` | filas `py 0.5 px 0.5`, radio 12, 500, icono radio 20 (brand si está marcado), hover s4 |
| `LargeRadioButton` | `px 1 py 0.75`, radio 12, borde 2 px button-bg; marcado con icono brand |
| `ProgressBar` | barra de 0.5rem, píldora, pista s5, relleno brand; etiqueta 14 secondary |
| `Slider` | pista 6 px s5 redondeada, relleno brand, pulgar 10×32 brand redondeado, marcas 6×18 |
| `StatItem` | icono + valor, gap 0.25rem |
| `SettingsLabel` | título 18/800 contrast, descripción 14 secondary, `mb` 0.5rem |

---

## 10. Recetas de pantalla

### A. Página
`p 1.5rem`, columna con gap 0.75rem.
Cabecera (`PageHeader`): avatar de la entidad (64 px) · título 24/600 · metadatos con puntos ·
acciones a la derecha (una xl de color + IconButtons xl base/quiet); **divisor debajo** con
`pb 1rem`. Después NavTabs si hay subpáginas; después el contenido.
Si es una página "de lista" sin entidad (Biblioteca, Descubrir): título 24/600 suelto o
directamente las pestañas, y una barra de herramientas.

### B. Barra de herramientas
Fila con gap 0.5rem: **búsqueda que ocupa el resto** (md, o large si es la acción principal de la
página como en Descubrir) · botones md (base para secundarias, uno de color para la principal, a
la derecha). Segunda fila (gap-x 1rem): combos de orden/agrupación, separador vertical, filtros
(pills o combos). Contadores y textos de estado en 14 px secondary.

### C. Lista de entidades
- **Detallada** (proyectos, servidores): tarjeta de lista `ProjectCard`: s3, borde s4, radio 16, `p` 1rem, icono 100 px (64 bajo 850 px de ancho), título 20/600, autor/subtítulo secondary, resumen 16/400 primary en 2 líneas, acciones arriba a la derecha, estadísticas (icono 20 + valor 500) abajo a la derecha, tags abajo. Gap entre tarjetas 0.75rem.
- **Compacta** (recientes, mundos, cuentas): fila de 80 px, s3, borde s4, radio 20, `p` 0.75rem, avatar 48 px radio 14, nombre 16/600, metadatos 14 secondary con puntos, una acción de color md + menú "⋮" quiet.

### D. Rejilla de entidades
`repeat(auto-fill, minmax(10rem, 1fr))` (8rem si la ventana mide < 1280 px), gap 0.75rem. Tarjeta:
s3, borde s4, radio 20, `p` 0.75rem, gap 0.75rem, imagen cuadrada radio 16, nombre 16/600,
subtítulo 14/500 primary; acción principal como IconButton lg de color sobre la imagen, abajo a la
derecha, visible al pasar el ratón.

### E. Tabla
Contenedor radio 20, borde s4, sombra mínima. Cabecera pegajosa de 48 px en s3 con títulos 600
secondary. Filas de 74 px alternando s2 / s1.5, seleccionada s2.5, separador s4. Columna principal:
checkbox · icono 48 radio 16 con borde s5 · nombre 600 contrast (+ icono de tipo 20) · subtítulo
14 secondary. Acciones a la derecha, gap 0.5rem, IconButtons quiet + Toggle. La selección múltiple
aparece en una barra flotante abajo.

### F. Barra derecha
Secciones con `p` 1rem y divisor `--mr-brand-gradient-border`; título 16/500 primary. El contenido
son tarjetas en `--mr-button-bg` con borde `--mr-surface-5` y radio 12 (cuenta) o 16 (checklist);
filtros como acordeones de ancho completo. Al final, si hay un "ver más", un botón **xl de color**
centrado (como "View all news").

### G. Modal de formulario
Ancho 560 px para formularios, 928 para los de pestañas. Cabecera `p` 1.5rem con título 24/600 y
cerrar (IconButton base) y **divisor**. Cuerpo `p` 1.5rem: etiqueta 16/600 contrast → campo md,
gap 0.625rem; bloques separados 1rem. Listas largas en una zona s2 con su propio scroll. Acciones
abajo a la derecha, gap 0.5rem: "Cancelar" **outlined** con icono `x`, la principal **de color**
con su icono; si es destructiva, roja y con fondo de modal `danger`.

### H. Ajustes
Cada opción es un `SettingsOptionCard` (título 18/600 + descripción a la izquierda, control a la
derecha) o un `SettingsFormGroup` (etiqueta 16/600 + descripción + control debajo). Grupos con
`SettingsLabel` (18/800). Los cambios sin guardar aparecen en una barra flotante abajo.

### I. Estado vacío, carga y error
- Vacío: centrado, `p` 1.5rem, ilustración o icono grande, título 24/600 contrast, texto secondary, acciones a 2rem.
- Carga: spinner centrado; nunca esqueletos de otro estilo.
- Error o aviso: `Admonition` del tipo que toque, nunca texto rojo suelto.

---

## 11. Lista de comprobación

Antes de dar por buena una pantalla:

- [ ] Ningún tamaño en `px` en CSS (salvo bordes de 1 px); props numéricas con `mpx`/`IC`/`AV`.
- [ ] Cada fondo es un nivel de superficie, uno por encima de su contenedor; cada borde, el nivel siguiente.
- [ ] Cada texto tiene un rol de la tabla 3; nada por debajo de 12 px; títulos a 600.
- [ ] Alturas de controles de la tabla 4; una sola acción xl.
- [ ] Radios de la tabla 5; lo solo-icono es circular; los avatares a `N*16/96`.
- [ ] Espacios de la escala 6; cajas solo para entidades.
- [ ] Iconos de Modrinth/Lucide, 16/20/24, sin iconos decorativos en títulos.
- [ ] Hover por brillo, pulsado por escala, foco con anillo, deshabilitado al 50 %.
- [ ] Funciona en los temas Modrinth oscuro, OLED y claro, y con un tema no-Modrinth.
- [ ] Captura comparada con la pantalla de Modrinth más parecida.

---

## 12. Dónde está aplicada

Tres hojas, en este orden (`src/renderer/main.jsx`):

| Archivo | Qué contiene |
|---|---|
| `modrinth/mr.css` | el marco del layout, sus pantallas propias (Inicio, Instancia, Contenido, Descubrir) y el kit |
| `modrinth/mr-shared.css` | los componentes compartidos (`.btn`, `.input`, `.select`, `.tabs`, `.pills`, menús, modales, toasts, descargas, campos de ajustes…) con estilo Modrinth |
| `modrinth/mr-pages.css` | las páginas compartidas, cada una con su receta: listas, filas, registros, capturas, skins, proyecto, ajustes, diálogos |

Los filtros de la barra derecha están en `modrinth/MrFilters.jsx` (los usan Descubrir y
Servidores). Servidores tiene una variante Modrinth (`MrServerBrowse` en `pages/Servers.jsx`) con
la búsqueda y el orden arriba y los filtros en la barra derecha.

Recetas por pantalla:

| Interfaz de Havi Hub | Receta | Componente base |
|---|---|---|
| Canales de Havikun y apoyo | F | tarjetas de la barra derecha + botón xl final |
| Modpacks populares | C (detallada, en rejilla) | `ProjectCard` grid |
| Servidores | A + B + C (compacta) | `WorldItem` y tarjetas de servidor |
| Skins | A + D | página de Skins de Modrinth |
| Capturas (página y pestaña) | A + D | `screenshots-page` |
| Proyecto | A + barra derecha (F) con compatibilidad, enlaces, etiquetas, creadores, detalles | `pages/project/Index.vue` |
| Mundos y Registros de una instancia | C (compacta) / consola | `worlds/index.vue`, `logs/index.vue` |
| Diálogos (crear instancia, importar, opciones del perfil, cambiar versión, actualizar…) | G | `NewModal` + `CreationFlowModal` |
| Ajustes (contenido) | H | `features/settings/*` |
| Bienvenida / elección de layout | I + G | `WelcomeScreen.vue` |
| Barra de arrastre | barra flotante | `FloatingActionBar` |
| Notificaciones (toasts) | aviso flotante | `PopupNotificationPanel` |
