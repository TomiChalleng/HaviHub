// Havikun's channels in the side column of the Modrinth layout. Each row
// opens to a compact view of what's there: the links of the Linktree, the
// latest YouTube videos, Twitch live or its past broadcasts, and for
// Instagram, X and TikTok the network's own embeddable page. Only one is open
// at a time, and its content exists only while it's open.
import { useEffect, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";
import { Spinner } from "../components/ui.jsx";
import { call, on } from "../lib/api.js";
import { t } from "../lib/i18n.js";
import { timeAgo, formatCount } from "../lib/format.js";
import { SOCIALS, SUPPORT } from "../../shared/socials.js";
import { parseProjectLink } from "../../shared/projectLink.js";
import { useApp } from "../lib/store.jsx";
import xSvg from "../brands/social-x.svg";
import instagramSvg from "../brands/social-instagram.svg";
import youtubeSvg from "../brands/social-youtube.svg";
import twitchSvg from "../brands/social-twitch.svg";
import tiktokSvg from "../brands/social-tiktok.svg";

const SVG = {
  x: xSvg,
  instagram: instagramSvg,
  youtube: youtubeSvg,
  twitch: twitchSvg,
  tiktok: tiktokSvg,
};
const open = (url) => call("app.openExternal", url);

function SocialIcon({ id }) {
  if (!SVG[id]) return <Icon name="link" size={18} />;
  return (
    <span
      className="mr-social-svg"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: SVG[id] }}
    />
  );
}

// feed of a channel, loaded when asked (the app keeps it 15 minutes). Asked for
// without the person opening the channel, it is `auto`: with the automatic
// loading turned off, the app then answers only with what it already has.
function useFeed(id, enabled, opened) {
  const [state, setState] = useState({
    data: null,
    error: false,
    loading: false,
  });
  const openedNow = useRef(opened);
  openedNow.current = opened;
  const load = (force) => {
    setState((s) => ({ ...s, loading: true, error: false }));
    call("social.feed", id, { force, auto: !openedNow.current })
      .then((data) => setState({ data, error: !data, loading: false }))
      .catch(() =>
        setState((s) => ({ data: s.data, error: true, loading: false })),
      );
  };
  useEffect(() => {
    if (enabled && !state.data && !state.loading) load(false);
  }, [enabled]);
  // fresher data fetched behind (see main/social.js)
  useEffect(
    () =>
      on("social:feed", (m) => {
        if (m && m.id === id && m.data)
          setState({ data: m.data, error: false, loading: false });
      }),
    [id],
  );
  return { ...state, reload: () => load(true) };
}

function FeedState({ feed, children }) {
  if (feed.data) return children;
  if (feed.error) {
    return (
      <div className="mr-social-note">
        <span>{t("No se pudo cargar ahora.")}</span>
        <button className="mr-link" onClick={feed.reload}>
          {t("Reintentar")}
        </button>
      </div>
    );
  }
  return (
    <div className="mr-social-note">
      <Spinner size={16} />
    </div>
  );
}

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

// A link of the Linktree: one to a project on Modrinth or CurseForge opens that
// project here, inside Havi Hub; any other goes to the browser.
function LinktreeBody({ s, feed }) {
  const app = useApp();
  const [busy, setBusy] = useState(null);
  const go = async (url) => {
    if (!parseProjectLink(url)) return open(url);
    setBusy(url);
    try {
      const hit = await call("platforms.resolveLink", url);
      if (hit) app.navigate({ page: "project", source: hit.source, id: hit.id });
      else open(url);
    } catch {
      open(url);
    } finally {
      setBusy(null);
    }
  };
  return (
    <FeedState feed={feed}>
      <div className="mr-social-links">
        {((feed.data && feed.data.links) || []).map((l) => {
          const inside = Boolean(parseProjectLink(l.url));
          return (
            <button
              key={l.url}
              className="mr-social-link"
              onClick={() => go(l.url)}
              data-tip={inside ? t("Abrir aquí, en Havi Hub") : hostOf(l.url)}
            >
              <span>{l.title}</span>
              {busy === l.url ? <Spinner size={14} /> : <Icon name={inside ? "chevronRight" : "external"} size={15} />}
            </button>
          );
        })}
      </div>
    </FeedState>
  );
}

function Clip({ thumbnail, title, meta, onClick, badge, tall }) {
  const [ok, setOk] = useState(true);
  return (
    <button className="mr-social-clip" onClick={onClick}>
      <span className={`mr-social-thumb ${tall ? "tall" : ""}`}>
        {thumbnail && ok ? (
          <img
            src={thumbnail}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => setOk(false)}
          />
        ) : (
          <Icon name="play" size={18} />
        )}
        {badge ? <em>{badge}</em> : null}
      </span>
      <span className="mr-social-clip-text">
        <strong>{title}</strong>
        <small>{meta}</small>
      </span>
    </button>
  );
}

