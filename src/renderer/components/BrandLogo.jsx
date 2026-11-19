// The logos of the launchers and sites Havi Hub works with, as their owners
// publish them: Prism Launcher (CC BY-SA 4.0), CurseForge, Modrinth. Minecraft
// is shown as a grass block, drawn as the game's inventory draws it from the
// game's own textures (lib/mc-textures.js); no image of Mojang's ships with the
// app. The box stays empty while those are first looked for, and Havi Hub's
// own drawing of one stands in only if the game's files are not there. Each
// sits centered in a square box of `size`.
import prismSvg from '../brands/prism.svg';
import curseforgeSvg from '../brands/curseforge.svg';
import modrinthSvg from '../brands/modrinth.svg';
import { mcSettled, mcUrl, useMcTextures } from '../lib/mc-textures.js';
import { symbolUrl } from '../lib/instance-icons.js';
import { useTrimmed } from '../lib/trim.js';

const SVG = { prism: prismSvg, curseforge: curseforgeSvg, modrinth: modrinthSvg };
// how much of the box each mark fills, so they look the same size side by side
const FILL = { prism: 0.94, curseforge: 1, modrinth: 0.9 };

export const BRAND_NAMES = { prism: 'Prism Launcher', curseforge: 'CurseForge', modrinth: 'Modrinth', minecraft: 'Minecraft' };

function GrassBlock({ size, className, label }) {
  useMcTextures();
  const game = mcUrl('block/grass#inventory');
  const settled = mcSettled();
  const own = symbolUrl('grass');
  const trimmed = useTrimmed(own, settled && !game);
  if (!game && !settled) return <span className={`brand-logo brand-minecraft ${className}`} style={{ width: size, height: size }} aria-hidden="true" />;
  return <img className={`brand-logo brand-minecraft ${className}`} src={game || trimmed || own} width={size} height={size} alt={label || ''} draggable={false} />;
}

export default function BrandLogo({ brand, size = 20, className = '', title }) {
  const label = title === undefined ? BRAND_NAMES[brand] || brand : title;
  if (brand === 'minecraft') return <GrassBlock size={size} className={className} label={label} />;
  const svg = SVG[brand];
  if (!svg) return null;
  const inner = Math.round(size * (FILL[brand] || 1));
  return (
    <span className={`brand-logo brand-${brand} ${className}`} style={{ width: size, height: size }} role={label ? 'img' : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true}>
      <span className="brand-logo-art" style={{ width: inner, height: inner }} dangerouslySetInnerHTML={{ __html: svg }} />
    </span>
  );
}
