// Local files are exposed to the renderer through the custom havihub:// protocol.
// The protocol handler (main.js) only serves files inside allowed roots.
function fileUrl(absPath, version) {
  if (!absPath) return null;
  const v = version ? `?v=${Math.round(version)}` : '';
  return `havihub://local/${encodeURIComponent(absPath)}${v}`;
}

function pathFromUrl(url) {
  const u = new URL(url);
  return decodeURIComponent(u.pathname.replace(/^\//, ''));
}

module.exports = { fileUrl, pathFromUrl };
