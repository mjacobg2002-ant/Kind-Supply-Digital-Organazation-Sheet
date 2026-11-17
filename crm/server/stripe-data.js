import { audit, newRecord, runWorkflows, updateState } from './model.js';
import { reject } from './security.js';

const rid = item => typeof item==='string' ? item : item?.id;
const iso = stamp => stamp ? new Date(stamp*1000).toISOString() : null;
export function monthlyAmount(subscription,currency='usd') {
  return Math.round((subscription.items?.data ?? []).reduce((sum,item)=>{
    const recurring=item.price?.recurring;
    if (!recurring || recurring.usage_type==='metered' || item.price?.currency!==currency) return sum;
    const count=recurring.interval_count || 1;
    const divisor={month:count,year:12*count,week:count*12/52,day:count*12/365}[recurring.interval];
    if (!divisor) return sum;
    return sum+Number(item.price.unit_amount_decimal ?? item.price.unit_amount ?? 0)*(item.quantity ?? 1)/divisor;
  },0));
}
function context(state,object,kind) {
  const customerId=rid(object.customer);
  const order=state.payments.find(row=>row.subscriptionId===object.id || (object.metadata?.payment && row.id===object.metadata.payment));
  const customerEmail=object.customer_email || object.billing_details?.email;
  const contacts=state.contacts.filter(row=>(customerId && row.stripeCustomerId===customerId) || (customerEmail && row.email===customerEmail.toLowerCase()));
  const contact=contacts.length===1 ? contacts[0] : null;
  return {
    customerId, contactId:order?.contactId || contact?.id || '', dealId:order?.dealId || '',
    title:order?.title || contact?.company || object.customer_name || object.billing_details?.name || customerEmail
      || (kind==='subscription' && object.items?.data?.[0]?.price?.nickname) || customerId || object.id
  };
}

export function importStripeObject(state,kind,object) {
  const related=context(state,object,kind);
  if (kind==='subscription') {
    const prior=state.subscriptions.find(row=>row.id===object.id);
    const items=object.items?.data ?? [];
    const currency=items[0]?.price?.currency || 'usd';
    const row={
      ...related,id:object.id,status:object.status,mrr:monthlyAmount(object,currency),amount:monthlyAmount(object,currency),
      currency,
      cancelAtPeriodEnd:Boolean(object.cancel_at_period_end),currentPeriodEnd:iso(items[0]?.current_period_end || object.current_period_end),
      createdAt:iso(object.created),syncedAt:new Date().toISOString(),
      mrrIncomplete:items.some(item=>item.price?.currency==='usd' && (!item.price.recurring || item.price.recurring.usage_type==='metered' || item.price.billing_scheme==='tiered'))
    };
    if (prior) Object.assign(prior,row,{contactId:prior.contactId || row.contactId,dealId:prior.dealId || row.dealId,title:prior.dealId ? prior.title : row.title});
    else {
      if (state.subscriptions.length>=5000) reject(409,'The subscription record limit has been reached.');
      state.subscriptions.unshift(row);
    }
    return prior || row;
  }
  let fields;
  let prior;
  if (kind==='invoice') {
    prior=state.payments.find(row=>row.invoiceId===object.id);
    const status=({paid:'Paid',void:'Voided',uncollectible:'Uncollectible',draft:'Draft'})[object.status] || (object.attempted ? 'Payment failed' : 'Open');
    fields={
      ...related,mode:'invoice',invoiceId:object.id,amount:object.amount_due || 0,collectedAmount:object.amount_paid || 0,
      outstandingAmount:object.amount_remaining ?? Math.max(0,(object.amount_due || 0)-(object.amount_paid || 0)),currency:object.currency,
      status,invoiceUrl:object.hosted_invoice_url || '',attemptCount:object.attempt_count || 0,
      nextAttemptAt:iso(object.next_payment_attempt),dueAt:iso(object.due_date),paidAt:iso(object.status_transitions?.paid_at),
      paymentIntents:(object.payments?.data ?? []).map(item=>rid(item.payment?.payment_intent)).filter(Boolean),
      subscriptionId:rid(object.parent?.subscription_details?.subscription || object.subscription),createdAt:iso(object.created)
    };
  } else {
    const intent=rid(object.payment_intent);
    prior=state.payments.find(row=>row.chargeId===object.id)
      || state.payments.find(row=>row.mode==='payment' && intent && row.paymentIntent===intent);
    const collected=object.status==='succeeded' ? object.amount_captured ?? object.amount ?? 0 : 0;
    const refunds=(object.refunds?.data ?? prior?.refunds ?? []).map(row=>({id:row.id,amount:row.amount,at:row.at || iso(row.created),status:row.status}));
    fields={
      ...related,mode:'charge',chargeId:object.id,paymentIntent:intent,amount:object.amount,collectedAmount:collected,
      refunded:object.amount_refunded || 0,refunds,currency:object.currency,createdAt:iso(object.created),
      paidAt:object.status==='succeeded' ? iso(object.created) : null,
      status:object.refunded ? 'Refunded' : object.amount_refunded ? 'Partially refunded'
        : object.status==='succeeded' ? 'Paid' : object.status==='pending' ? 'Pending' : 'Failed',
      failure:(object.failure_message || '').slice(0,400),failureCode:object.failure_code || '',invoiceId:rid(object.invoice),
      receiptUrl:object.receipt_url || '',risk:object.disputed ? 'Dispute opened' : prior?.risk || ''
    };
  }
  const row={...fields,syncedAt:new Date().toISOString()};
  if (prior) Object.assign(prior,row,{contactId:prior.contactId || row.contactId,dealId:prior.dealId || row.dealId,title:prior.dealId ? prior.title : row.title});
  else {
    if (state.payments.length>=5000) reject(409,'The payment record limit has been reached.');
    state.payments.unshift(newRecord(row));
  }
  return prior || state.payments[0];
}

