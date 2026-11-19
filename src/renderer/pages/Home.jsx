// Home: continue playing + groups + quick actions.
import Socials from "../modrinth/MrSocials.jsx";
import Icon from "../components/Icon.jsx";
import ImportLaunchersDialog from "../dialogs/ImportLaunchersDialog.jsx";
import { Button, Empty } from "../components/ui.jsx";
import InstanceImage, { LoaderIcon } from "../components/InstanceImage.jsx";
import { useApp } from "../lib/store.jsx";
import { call } from "../lib/api.js";
import { t } from "../lib/i18n.js";
import { formatPlaytime, timeAgo } from "../lib/format.js";
import { InstanceCard, useInstanceContextMenu } from "./Library.jsx";

export default function Home() {
  const app = useApp();
  const ctx = useInstanceContextMenu();
  const recent = [...app.instances]
    .filter((i) => i.lastLaunch)
    .sort((a, b) => b.lastLaunch - a.lastLaunch);
  const hero = recent[0];
  const totalPlay = app.instances.reduce((s, i) => s + (i.totalPlayed || 0), 0);
  return (
    <div className="page home">
      <div className="home-cols">
        <div className="home-main">
          <div className="home-head">
            <h1>
              {app.activeAccount
                ? t("¡Hola, {name}!", {
                    name:
                      app.config && app.config.privacy.streamerMode
                        ? ""
                        : app.activeAccount.name,
                  }).replace(", !", "!")
                : t("¡Hola!")}
            </h1>
            <div className="home-stats">
              <span>
                <Icon name="cube" size={18} />{" "}
                {t("{n} perfiles", { n: app.instances.length })}
              </span>
              <span>
                <Icon name="timer" size={18} />{" "}
                {t("{t} jugadas en total", { t: formatPlaytime(totalPlay) })}
              </span>
            </div>
          </div>
          {hero ? (
            <div className="home-hero">
              <InstanceImage
                instance={hero}
                res={1024}
                className="home-hero-img"
              />
              <div className="home-hero-body">
                <span className="muted">{t("Seguir jugando")}</span>
                <h2>{hero.name}</h2>
                <div className="row muted">
                  <Icon name="gamepad" size={18} /> {hero.mcVersion}
                  <LoaderIcon loader={hero.loader} size={18} />{" "}
                  {hero.loader ? hero.loader.name : "Vanilla"}
                  <Icon name="play" size={16} /> {timeAgo(hero.lastLaunch)}
                  <Icon name="timer" size={18} />{" "}
                  {formatPlaytime(hero.totalPlayed)}
                </div>
                <div className="row">
                  <Button
                    variant="primary"
                    size="lg"
                    icon="play"
                    onClick={() => app.launch(hero.id)}
                  >
                    {t("Jugar")}
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={() =>
                      app.navigate({
                        page: "instance",
                        id: hero.id,
                        tab: "content",
                        sub: "mods",
                      })
                    }
                  >
                    {t("Ver perfil")}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
          {recent.length > 1 ? (
            <>
              <h3 className="home-title">{t("Jugado recientemente")}</h3>
              <div className="inst-grid">
                {recent.slice(1, 7).map((i) => (
                  <InstanceCard key={i.id} inst={i} onContext={ctx.show} />
                ))}
              </div>
            </>
          ) : null}
          {!app.instances.length ? (
            <Empty
              icon="cube"
              title={t("Bienvenido a Havi Hub")}
              text={t(
                "Crea tu primer perfil o instala un modpack para empezar.",
              )}
            >
              <div className="row">
                <Button
                  variant="primary"
                  icon="plus"
                  onClick={() => (
                    app.navigate({ page: "library" }),
                    setTimeout(
                      () =>
                        window.dispatchEvent(
                          new CustomEvent("havihub:create-instance"),
                        ),
                      50,
                    )
                  )}
                >
                  {t("Crear perfil")}
                </Button>
                <Button
                  icon="compass"
                  onClick={() => app.navigate({ page: "discover" })}
                >
                  {t("Descubrir modpacks")}
                </Button>
              </div>
            </Empty>
          ) : null}
          <h3 className="home-title">{t("Accesos rápidos")}</h3>
          <div className="quick-grid">
            <button
              className="quick"
              onClick={() => app.navigate({ page: "discover" })}
            >
              <Icon name="compass" size={28} />
              <strong>{t("Descubrir modpacks")}</strong>
              <span className="muted">
                {t("CurseForge y Modrinth en un solo lugar")}
              </span>
            </button>
            <button
              className="quick"
              onClick={() => app.navigate({ page: "skins" })}
            >
              <Icon name="shirt" size={28} />
              <strong>{t("Cambiar skin")}</strong>
              <span className="muted">{t("Vista 3D con capas y élitros")}</span>
            </button>
            <button
              className="quick"
              onClick={() =>
                app.navigate({ page: "settings", section: "themes" })
              }
            >
              <Icon name="palette" size={28} />
              <strong>{t("Personalizar colores")}</strong>
              <span className="muted">
                {t("Cambia toda la paleta de la app")}
              </span>
            </button>
            <button
              className="quick"
              onClick={() => app.openDialog(ImportLaunchersDialog, {})}
            >
              <Icon name="import" size={28} />
              <strong>{t("Importar desde otro launcher")}</strong>
              <span className="muted">
                {t("CurseForge, Modrinth o Prism Launcher en un clic")}
              </span>
            </button>
          </div>
        </div>
        <Socials variant="curseforge" />
      </div>
      {ctx.menu}
    </div>
  );
}