function YoutubeBody({ feed }) {
  const videos = (feed.data && feed.data.videos) || [];
  return (
    <FeedState feed={feed}>
      {videos.length ? (
        <div className="mr-social-clips">
          {videos.slice(0, 5).map((v) => (
            <Clip
              key={v.id}
              thumbnail={v.thumbnail}
              title={v.title}
              badge={v.short ? "Short" : ""}
              meta={[
                v.published ? timeAgo(Date.parse(v.published)) : v.ago || "",
                v.views ? t("{n} vistas", { n: formatCount(v.views) }) : "",
              ]
                .filter(Boolean)
                .join(" · ")}
              onClick={() => open(v.url)}
            />
          ))}
        </div>
      ) : (
        <div className="mr-social-note">{t("Todavía no hay videos.")}</div>
      )}
    </FeedState>
  );
}

const duration = (secs) => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
};

function TwitchBody({ s, feed }) {
  const d = feed.data || {};
  return (
    <FeedState feed={feed}>
      {d.live ? (
        <button className="mr-social-live" onClick={() => open(s.url)}>
          <span className="mr-social-live-art">
            <img
              src={d.live.thumbnail}
              alt=""
              draggable={false}
              onError={(e) => (e.currentTarget.style.visibility = "hidden")}
            />
            <em>{t("EN VIVO")}</em>
          </span>
          <strong>{d.live.title || t("Transmitiendo ahora")}</strong>
          <small>
            {[
              d.live.game,
              d.live.viewers
                ? t("{n} espectadores", { n: formatCount(d.live.viewers) })
                : "",
            ]
              .filter(Boolean)
              .join(" · ") || t("Clic para verlo en Twitch")}
          </small>
        </button>
      ) : (
        <div className="mr-social-note">{t("Ahora no está en vivo.")}</div>
      )}
      {d.videos && d.videos.length ? (
        <>
          <h4 className="mr-social-sub">{t("Transmisiones anteriores")}</h4>
          <div className="mr-social-clips">
            {d.videos.slice(0, 4).map((v) => (
              <Clip
                key={v.id}
                thumbnail={v.thumbnail}
                title={v.title}
                badge={v.seconds ? duration(v.seconds) : ""}
                meta={[
                  v.published ? timeAgo(Date.parse(v.published)) : "",
                  v.game,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                onClick={() => open(v.url)}
              />
            ))}
          </div>
        </>
      ) : null}
    </FeedState>
  );
}

// The network's own embeddable page, as a guest page: it can't reach the app,
// can't leave its site, and its links open in the browser (see main.js).
// What a network's page says when it turns visitors away (X does this to
// anyone not signed in, by address, and says only "Rate limit exceeded").
const TURNED_AWAY = /rate limit exceeded|too many requests/i;

// which of a network's pages worked last (its embeddable one or its normal one), for 12 hours
function rememberedStage(s) {
  try {
    const m = JSON.parse(localStorage.getItem(`havihub.social.${s.id}`) || "null");
    return m &&
      s.fallback &&
      m.stage === 1 &&
      Date.now() - m.at < 12 * 3600 * 1000
      ? 1
      : 0;
  } catch {
    return 0;
  }
}
function rememberStage(s, stage) {
  try {
    localStorage.setItem(
      `havihub.social.${s.id}`,
      JSON.stringify({ stage, at: Date.now() }),
    );
  } catch {
    // not essential
  }
}

function EmbedBody({ s }) {
  const box = useRef(null);
  const [state, setState] = useState("loading");
  const [attempt, setAttempt] = useState(0);
  // 0: the embeddable page; 1: the network's normal page (when the first one turns us away)
  const [stage, setStage] = useState(() => rememberedStage(s));
  const tries = useRef(0);
  const retry = () => {
    setState("loading");
    setAttempt((n) => n + 1);
  };
  const startOver = () => {
    rememberStage(s, 0);
    setStage(0);
    retry();
  };
  useEffect(() => {
    const wv = box.current && box.current.querySelector("webview");
    if (!wv) return undefined;
    let alive = true;
    let timer = 0;
    const fit = () => {
      try {
        // the page gets about 340 px of its own to lay itself out, whatever the size of the app
        const appZoom =
          window.outerWidth && window.innerWidth
            ? window.outerWidth / window.innerWidth
            : 1;
        wv.setZoomFactor(
          Math.max(0.5, Math.min(1, (box.current.clientWidth * appZoom) / 380)),
        );
      } catch {
        /* not attached yet */
      }
    };
    const refits = [];
    const ready = async () => {
      fit();
      // Chromium keeps zoom per site and the window's own zoom can reach the
      // page after it loads: fit again once it has settled
      for (const ms of [250, 1000, 2500]) refits.push(setTimeout(() => alive && fit(), ms));
      let text = "";
      try {
        text = await wv.executeJavaScript(
          "(document.body && document.body.innerText || '').slice(0, 300)",
        );
      } catch {
        /* the page went away */
      }
      if (!alive) return;
      if (TURNED_AWAY.test(text) && text.trim().length < 120) {
        // no waiting: the network's normal page takes over at once (and is
        // remembered for a while, so next time it opens there directly)
        if (stage === 0 && s.fallback) {
          rememberStage(s, 1);
          setStage(1);
          retry();
        } else setState("limited");
        return;
      }
      tries.current = 0;
      setState("ready");
    };
    const failed = (e) => {
      if (e.isMainFrame !== false && e.errorCode !== -3) setState("failed");
    };
    wv.addEventListener("dom-ready", ready);
    wv.addEventListener("did-fail-load", failed);
    // the box can still change width after the page loads (the sidebar
    // settling): the page keeps its ~340 px
    const ro = new ResizeObserver(() => fit());
    ro.observe(box.current);
    // a new zoom of the window (main.js applies it after resizes) reaches the
    // embedded page too and would undo the fit
    window.addEventListener("resize", fit);
    return () => {
      alive = false;
      ro.disconnect();
      refits.forEach(clearTimeout);
      window.removeEventListener("resize", fit);
      clearTimeout(timer);
      wv.removeEventListener("dom-ready", ready);
      wv.removeEventListener("did-fail-load", failed);
    };
  }, [attempt, stage]);
  // signing in happens in a window of its own; when it closes, look again
  useEffect(
    () => on("social:signed", (id) => id === s.id && startOver()),
    [s.id],
  );
  const ua = navigator.userAgent.replace(
    /\s(?:Electron|havi-hub|HaviHub)\/\S+/gi,
    "",
  );
  if (state === "limited") {
    return (
      <div className="mr-social-limited">
        <p>
          {t(
            "{name} no está mostrando las publicaciones aquí ahora: limita a quienes no han iniciado sesión.",
            { name: s.name },
          )}
        </p>
        <div className="mr-social-actions">
          <button className="mr-social-btn" onClick={startOver}>
            <Icon name="refresh" size={15} /> {t("Reintentar")}
          </button>
          {s.signIn ? (
            <button
              className="mr-social-btn primary"
              onClick={() => call("social.signIn", s.id).catch(() => {})}
            >
              {t("Iniciar sesión en {name}", { name: s.name })}
            </button>
          ) : null}
        </div>
        <small>
          {t(
            "Con tu sesión iniciada (solo en esta ventana de Havi Hub), las publicaciones se ven siempre.",
          )}
        </small>
      </div>
    );
  }
  return (
    <div className={`mr-social-embed ${state}`} ref={box}>
      {state === "failed" ? (
        <div className="mr-social-note">
          {t("No se pudo cargar. Ábrelo en el navegador.")}
        </div>
      ) : (
        <>
          {state === "loading" ? (
            <div className="mr-social-note over">
              <Spinner size={16} />
            </div>
          ) : null}
          <webview
            key={`${stage}-${attempt}`}
            src={stage === 1 ? s.fallback : s.embed}
            partition="persist:social"
            allowpopups="true"
            useragent={ua}
          />
        </>
      )}
      {stage === 1 && state === "ready" && s.signIn ? (
        <button
          className="mr-social-signin"
          onClick={() => call("social.signIn", s.id).catch(() => {})}
          data-tip={t(
            "Con tu sesión iniciada (solo en esta ventana de Havi Hub), las publicaciones se ven siempre.",
          )}
        >
          {t("Iniciar sesión en {name}", { name: s.name })}
        </button>
      ) : null}
    </div>
  );
}

function SocialRow({ s, isOpen, onToggle, live, auto }) {
  // feeds are asked for as soon as the panel shows (what is kept answers at
  // once); a network shown through its own page starts loading when the
  // pointer reaches its row, so it is there by the time it is opened. With the
  // automatic loading off (Ajustes → Privacidad), nothing loads until opened.
  const feed = useFeed(s.id, !s.embed && (auto || isOpen), isOpen);
  const [warm, setWarm] = useState(false);
  useEffect(() => {
    if (!warm || isOpen) return undefined;
    const timer = setTimeout(() => setWarm(false), 45000);
    return () => clearTimeout(timer);
  }, [warm, isOpen]);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !isOpen) setWarm(false); // closed: its page is let go
    wasOpen.current = isOpen;
  }, [isOpen]);
  return (
    <div
      className={`mr-social ${isOpen ? "open" : ""} ${s.light ? "light" : ""}`}
      style={{ "--social": s.color }}
      onPointerEnter={() => auto && s.embed && !isOpen && setWarm(true)}
    >
      <div className="mr-social-head">
        <button
          className="mr-social-toggle"
          onClick={onToggle}
          aria-expanded={isOpen}
        >
          <span className="mr-social-icon">
            <SocialIcon id={s.id} />
          </span>
          <span className="mr-social-name">
            <strong>
              {s.name}
              {live ? (
                <em className="mr-social-livedot">{t("EN VIVO")}</em>
              ) : null}
            </strong>
            <small>{s.handle}</small>
          </span>
          <Icon name="chevronDown" size={18} className="mr-social-chevron" />
        </button>
        <button
          className="mr-social-open"
          onClick={() => open(s.url)}
          aria-label={t("Abrir {name}", { name: s.name })}
          data-tip={t("Abrir {name}", { name: s.name })}
          data-tip-pos="left"
        >
          <Icon name="external" size={17} />
        </button>
      </div>
      {isOpen || (warm && s.embed) ? (
        <div className={`mr-social-body ${isOpen ? "" : "warming"}`}>
          {s.id === "linktree" ? (
            <LinktreeBody s={s} feed={feed} />
          ) : s.id === "youtube" ? (
            <YoutubeBody feed={feed} />
          ) : s.id === "twitch" ? (
            <TwitchBody s={s} feed={feed} />
          ) : (
            <EmbedBody s={s} />
          )}
        </div>
      ) : null}
    </div>
  );
}

