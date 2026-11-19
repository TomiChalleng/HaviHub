// Havikun's channels, shown in the Modrinth layout's side column (in this order).
// `embed` is the network's own embeddable page, for the ones that publish no
// open feed (`fallback`: its normal page, shown when the embeddable one turns
// visitors away; `signIn`: where to sign in to that network); `color` is the network's color, used when its row is open.
const SOCIALS = [
  { id: 'linktree', name: 'Linktree', handle: 'havikunn', url: 'https://linktr.ee/havikunn', color: '#43e55e', light: true },
  { id: 'youtube', name: 'YouTube', handle: '@havikun', url: 'https://www.youtube.com/@havikun', channelId: 'UCfu1c-CmpcSEnnYpOy9l0Hg', color: '#ff0033' },
  { id: 'twitch', name: 'Twitch', handle: 'havikun', url: 'https://www.twitch.tv/havikun', login: 'havikun', color: '#9146ff' },
  { id: 'instagram', name: 'Instagram', handle: '@havikunn', url: 'https://www.instagram.com/havikunn/', embed: 'https://www.instagram.com/havikunn/embed/', color: '#e4405f' },
  { id: 'x', name: 'X', handle: '@havikun', url: 'https://x.com/havikun', signIn: 'https://x.com/i/flow/login', fallback: 'https://x.com/havikun', embed: 'https://syndication.twitter.com/srv/timeline-profile/screen-name/havikun?dnt=true&theme=dark&hideHeader=true&hideFooter=true&transparent=true&lang=es', color: '#e7e9ea', light: true },
  { id: 'tiktok', name: 'TikTok', handle: '@havikun', url: 'https://www.tiktok.com/@havikun', embed: 'https://www.tiktok.com/embed/@havikun', color: '#fe2c55' },
];

// the hosts those embeds live on (a guest page never leaves them)
const EMBED_HOSTS = ['www.instagram.com', 'syndication.twitter.com', 'platform.twitter.com', 'x.com', 'www.tiktok.com'];
function isSocialEmbed(url) {
  try {
    const u = new URL(url);
    if (typeof process !== 'undefined' && process.env && process.env.HAVIHUB_SOCIAL_TEST && u.origin === process.env.HAVIHUB_SOCIAL_TEST) return true;
    return u.protocol === 'https:' && EMBED_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}

// where to support Havikun's work (the card under the channels)
const SUPPORT = { name: 'Ko-fi', url: 'https://ko-fi.com/havikunn', handle: 'ko-fi.com/havikunn' };

module.exports = {
  SUPPORT, SOCIALS, EMBED_HOSTS, isSocialEmbed };
