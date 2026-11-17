const headers = {
  company:['practice','practice name','company','company name','business','business name','organization'],
  name:['contact','contact name','doctor','dentist','name','decision maker'],
  email:['email','email address','practice email','contact email'],
  phone:['phone','phone number','telephone','contact phone'],
  city:['city','location'], region:['region','market','state'],
  website:['website','website url','url','site'], websiteStatus:['website status','site status'],
  notes:['notes','objections','comments'], tags:['tags'], followUp:['follow up','followup','next follow up','follow up date']
};

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let endedQuote = false;
  const endField = () => { row.push(field.trim()); field = ''; endedQuote = false; };
  const endRow = () => { endField(); if (row.some(Boolean)) rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i+1] === '"') { field += '"'; i++; }
      else if (char === '"') { quoted = false; endedQuote = true; }
      else field += char;
    } else if (char === ',' || char === '\n' || char === '\r') {
      if (char === ',') endField();
      else { endRow(); if (char === '\r' && text[i+1] === '\n') i++; }
    } else if (char === '"' && !field && !endedQuote) quoted = true;
    else if (char !== '\uFEFF') {
      if (endedQuote && char.trim()) throw new Error('A quoted CSV field has extra characters after its closing quote.');
      field += char;
    }
  }
  if (quoted) throw new Error('A quoted CSV field is missing its closing quote.');
  if (row.length || field) endRow();
  if (rows.length < 2) throw new Error('Include a header row and at least one contact.');
  const columns = rows.shift().map(value => value.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]+/g,' ').toLowerCase().trim());
  const mapping = Object.fromEntries(Object.entries(headers).map(([key, choices]) => [key, columns.findIndex(title => choices.includes(title))]));
  if (mapping.company === -1) throw new Error('Include a Practice, Company, or Business Name column.');
  return rows.map(row => {
    const item = Object.fromEntries(Object.entries(mapping).filter(([, index]) => index >= 0).map(([key,index]) => [key,row[index] ?? '']));
    if (/^'\+\d+$/.test(item.phone ?? '')) item.phone = item.phone.slice(1);
    const region = (item.region ?? '').toLowerCase();
    if (region) {
      if (['va','nova','virginia','northern va','northern virginia'].includes(region)) item.region = 'Northern Virginia';
      else if (['washington dc','washington, dc','dc','d.c.','washington'].includes(region)) item.region = 'Washington, DC';
      else if (['md','maryland'].includes(region)) item.region = 'Maryland';
      else if (['fl','florida'].includes(region)) item.region = 'Florida';
      else item.region = 'Other';
    }
    const status = (item.websiteStatus ?? '').toLowerCase();
    if (status) item.websiteStatus = ['Unknown','Working','Needs improvement','Broken','No website'].find(value => value.toLowerCase() === status) ?? 'Unknown';
    if (item.website && !/^[a-z]+:\/\//i.test(item.website)) item.website = 'https://' + item.website;
    return item;
  });
}

export function contactsCsv(contacts) {
  const fields = ['company','name','email','phone','city','region','website','websiteStatus','source','tags','followUp','notes'];
  const quote = value => {
    const raw = Array.isArray(value) ? value.join(', ') : String(value ?? '');
    const safe = /^[\t\r\n]|^\s*[=+@-]/.test(raw) ? "'" + raw : raw;
    return '"' + safe.replaceAll('"','""') + '"';
  };
  return [fields.join(','), ...contacts.map(row => fields.map(key => quote(row[key])).join(','))].join('\r\n');
}
