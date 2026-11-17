const paidStatuses = new Set(['Paid','Refunded','Partially refunded']);
const paymentLinks = row => [row.paymentIntent, ...(row.paymentIntents || [])].filter(Boolean);
const sharesPayment = (left,right) => paymentLinks(left).some(id=>paymentLinks(right).includes(id));
const value = amount => Number.isFinite(Number(amount)) ? Number(amount) : 0;

export function receivedPayments(payments) {
  const charges = payments.filter(row=>row.mode === 'charge');
  const invoices = payments.filter(row=>row.mode === 'invoice');
  return payments.filter(row=>{
    if (!paidStatuses.has(row.status) || row.currency !== 'usd' || row.mode === 'subscription') return false;
    if (row.mode === 'charge') return true;
    if (row.mode === 'invoice') return !charges.some(charge=>(charge.invoiceId && charge.invoiceId === row.invoiceId) || (charge.paymentIntent && row.paymentIntents?.includes(charge.paymentIntent)));
    return !charges.some(charge=>(charge.paymentIntent && charge.paymentIntent === row.paymentIntent))
      && !invoices.some(invoice=>sharesPayment(invoice,row));
  });
}

export function financialMetrics(state, period = 'month', today = new Date(), timezone = 'America/New_York') {
  const localDate = new Intl.DateTimeFormat('sv-SE',{timeZone:timezone}).format(today);
  const month = localDate.slice(0,7);
  const start = period === 'all' ? '' : period === 'month' ? month+'-01'
    : new Date(Date.parse(localDate+'T12:00:00Z')-Number(period)*86400000).toISOString().slice(0,10);
  const inPeriod = stamp => {
    if (!stamp || !Number.isFinite(Date.parse(stamp))) return false;
    const date = new Intl.DateTimeFormat('sv-SE',{timeZone:timezone}).format(new Date(stamp));
    return (!start || date>=start) && date<=localDate;
  };
  const cash = receivedPayments(state.payments);
  const receipts = cash.filter(row=>inPeriod(row.paidAt || row.createdAt));
  const gross = receipts.reduce((sum,row)=>sum+value(row.collectedAmount ?? row.amount),0);
  let refunded = 0;
  for (const row of cash) {
    if (row.refunds?.length) refunded += row.refunds.filter(refund=>refund.status==='succeeded' && inPeriod(refund.at)).reduce((sum,refund)=>sum+value(refund.amount),0);
    else if (row.refunded && inPeriod(row.refundedAt || row.paidAt || row.createdAt)) refunded += value(row.refunded);
  }
  const subscriptions = state.subscriptions.filter(row=>row.currency ? row.currency==='usd' : true);
  const billable = subscriptions.filter(row=>['active','past_due'].includes(row.status));
  const mrr = billable.reduce((sum,row)=>sum+value(row.mrr ?? row.amount),0);
  const atRiskMrr = billable.filter(row=>row.status==='past_due').reduce((sum,row)=>sum+value(row.mrr ?? row.amount),0);
  const failed = state.payments.filter(row=>row.currency==='usd'
    && ['Failed','Payment failed'].includes(row.status) && (row.invoiceId || row.chargeId || row.mode==='intent')
    && !state.payments.some(paid=>paidStatuses.has(paid.status) && sharesPayment(row,paid) && paid.id!==row.id));
  const failedUnique = failed.filter((row,index)=>!failed.slice(0,index).some(prior=>(row.invoiceId && prior.invoiceId===row.invoiceId) || sharesPayment(row,prior)));
  const overdue = state.payments.filter(row=>row.mode==='invoice' && row.currency==='usd' && ['Open','Payment failed','Uncollectible'].includes(row.status)
    && (row.status!=='Open' || (row.dueAt && Date.parse(row.dueAt)<today.getTime())));
  const outstanding = state.payments.filter(row=>row.mode==='invoice' && row.currency==='usd' && ['Open','Payment failed'].includes(row.status))
    .reduce((sum,row)=>sum+value(row.outstandingAmount ?? row.amount),0);
  const months = Array.from({length:6},(_,index)=>{
    const cursor = new Date(month+'-15T12:00:00Z');
    cursor.setUTCMonth(cursor.getUTCMonth()-5+index);
    const id = cursor.toISOString().slice(0,7);
    const amount = cash.filter(row=>{
      const at=row.paidAt || row.createdAt;
      return at && new Intl.DateTimeFormat('sv-SE',{timeZone:timezone}).format(new Date(at)).startsWith(id);
    }).reduce((sum,row)=>sum+value(row.collectedAmount ?? row.amount),0);
    return {id,label:new Intl.DateTimeFormat('en-US',{month:'short',timeZone:'UTC'}).format(cursor),amount};
  });
  return {gross,refunded,net:gross-refunded,mrr,arr:mrr*12,atRiskMrr,receipts,failed:failedUnique,overdue,
    failedAmount:failedUnique.reduce((sum,row)=>sum+value(row.outstandingAmount ?? row.amount),0),
    outstanding,activeSubscriptions:billable.length,months,period};
}
