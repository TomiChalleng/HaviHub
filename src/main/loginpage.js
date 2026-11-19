// The page a browser shows after signing in to Microsoft through the engine.
// The engine sends the browser to http://127.0.0.1:47219/havihub (see
// engine-brand.js); Havi Hub answers from this computer with its own page,
// in Havi Hub's language, instead of the engine maker's website.
const http = require('node:http');
const { LOGIN_PAGE_PORT } = require('./engine-brand');

const TEXT = {
  es: { title: 'Listo · Havi Hub', heading: 'Cuenta conectada', body: 'Ya puedes cerrar esta pestaña y volver a Havi Hub.' },
  en: { title: 'Done · Havi Hub', heading: 'Account connected', body: 'You can close this tab and go back to Havi Hub.' },
};

function page(lang, iconPng) {
  const t = TEXT[lang] || TEXT.es;
  const icon = iconPng ? `<img src="data:image/png;base64,${iconPng.toString('base64')}" alt="" width="96" height="96">` : '';
  return `<!doctype html>
<html lang="${lang === 'en' ? 'en' : 'es'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t.title}</title>
<style>
  html, body { height: 100%; margin: 0; }
  body { display: grid; place-items: center; background: #17171a; color: #f2f2f4; font: 16px/1.5 system-ui, "Segoe UI", sans-serif; }
  main { text-align: center; padding: 32px; }
  img { display: block; margin: 0 auto 20px; border-radius: 22px; }
  h1 { margin: 0 0 8px; font-size: 28px; font-weight: 700; letter-spacing: -0.01em; }
  p { margin: 0; color: #b4b4bc; }
  .ok { display: inline-block; width: 10px; height: 10px; margin-right: 10px; border-radius: 50%; background: #3ddc84; vertical-align: 3px; }
</style>
</head>
<body>
<main>
${icon}
<h1><span class="ok"></span>${t.heading}</h1>
<p>${t.body}</p>
</main>
</body>
</html>`;
}

// language: () => 'es' | 'en'; iconPng: Buffer | null
function startLoginPage({ language, iconPng }) {
  const server = http.createServer((req, res) => {
    const url = String(req.url || '').split('?')[0];
    // Any page of this little server is the "account connected" one (an engine
    // patched with the older, shorter address asks for one that ends in junk);
    // only the browser's own extra requests are turned away.
    if (req.method !== 'GET' || /\.(ico|png|js|css|map|txt)$/i.test(url)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(page(language(), iconPng));
  });
  // another program on that port: the browser then shows its own message; nothing else breaks
  server.on('error', () => {});
  server.listen(LOGIN_PAGE_PORT, '127.0.0.1');
  server.unref();
  return server;
}

module.exports = { startLoginPage, page };
