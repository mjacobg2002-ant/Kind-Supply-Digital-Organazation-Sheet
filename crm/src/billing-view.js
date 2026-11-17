import { financialMetrics } from './finance.js';
import { button, chip, dollars, example, fieldSelect, h, icon, panel, safeLink, statusTone, table, timeLabel } from './ui.js';

export function financialSummary(state,integrations,period='month',demo=false,compact=false) {
  const data=financialMetrics(state,period,new Date(),state.settings.timezone);
  const enabled=integrations?.stripe || demo;
  const stats=[
    ['Subscription MRR',data.mrr, data.activeSubscriptions+' active or past-due USD subscriptions','trending-up','lavender'],
    ['Payments received',data.gross, data.receipts.length+' successful '+(data.receipts.length===1 ? 'payment' : 'payments')+' in selected period','circle-dollar-sign','mint'],
    ['Failed payments',data.failedAmount, data.failed.length+' '+(data.failed.length===1 ? 'payment requires' : 'payments require')+' attention','triangle-alert','peach'],
    ['Outstanding invoices',data.outstanding,'Open and failed invoice balances','file-text','periwinkle'],
    ...(!compact ? [
      ['Net received',data.net,'Received less refunds in selected period','hand-coins','mint'],
      ['Refunded',data.refunded,'Successful refunds in selected period','rotate-ccw','peach'],
      ['Annual recurring revenue',data.arr,'Current monthly recurring value × 12','chart-no-axes-combined','lavender'],
      ['MRR at risk',data.atRiskMrr,'Subscriptions with a past-due payment','clock','peach']
    ] : [])
  ];
  return `<div class="metrics finance-metrics">${stats.map(([label,amount,note,glyph,tone])=>`<button type="button" class="metric-card" data-action="nav:billing">
    <div class="metric-header"><span class="metric-icon ${tone}">${icon(glyph)}</span>${icon('arrow-up-right')}</div>
    <span class="metric-label">${label}</span><strong>${enabled ? dollars(amount) : '—'}</strong><span class="metric-note">${h(enabled ? note : 'Connect Stripe to start tracking')}</span>
  </button>`).join('')}</div>`;
}
function collectionChart(months,enabled) {
  const max=Math.max(1,...months.map(row=>row.amount));
  return `<div class="collection-bars" aria-label="Payments received over six months">${months.map(row=>`<div class="collection-column">
    <strong>${enabled ? dollars(row.amount) : '—'}</strong><div class="collection-track"><span style="height:${enabled ? row.amount/max*100 : 0}%"></span></div><span>${h(row.label)}</span>
  </div>`).join('')}</div>`;
}
const amount = row => row.currency && row.currency!=='usd'
  ? new Intl.NumberFormat('en-US',{style:'currency',currency:row.currency.toUpperCase()}).format((row.collectedAmount ?? row.amount)/100)
  : dollars(row.collectedAmount ?? row.amount);
const date = (value,state) => h(timeLabel(value,state.settings.timezone));

