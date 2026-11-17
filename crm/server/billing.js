import Stripe from 'stripe';
import { randomBytes } from 'node:crypto';
import { audit, getRecord, newRecord, runWorkflows, updateState } from './model.js';
import { baseUrl, reject } from './security.js';

const eventTypes = new Set([
  'checkout.session.completed','checkout.session.expired','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed',
  'customer.subscription.created','customer.subscription.updated','customer.subscription.deleted',
  'invoice.paid','invoice.payment_failed','charge.refunded','charge.dispute.created','radar.early_fraud_warning.created'
]);
const billingRoles = ['owner','admin'];
const resourceId = value => typeof value === 'string' ? value : value?.id;
const marker = 'kind-supply-crm';
const client = () => new Stripe(process.env.STRIPE_API_KEY, { maxNetworkRetries: 1, timeout: 9000 });
const checkoutLabel = 'ksd_' + Array.from(randomBytes(8), byte => String.fromCharCode(97 + byte % 26)).join('');
const metadataFor = (workspace, payment) => ({ app: marker, workspace, payment });

export function priceIds() {
  return (process.env.STRIPE_MONTHLY_PRICE_IDS ?? '').split(',').map(id => id.trim()).filter(Boolean);
}
export const billingEnabled = () => Boolean(process.env.STRIPE_API_KEY && process.env.STRIPE_WEBHOOK_SECRET);

export async function checkout(db, workspace, user, input, req) {
  if (!billingEnabled()) reject(503, 'Set up Stripe and its webhook in Vercel first.');
  const stripe = client();
  const monthly = input.mode === 'subscription';
  const price = monthly ? input.price : '';
  if (monthly && !priceIds().includes(price)) reject(400, 'Choose an approved monthly Stripe price.');
  const reservation = await updateState(db, workspace, state => {
    const deal = getRecord(state, 'deals', input.dealId);
    const contact = getRecord(state, 'contacts', deal.contactId);
    const amount = monthly ? deal.mrr : Number(input.amount);
    if (!Number.isInteger(amount) || amount < 50 || amount > 99999999) reject(400, 'Enter a USD amount between $0.50 and $999,999.99.');
    const key = (typeof input.requestId === 'string' && /^[a-z0-9-]{36}$/i.test(input.requestId)) ? input.requestId : '';
    if (!key) reject(400, 'Checkout request ID is required.');
    const mode = monthly ? 'subscription' : 'payment';
    const existing = state.payments.find(row => row.requestId === key);
    if (existing) {
      if (existing.dealId !== deal.id || existing.mode !== mode || existing.amount !== amount || existing.price !== price) reject(409, 'Start a new checkout request for the changed terms.');
      return existing;
    }
    if (state.payments.length >= 5000) reject(409, 'This workspace reached its payment record limit.');
    if (state.payments.some(row => row.dealId === deal.id && row.mode === mode && (row.status === 'Pending' || (['Preparing','Open'].includes(row.status) && (!row.expiresAt || Date.parse(row.expiresAt) > Date.now()))))) {
      reject(409, 'There is already a checkout in progress for this opportunity and billing type.');
    }
    if (monthly && state.subscriptions.some(row => row.dealId === deal.id && !['canceled','incomplete_expired'].includes(row.status))) reject(409, 'This opportunity already has a Stripe subscription.');
    const row = newRecord({
      requestId: key, dealId: deal.id, contactId: contact.id, title: deal.title, email: contact.email,
      amount, currency: 'usd', mode, price, status: 'Preparing', label: checkoutLabel,
      expiresAt: new Date(Date.now() + 24 * 3600000 - 60000).toISOString()
    });
    state.payments.unshift(row);
    return row;
  }, user.id, billingRoles);
  if (reservation.checkoutUrl && reservation.status === 'Open' && Date.parse(reservation.expiresAt) > Date.now()) return reservation;
  if (reservation.status !== 'Preparing' || Date.parse(reservation.expiresAt) < Date.now() + 1800000) {
    reject(409, 'This checkout attempt has expired. Start a new request.');
  }
  const metadata = metadataFor(workspace, reservation.id);
  const origin = baseUrl(req);
  try {
    if (monthly) {
      const configured = await stripe.prices.retrieve(price);
      if (!configured.active || configured.currency !== 'usd' || configured.unit_amount !== reservation.amount
          || configured.recurring?.interval !== 'month' || configured.recurring?.interval_count !== 1
          || configured.recurring?.usage_type !== 'licensed' || configured.billing_scheme !== 'per_unit') {
        reject(400, 'The Stripe price must be an active flat monthly USD price that matches this opportunity’s monthly amount.');
      }
    }
    const session = await stripe.checkout.sessions.create({
      mode: reservation.mode, metadata,
      integration_identifier: reservation.label,
      client_reference_id: reservation.id,
      expires_at: Math.floor(Date.parse(reservation.expiresAt) / 1000),
      ...(reservation.email && { customer_email: reservation.email }),
      success_url: origin + '/?checkout=confirmed',
      cancel_url: origin + '/?checkout=canceled',
      line_items: [{
        quantity: 1,
        ...(monthly ? { price } : { price_data: {
          currency: 'usd', unit_amount: reservation.amount, product_data: { name: reservation.title }
        } })
      }],
      ...(monthly ? { subscription_data: { metadata } } : { payment_intent_data: { metadata } })
    }, { idempotencyKey: 'crm-checkout-' + reservation.id });
    return updateState(db, workspace, state => {
      const row = getRecord(state, 'payments', reservation.id);
      row.sessionId = session.id;
      row.checkoutUrl = session.url;
      if (row.status === 'Preparing') row.status = 'Open';
      audit(state, 'Created Stripe checkout: ' + row.title, user.name, row);
      return row;
    });
  } catch (error) {
    const permanent = error.status === 400 || error.type === 'StripeInvalidRequestError' || error.type === 'StripePermissionError' || error.type === 'StripeAuthenticationError';
    if (permanent) await updateState(db, workspace, state => {
      const row = getRecord(state, 'payments', reservation.id);
      if (row.status === 'Preparing') row.status = 'Failed';
    });
    if (error.status) throw error;
    reject(502, permanent ? 'Stripe rejected the checkout settings. Check the configured key and price.' : 'Stripe could not confirm checkout. Retry using this same form.');
  }
}

