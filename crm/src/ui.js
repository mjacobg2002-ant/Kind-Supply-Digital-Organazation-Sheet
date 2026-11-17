import { icon } from './icons.js';
export { icon };

export const h = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);
export const dollars = cents => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: Number(cents) % 100 ? 2 : 0
}).format((Number(cents) || 0) / 100);
export const day = (date = new Date(), timezone = 'America/New_York') => new Intl.DateTimeFormat('sv-SE', { timeZone: timezone }).format(date);
export const dayLabel = value => value ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(value + 'T12:00:00Z')) : '—';
export const timeLabel = (value, timezone) => value ? new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: timezone
}).format(new Date(value)) : '—';
export const initials = (value = '') => value.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase();
export const avatar = (value, i = 0, size = '') => `<span class="avatar tone-${i % 6} ${size}">${h(initials(value) || 'KS')}</span>`;
export const chip = (value, tone = 'neutral') => `<span class="chip chip-${tone}">${h(value)}</span>`;
export const statusTone = value => ['Won','Paid','Completed','Accepted','Submitted','Active','Working','active','trialing'].includes(value) ? 'green'
  : ['Lost','Failed','Broken','Canceled','Payment failed','Refunded','Dispute opened','Fraud warning','past_due','canceled','unpaid'].includes(value) ? 'red'
  : ['High','Pending','Needs review','No website','No show','Partially refunded','unpaid'].includes(value) ? 'amber'
  : ['Scheduled','Published','Inbound','Open','Sending'].includes(value) ? 'blue' : 'neutral';

export function button(label, { glyph = '', action = '', id = '', kind = 'secondary', title = '', attrs = '' } = {}) {
  return `<button type="button" class="button ${kind}${label ? '' : ' icon-button'}" data-action="${action}"${id ? ` data-id="${h(id)}"` : ''}${title ? ` title="${h(title)}" aria-label="${h(title)}"` : ''} ${attrs}>${glyph ? icon(glyph) : ''}${label ? `<span>${h(label)}</span>` : ''}</button>`;
}
export const primary = (label, action, glyph = 'plus') => button(label, { glyph, action, kind: 'primary' });
export const edit = (key, row) => button('', { glyph: 'square-pen', action: 'edit:' + key, id: row.id, kind: 'ghost', title: 'Edit record' });
export const contactName = (s, id) => s.contacts.find(row => row.id === id)?.company || '—';
export const stageName = (s, id) => s.stages.find(row => row.id === id)?.name || '—';
export const hashLink = (key, token) => location.origin + '/?' + key + '=' + encodeURIComponent(token);
export const example = (glyph, title, description, control = '') => `<div class="empty">
  <span class="empty-icon">${icon(glyph)}</span><strong>${h(title)}</strong><p>${h(description)}</p>${control}</div>`;

export function safeLink(value, label) {
  try {
    const url = new URL(value);
    if (['http:','https:'].includes(url.protocol)) return `<a class="text-link" href="${h(url.href)}" target="_blank" rel="noopener noreferrer">${h(label)} ${icon('external-link')}</a>`;
  } catch { /* missing links display a dash */ }
  return '—';
}

export function table(headers, rows, emptyMarkup) {
  return rows.length ? `<div class="table-scroll"><table><thead><tr>${headers.map(title => `<th scope="col">${h(title)}</th>`).join('')}</tr></thead><tbody>${rows.map(cells => '<tr>' + cells.map(cell => `<td>${cell}</td>`).join('') + '</tr>').join('')}</tbody></table></div>` : emptyMarkup;
}

export function panel(title, description, body, controls = '', classes = '') {
  return `<section class="panel ${classes}"><div class="panel-head"><div><h2>${h(title)}</h2>${description ? `<p>${h(description)}</p>` : ''}</div>${controls}</div>${body}</section>`;
}

export function fieldSelect(options, value, anyLabel = '') {
  return (anyLabel ? `<option value="">${h(anyLabel)}</option>` : '') + options.map(raw => {
    const [id, label] = typeof raw === 'string' ? [raw, raw] : raw;
    return `<option value="${h(id)}"${value === id ? ' selected' : ''}>${h(label)}</option>`;
  }).join('');
}
