// Size of the profile and group cards in My modpacks: two buttons (- / +) in
// one segmented piece that looks like the toolbar buttons next to it.
import Icon from './Icon.jsx';
import { t } from '../lib/i18n.js';

export const TILE_SIZES = [196, 216, 236, 266, 296];
export const TILE_DEFAULT = 236;

export function useTileSize(app) {
  const saved = app.config && app.config.libraryTileSize;
  const tile = TILE_SIZES.includes(saved) ? saved : TILE_DEFAULT;
  const i = TILE_SIZES.indexOf(tile);
  const step = (d) => {
    const next = TILE_SIZES[Math.min(TILE_SIZES.length - 1, Math.max(0, i + d))];
    if (next !== tile) app.updateConfig({ libraryTileSize: next });
  };
  // --tile: the CurseForge card width; --tile-k: the same as a factor (Modrinth)
  const style = { '--tile': `${tile}px`, '--tile-k': tile / TILE_DEFAULT };
  return { tile, step, style, min: i === 0, max: i === TILE_SIZES.length - 1 };
}

// variant: 'cf' (square toolbar buttons) or 'mr' (rounded Modrinth buttons)
export default function TileSize({ size, variant = 'cf' }) {
  const less = t('Tarjetas más pequeñas');
  const more = t('Tarjetas más grandes');
  return (
    <div className={`tile-size tile-size-${variant}`} role="group" aria-label={t('Tamaño de las tarjetas')}>
      <button type="button" className="tile-size-btn" onClick={() => size.step(-1)} disabled={size.min} title={less} aria-label={less}>
        <Icon name="minus" size={variant === 'cf' ? 28 : 18} />
      </button>
      <span className="tile-size-sep" aria-hidden="true" />
      <button type="button" className="tile-size-btn" onClick={() => size.step(1)} disabled={size.max} title={more} aria-label={more}>
        <Icon name="plus" size={variant === 'cf' ? 28 : 18} />
      </button>
    </div>
  );
}
