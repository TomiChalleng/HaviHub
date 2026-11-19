// Seasonal touches for the Modrinth layout: the same seasons as the
// CurseForge layout, placed where this layout has room for them.
//   title bar: the Christmas garland along its bottom edge, the pumpkins /
//              gifts / New Year countdown at its right end
//   left bar:  the season's pixel art on top; clicking it opens the seasons
//              in Settings (where each one can be turned off)
import { Garland, TopTabsDecor, Pixels, SEASON_ART, SeasonIcon } from '../components/Seasonal.jsx';
import { useApp } from '../lib/store.jsx';
import { t } from '../lib/i18n.js';

const LABEL = () => ({ halloween: t('Tema de Halloween'), christmas: t('Tema de Navidad'), newyear: t('Tema de Año Nuevo') });

export function MrTitleDecor() {
  const { season } = useApp();
  if (!season) return null;
  return (
    <>
      <Garland />
      <span className="mr-title-season">
        <TopTabsDecor />
      </span>
    </>
  );
}

export function MrNavDecor() {
  const { season, navigate } = useApp();
  if (!season || !SEASON_ART[season]) return null;
  const art = SEASON_ART[season];
  return (
    <button className={`mr-nav-season ${season}`} onClick={() => navigate({ page: 'settings', section: 'themes', focus: 'seasons' })} aria-label={LABEL()[season]} data-tip={`${LABEL()[season]}: ${t('clic para ajustarlo')}`} data-tip-pos="right">
      <SeasonIcon season={season} size={30} />
    </button>
  );
}