// variant: 'modrinth' (side column) or 'curseforge' (beside the home page)
export default function Socials({ variant = "modrinth" }) {
  const app = useApp();
  // on their own only once the person said so (the welcome, or Ajustes → Privacidad)
  const privacy = (app.config && app.config.privacy) || {};
  const auto = privacy.socialAsked === true && privacy.socialAutoload !== false;
  const [openId, setOpenId] = useState(null);
  const [live, setLive] = useState(false);
  // the "EN VIVO" mark on Twitch shows without opening anything (only while
  // the channels load on their own)
  useEffect(() => {
    if (!auto) {
      setLive(false);
      return undefined;
    }
    let alive = true;
    const check = () =>
      call("social.feed", "twitch", { auto: true })
        .then((d) => alive && setLive(Boolean(d && d.live)))
        .catch(() => {});
    const first = setTimeout(check, 4000);
    const timer = setInterval(
      () => document.visibilityState === "visible" && check(),
      15 * 60 * 1000,
    );
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [auto]);
  return (
    <section
      className={
        variant === "curseforge" ? "cf-socials" : "mr-side-section mr-socials"
      }
    >
      {variant === "curseforge" ? (
        <h2>{t("Redes de Havikun")}</h2>
      ) : (
        <h3>{t("Redes de Havikun")}</h3>
      )}
      {auto ? null : <p className="mr-social-hint">{t("Se cargan cuando abres una.")}</p>}
      {SOCIALS.map((s) => (
        <SocialRow
          key={s.id}
          s={s}
          auto={auto}
          isOpen={openId === s.id}
          live={s.id === "twitch" && live}
          onToggle={() => setOpenId(openId === s.id ? null : s.id)}
        />
      ))}
      <SupportCard />
    </section>
  );
}

// Under the channels: a way to support the work. It says plainly what Havi Hub
// is (free, no ads) and what a tip does; one clear button, nothing that nags.
function SupportCard() {
  return (
    <div className="mr-support">
      <div className="mr-support-head">
        <span className="mr-support-heart">
          <Icon name="heart" size={20} />
        </span>
        <div>
          <strong>{t("¿Te gusta Havi Hub?")}</strong>
          <span>{t("Es gratis y no tiene anuncios.")}</span>
        </div>
      </div>
      <p>{t("Lo hago en mi tiempo libre. Si te sirve, invítame un café: cada aporte, por pequeño que sea, me ayuda a seguir mejorándolo.")}</p>
      <button className="mr-support-btn" onClick={() => open(SUPPORT.url)}>
        <Icon name="heart" size={17} />
        {t("Apoyar en Ko-fi")}
        <Icon name="external" size={15} />
      </button>
      <small>{t("Se abre {site} en tu navegador. ¡Gracias!", { site: SUPPORT.handle })}</small>
    </div>
  );
}
