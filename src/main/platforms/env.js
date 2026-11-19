// Where a mod has to be installed: 'client' (only in the game), 'server'
// (only on the server), 'both', or '' when the platform doesn't say.

const SUPPORTED = new Set(['required', 'optional']);

// Modrinth: client_side / server_side = required | optional | unsupported | unknown
function envFromSides(client, server) {
  const c = SUPPORTED.has(client);
  const s = SUPPORTED.has(server);
  if (c && s) return 'both';
  if (c && server === 'unsupported') return 'client';
  if (s && client === 'unsupported') return 'server';
  if (c && server === 'unknown') return 'both';
  return '';
}

// CurseForge: files list "Client" / "Server" among their game versions
function envFromCurseVersions(gameVersions) {
  const l = (gameVersions || []).map((g) => String(g).toLowerCase());
  const c = l.includes('client');
  const s = l.includes('server');
  if (c && s) return 'both';
  if (c) return 'client';
  if (s) return 'server';
  return '';
}

module.exports = { envFromSides, envFromCurseVersions };