export function billingView(state,integrations,filters,manager,demo) {
  const period=filters.billingPeriod || 'month';
  const metrics=financialMetrics(state,period,new Date(),state.settings.timezone);
  const enabled=integrations.stripe || demo;
  const source=state.billingSync || {};
  const syncTimes=Object.values(source).filter(row=>row?.at).map(row=>row.at).sort();
  const partial=['charges','invoices','subscriptions'].some(key=>source[key]?.complete===false);
  const methods=[['month','This month'],['30','Last 30 days'],['90','Last 90 days'],['all','All recorded payments']];
  const toolbar=`<div class="toolbar billing-toolbar"><div><strong>Revenue overview</strong><p>${enabled
    ? `USD totals · MRR before discounts and tax${partial ? ' · Import in progress' : ''}`
    : 'Connect your Stripe account to populate this dashboard.'}</p></div><div class="action-row">
    <select class="select" aria-label="Payment reporting period" data-filter="billingPeriod">${fieldSelect(methods,period)}</select>
    ${manager ? button(enabled && !demo ? 'Sync Stripe' : 'Connect Stripe',{glyph:enabled && !demo ? 'refresh-cw' : 'credit-card',action:enabled && !demo ? 'stripe-sync' : 'stripe-setup'}) : ''}
  </div></div>`;
  const category=filters.paymentStatus || '';
  const rows=state.payments.filter(row=>!category || (category==='Failed' ? ['Failed','Payment failed','Uncollectible'].includes(row.status)
    : category==='Paid' ? ['Paid','Partially refunded','Refunded'].includes(row.status) : category==='Refunded' ? Boolean(row.refunded) : row.status===category));
  const review=metrics.failed.slice(0,8);
  const syncNote=syncTimes.at(-1) ? 'Last account sync '+timeLabel(syncTimes.at(-1),state.settings.timezone) : source.lastWebhook ? 'Latest Stripe event '+timeLabel(source.lastWebhook,state.settings.timezone) : 'Sync Stripe to import existing account activity.';
  return `<div class="stack"><section class="panel">${toolbar}</section>
    ${financialSummary(state,integrations,period,demo)}
    <div class="dashboard-grid">
      ${panel('Payments received','Six months of recorded successful USD payments',collectionChart(metrics.months,enabled))}
      ${panel('Payment recovery','Current failures that still need attention',review.length ? `<ul class="followups">${review.map(row=>`<li><span class="feed-icon">${icon('triangle-alert')}</span><div class="row-main"><strong>${h(row.title)}</strong><span>${h(row.failure || (row.nextAttemptAt ? 'Next retry '+timeLabel(row.nextAttemptAt,state.settings.timezone) : 'Review in Stripe'))}</span></div><strong>${dollars(row.outstandingAmount ?? row.amount)}</strong></li>`).join('')}</ul>`
        : example('circle-check',enabled ? 'No failed payments recorded' : 'Waiting for Stripe',enabled ? 'Declined or returned payments will appear here.' : 'Payment recovery starts after Stripe is connected.'))}
    </div>
    ${panel('Payment activity',enabled ? syncNote : 'No Stripe activity has been connected.',
      table(['Client / payment','Type','Amount','Status','Received / created','Details'],rows.map(row=>[
        `<div class="cell-lines"><div><strong>${h(row.title)}</strong><small>${h(row.risk || row.failure || row.invoiceId || row.chargeId || '')}</small></div></div>`,
        h(({invoice:'Invoice',charge:'Payment',payment:'One-time checkout',subscription:'Subscription checkout'})[row.mode] || row.mode),
        amount(row),chip(row.status,statusTone(row.status)),date(row.paidAt || row.createdAt,state),
        row.status==='Open' && row.checkoutUrl && Date.parse(row.expiresAt)>Date.now() ? button('Copy checkout',{glyph:'copy',action:'copy-payment',id:row.id})
          : safeLink(row.invoiceUrl || row.receiptUrl,row.invoiceUrl ? 'Invoice' : 'Receipt')
      ]),example('credit-card','No payments in this view','Connected Stripe payment activity will appear here.')),
      `<select class="select small" aria-label="Filter payment activity" data-filter="paymentStatus">${fieldSelect(['Paid','Failed','Pending','Open','Refunded','Expired'],category,'All statuses')}</select>`)}
    ${panel('Recurring subscriptions','Monthly recurring amounts are normalized from Stripe prices, billing intervals, and quantities.',
      table(['Client / subscription','Monthly value','Status','Current period ends','Renewal'],state.subscriptions.map(row=>[
        `<div class="cell-lines"><div><strong>${h(row.title)}</strong><small>${h(row.id)}</small></div></div>`,amount({...row,amount:row.mrr ?? row.amount}),
        chip(row.status,statusTone(row.status)),date(row.currentPeriodEnd,state),row.cancelAtPeriodEnd ? 'Cancellation scheduled' : 'Managed in Stripe'
      ]),example('hand-coins','No subscriptions recorded','Subscription activity appears after Stripe sync or a billing event.')))}
    ${state.subscriptions.some(row=>row.mrrIncomplete) ? '<p class="muted">Usage or tiered subscriptions need a pricing review before their full recurring value can be reported.</p>' : ''}
  </div>`;
}