async function withRefunds(object,stripe) {
  if (!object.refunds?.has_more) return object;
  const refunds=[];
  for await (const refund of stripe.refunds.list({charge:object.id,limit:100})) refunds.push(refund);
  return {...object,refunds:{data:refunds,has_more:false}};
}

export async function importStripePage(db,workspace,user,input,stripe) {
  if (!['subscriptions','invoices','charges'].includes(input.kind)) reject(400,'Select a Stripe resource to import.');
  if (input.cursor && (typeof input.cursor!=='string' || !/^[a-zA-Z0-9_]{1,100}$/.test(input.cursor))) reject(400,'Invalid Stripe import cursor.');
  const params={limit:100,...(input.cursor && {starting_after:input.cursor})};
  if (input.kind==='subscriptions') params.status='all';
  if (input.kind==='invoices') params.expand=['data.payments'];
  if (input.kind==='charges') params.expand=['data.refunds'];
  const page=await stripe[input.kind].list(params);
  if (input.kind==='charges') page.data=await Promise.all(page.data.map(item=>withRefunds(item,stripe)));
  return updateState(db,workspace,state=>{
    for (const item of page.data) importStripeObject(state,({subscriptions:'subscription',invoices:'invoice',charges:'charge'})[input.kind],item);
    state.billingSync ??= {};
    state.billingSync[input.kind]={at:new Date().toISOString(),complete:!page.has_more};
    if (!page.has_more) audit(state,'Synced Stripe '+input.kind,user.name);
    return {imported:page.data.length,cursor:page.has_more ? page.data.at(-1)?.id : '',complete:!page.has_more};
  },user.id,['owner','admin']);
}

export async function applyStripeResourceEvent(db,workspace,event,stripe) {
  const type=event.type;
  let object=event.data.object;
  let kind;
  let risk='';
  if (type.startsWith('customer.subscription.')) {
    kind='subscription';object=await stripe.subscriptions.retrieve(object.id);
  } else if (type.startsWith('invoice.')) {
    kind='invoice';object=await stripe.invoices.retrieve(object.id,{expand:['payments']});
  } else if (type.startsWith('charge.dispute.') || type.startsWith('radar.')) {
    kind='charge';risk=type.startsWith('radar.') ? 'Fraud warning' : 'Dispute opened';
    object=await stripe.charges.retrieve(rid(object.charge));
  } else if (type.startsWith('charge.')) {
    kind='charge';object=await stripe.charges.retrieve(object.id);
  } else if (type==='payment_intent.payment_failed') {
    if (!object.latest_charge) return;
    kind='charge';object=await stripe.charges.retrieve(rid(object.latest_charge));
  } else return;
  if (kind==='charge') object=await withRefunds(object,stripe);
  await updateState(db,workspace,async (state,tx)=>{
    const seen=await tx.query("INSERT INTO crm_provider_events(provider,id) VALUES ('stripe',$1) ON CONFLICT DO NOTHING RETURNING id",[event.id]);
    if (!seen.rows.length) return;
    const previous=kind==='invoice' ? state.payments.find(row=>row.invoiceId===object.id) : null;
    const alreadyPaid=previous?.status==='Paid';
    const row=importStripeObject(state,kind,object);
    if (risk) row.risk=risk;
    audit(state,`Stripe ${risk || row.status}: ${row.title}`,'Stripe',row);
    if (kind==='invoice' && row.status==='Paid' && !alreadyPaid && row.contactId) runWorkflows(state,'Payment received',row);
    state.billingSync ??= {};
    state.billingSync.lastWebhook=new Date().toISOString();
  });
}
