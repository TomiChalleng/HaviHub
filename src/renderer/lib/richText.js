// Project descriptions and changelogs (Markdown from Modrinth, HTML from
// CurseForge), cleaned before they are shown.
import { marked } from 'marked';
import DOMPurify from 'dompurify';

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
  if (node.tagName === 'IMG') node.setAttribute('loading', 'lazy');
});

export function renderBody(body, format) {
  const html = format === 'markdown' ? marked.parse(body || '', { gfm: true, breaks: false }) : body || '';
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: ['style', 'script', 'form', 'input', 'button', 'object', 'embed'],
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allowfullscreen'],
    ALLOWED_URI_REGEXP: /^(?:https?:|data:image\/)/i,
  }).replace(/<iframe(?![^>]*src="https:\/\/(?:www\.)?youtube(?:-nocookie)?\.com)[^>]*>.*?<\/iframe>/gis, '');
}
