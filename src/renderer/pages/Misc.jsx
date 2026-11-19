// Welcome (first run when Prism isn't found) and Help pages.
import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Button, Input } from '../components/ui.jsx';
import { Logo } from '../components/Shell.jsx';
import { useApp } from '../lib/store.jsx';
import { call, platform } from '../lib/api.js';
import { t } from '../lib/i18n.js';

export function Help() {
  const app = useApp();
  const items = [
    [t('¿Qué es Havi Hub?'), t('Un launcher de Minecraft sin anuncios, con el diseño de CurseForge o de Modrinth (se cambia en Ajustes → Launcher → Diseño). Trae su propio motor de juego.')],
    [t('¿Cómo traigo mis perfiles de otro launcher?'), t('Mis modpacks → Importar → Desde otro launcher. Elige CurseForge, Modrinth o Prism Launcher: se copian con sus mundos, mods e imágenes.')],
    [t('¿Cómo agrego mi cuenta de Microsoft?'), t('Cuenta (arriba a la derecha) → Agregar cuenta. Inicias sesión en la página de Microsoft y la cuenta aparece sola.')],
    [t('¿Por qué no puedo instalar un mod en mi perfil?'), t('Cada perfil acepta solo lo que le sirve: su versión y su cargador. El botón dice "No compatible" y explica el motivo. Un perfil vanilla no acepta mods ni shaders.')],
    [t('Un mod de CurseForge no se descarga'), t('Su autor solo deja bajarlo desde CurseForge. Havi Hub abre esa página en una ventana y lo instala solo; también puedes usar tu navegador.')],
    [t('¿Por qué CurseForge pide una API key?'), t('CurseForge se la exige a otras apps. Es gratis: créala en console.curseforge.com y pégala en Ajustes → Addons. Sin key, todo funciona con Modrinth.')],
    [t('¿Cómo cambio el ícono de un perfil?'), t('Clic derecho en el perfil → Cambiar ícono. Elige un fondo y un bloque u objeto de Minecraft, o usa una imagen tuya.')],
    [t('¿De dónde salen las texturas y sonidos de Minecraft?'), t('Del Minecraft instalado en tu PC. Si todavía no hay ninguno, Havi Hub baja el archivo del juego una vez desde Mojang.')],
    [t('¿Qué pasa al cerrar con la X o al jugar?'), t('Havi Hub puede quedarse en la bandeja, junto al reloj. Tras un minuto ahí le deja su memoria al juego y vuelve con un clic. Se elige en Ajustes → Launcher.')],
    [t('¿Dónde veo mis capturas?'), t('En Capturas están las de todos tus perfiles. Abre una para copiarla, verla en su carpeta o eliminarla.')],
    [t('No puedo aplicar mi skin'), t('El permiso para cambiar la skin dura 24 horas. Si expiró, juega una vez o renueva la sesión y vuelve a intentarlo.')],
    [t('¿Cómo entro a un servidor conocido?'), t('Servidores → Descubrir: Hypixel, CubeCraft, UniversoCraft, LibreCraft y más están en la lista, con su estado medido desde tu PC. "Agregar" lo guarda en el perfil que elijas.')],
    [t('¿Qué son los temas festivos?'), t('En Halloween, Navidad y Año Nuevo Havi Hub se decora solo, con bloques y sonidos de Minecraft. Se apagan en Ajustes.')],
    [t('¿Cómo pongo variables de entorno?'), t('Para un perfil: Opciones del perfil → Al iniciar → Variables de entorno → Personalizado. Para todos: Ajustes → Minecraft → Variables de entorno.')],
    [t('¿Cómo quito los sustos de Halloween?'), t('En la semana de Halloween puede aparecer un susto con sonido fuerte. Se apaga en Ajustes → Temas → Sustos ocultos.')],
    [t('¿Dónde están las redes de Havikun?'), t('En Inicio (diseño de CurseForge) o en la columna derecha (diseño de Modrinth). Cada red se despliega para ver lo último.')],
    [t('¿Cómo se actualiza?'), t('El motor de juego se actualiza solo al abrir Havi Hub. Para una versión nueva de Havi Hub, instala su Setup encima: conserva todo.')],
  ];
  return (
    <div className="page help">
      <h1>{t('Ayuda')}</h1>
      <div className="faq">
        {items.map(([q, a]) => (
          <details key={q} className="faq-item">
            <summary>
              <Icon name="help" size={20} />
              {q}
            </summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
      <div className="row">
        <Button icon="settings" onClick={() => app.navigate({ page: 'settings', section: 'launcher' })}>
          {t('Ajustes')}
        </Button>
      </div>
    </div>
  );
}