async function riskMetadata(stripe, type, object) {
  const charge = type === 'charge.refunded' ? object : await stripe.charges.retrieve(resourceId(object.charge));
  const intent = resourceId(charge.payment_intent);
  if (!intent) return {};
  const payment = await stripe.paymentIntents.retrieve(intent);
  if (payment.metadata?.app === marker) return { metadata: payment.metadata, charge, intent };
  const invoices = await stripe.invoicePayments.list({ payment: { type: 'payment_intent', payment_intent: intent }, limit: 10 });
  for (const payment of invoices.data) {
    const invoice = await stripe.invoices.retrieve(resourceId(payment.invoice));
    const subscription = resourceId(invoice.parent?.subscription_details?.subscription ?? invoice.subscription);
    if (!subscription) continue;
    const sub = await stripe.subscriptions.retrieve(subscription);
    if (sub.metadata?.app === marker) return { metadata: sub.metadata, charge, intent, invoice, subscription };
  }
  return {};
}

export async function stripeWebhook(db, raw, signature) {
  if (!billingEnabled()) reject(503, 'Stripe webhook is not configured.');
  if (!signature) reject(400, 'Missing Stripe signature.');
  const stripe = client();
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    reject(400, 'Invalid Stripe signature.');
  }
  const type = event.type;
  if (!eventTypes.has(type)) return { received: true };
  const seen = await db.query("SELECT 1 FROM crm_provider_events WHERE provider='stripe' AND id=$1", [event.id]);
  if (seen.rows.length) return { received: true };
  let object = event.data.object;
  let metadata = object.metadata;
  let subscription = '';
  let risk;
  if (type.startsWith('customer.subscription.')) {
    subscription = object.id;
    object = await stripe.subscriptions.retrieve(subscription);
    metadata = object.metadata;
  }
  if (type.startsWith('invoice.')) {
    subscription = resourceId(object.parent?.subscription_details?.subscription ?? object.subscription);
    if (!subscription) return { received: true };
    metadata = (await stripe.subscriptions.retrieve(subscription)).metadata;
    object = await stripe.invoices.retrieve(object.id);
  }
  if (type.startsWith('charge.') || type.startsWith('radar.')) {
    risk = await riskMetadata(stripe, type, object);
    metadata = risk.metadata;
    subscription = risk.subscription;
  }
  if (metadata?.app !== marker || metadata.workspace !== process.env.INTEGRATION_WORKSPACE_ID || !metadata.payment) return { received: true };
  await updateState(db, metadata.workspace, async (state, tx) => {
    const received = await tx.query("INSERT INTO crm_provider_events(provider,id) VALUES ('stripe',$1) ON CONFLICT DO NOTHING RETURNING id", [event.id]);
    if (!received.rows.length) return;
    const order = state.payments.find(row => row.id === metadata.payment);
    if (!order) return;
    if (type.startsWith('checkout.')) {
      if (order.sessionId && order.sessionId !== object.id) return;
      order.sessionId = object.id;
      order.paymentIntent = resourceId(object.payment_intent) ?? order.paymentIntent;
      order.subscriptionId = resourceId(object.subscription) ?? order.subscriptionId;
      if (object.payment_status === 'paid' || object.payment_status === 'no_payment_required') {
        if (order.status !== 'Paid' && !order.refunded) {
          order.status = 'Paid';
          order.collectedAmount = object.amount_total ?? order.amount;
          order.paidAt = new Date(event.created * 1000).toISOString();
          audit(state, 'Stripe checkout completed: ' + order.title, 'Stripe', order);
          if (order.mode === 'payment') runWorkflows(state, 'Payment received', order);
        }
      } else if (!['Paid','Refunded','Partially refunded'].includes(order.status)) {
        if (type.endsWith('failed')) order.status = 'Failed';
        else if (type.endsWith('expired')) order.status = 'Expired';
        else if (!['Failed','Expired'].includes(order.status)) order.status = 'Pending';
      }
    }
    if (type.startsWith('customer.subscription.')) {
      order.subscriptionId = subscription;
      const previous = state.subscriptions.find(row => row.id === subscription);
      const row = { id: subscription, dealId: order.dealId, contactId: order.contactId, title: order.title, status: object.status, amount: order.amount, cancelAtPeriodEnd: object.cancel_at_period_end };
      const previousStatus = previous?.status;
      if (previous) Object.assign(previous, row);
      else state.subscriptions.unshift(row);
      if (previousStatus !== object.status || type.endsWith('deleted')) audit(state, 'Stripe subscription: ' + object.status + ' · ' + order.title, 'Stripe', order);
    }
    if (type.startsWith('invoice.')) {
      const invoice = state.payments.find(row => row.invoiceId === object.id);
      const paid = object.status === 'paid';
      const row = {
        invoiceId: object.id, dealId: order.dealId, contactId: order.contactId, title: order.title,
        amount: object.amount_due, collectedAmount: object.amount_paid, currency: object.currency, mode: 'invoice',
        status: paid ? 'Paid' : 'Payment failed', invoiceUrl: object.hosted_invoice_url,
        paidAt: object.status_transitions?.paid_at ? new Date(object.status_transitions.paid_at * 1000).toISOString() : null
      };
      const firstPayment = paid && invoice?.status !== 'Paid' && !invoice?.refunded;
      if (invoice && !invoice.refunded) Object.assign(invoice, row);
      if (!invoice) state.payments.unshift(newRecord(row));
      audit(state, (paid ? 'Stripe invoice paid: ' : 'Stripe invoice payment failed: ') + order.title, 'Stripe', order);
      if (firstPayment) runWorkflows(state, 'Payment received', order);
    }
    if (risk) {
      let payment = risk.invoice ? state.payments.find(row => row.invoiceId === risk.invoice.id) : order;
      if (!payment && risk.invoice) {
        const invoice = risk.invoice;
        payment = newRecord({
          invoiceId:invoice.id, dealId:order.dealId, contactId:order.contactId, title:order.title,
          amount:invoice.amount_due, collectedAmount:invoice.amount_paid, currency:invoice.currency,
          mode:'invoice', status:invoice.status === 'paid' ? 'Paid' : 'Payment failed', invoiceUrl:invoice.hosted_invoice_url,
          paidAt:invoice.status_transitions?.paid_at ? new Date(invoice.status_transitions.paid_at * 1000).toISOString() : null
        });
        state.payments.unshift(payment);
      }
      if (!payment) return;
      if (type === 'charge.refunded') {
        if (!payment.collectedAmount) payment.collectedAmount = risk.charge.amount_captured ?? risk.charge.amount ?? 0;
        payment.refunded = Math.max(payment.refunded ?? 0, risk.charge.amount_refunded ?? 0);
        payment.status = risk.charge.refunded ? 'Refunded' : 'Partially refunded';
      } else {
        payment.risk = type === 'charge.dispute.created' ? 'Dispute opened' : 'Fraud warning';
      }
      audit(state, `Stripe ${payment.risk && type !== 'charge.refunded' ? payment.risk.toLowerCase() : payment.status.toLowerCase()}: ${order.title}`, 'Stripe', order);
    }
  });
  return { received: true };
}
