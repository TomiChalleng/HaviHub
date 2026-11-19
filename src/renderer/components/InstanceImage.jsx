// Instance artwork: the instance's own image (always cropped/fit to the box)
// or, when it has none (or its file cannot be shown), a generated icon: the
// one it was made from, or a fixed one picked from the instance id.
import { useState } from 'react';
import Icon from './Icon.jsx';
import { iconUrl, defaultRecipe, parseRecipe, usingMinecraft } from '../lib/instance-icons.js';
import { useMcTextures } from '../lib/mc-textures.js';

export function instanceRecipe(instance) {
  return parseRecipe(instance && instance.iconRecipe) || defaultRecipe(instance ? instance.id : '');
}

// A generated icon (background + symbol), full-bleed in its box.
export function GeneratedIcon({ recipe, size, className = '', alt = '' }) {
  useMcTextures(); // drawn again when the game's textures arrive
  return <img className={`gen-icon ${className}`} src={iconUrl(recipe)} width={size} height={size} alt={alt} draggable={false} />;
}

// The picture at the size it is drawn: small spots get a small copy (128 px),
// cards and headers a medium one. `res` picks it by hand (128, 640 or 1024).
function sized(url, res) {
  if (!url || !res || !url.startsWith('havihub://local/')) return url;
  return `${url}${url.includes('?') ? '&' : '?'}w=${res}`;
}

export default function InstanceImage({ instance, size, res, className = '', fit = 'cover' }) {
  const raw = instance && instance.icon;
  const icon = sized(raw, res || (size && size <= 64 ? 128 : 640));
  const [broken, setBroken] = useState(null);
  useMcTextures();
  // An icon made in the editor is kept as a picture too (for the other
  // launchers). Here it is drawn from its recipe, so it always shows the game's
  // textures, also when that picture was saved with the older drawings.
  const made = parseRecipe(instance && instance.iconRecipe);
  return (
    <div className={`inst-image ${className}`} style={size ? { width: size, height: size } : undefined}>
      {icon && broken !== icon && !(made && usingMinecraft()) ? (
        <img src={icon} alt="" draggable={false} decoding="async" loading="lazy" style={{ objectFit: fit }} onError={() => setBroken(icon)} />
      ) : (
        <GeneratedIcon recipe={instanceRecipe(instance)} />
      )}
    </div>
  );
}

const LOADER_ICONS = { fabric: 'feather', quilt: 'quilt', forge: 'anvil', neoforge: 'fox', liteloader: 'zap' };

export function LoaderIcon({ loader, size = 18 }) {
  const id = loader ? loader.id || loader : 'vanilla';
  return <Icon name={LOADER_ICONS[id] || 'cube'} size={size} className={`loader-icon loader-${id}`} />;
}

export function loaderLabel(loader) {
  if (!loader) return 'Vanilla';
  return loader.name || loader.id;
}
