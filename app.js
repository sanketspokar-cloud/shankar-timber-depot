const KEY='shankar_timber_v3';
const SYNC_KEY='G6AKebIrykiy9zY0YUtu_JFy9lrEIvfn2hRprNKGRzM';
let db=JSON.parse(localStorage.getItem(KEY)||'null')||{
 customers:[], timber:[{id:'t1',name:'Teak'},{id:'t2',name:'Saal'},{id:'t3',name:'Other'}],
 sizes:[{id:'s1',name:'8 × 12 × 2',l:8,w:12,t:2},{id:'s2',name:'10 × 12 × 2',l:10,w:12,t:2},{id:'s3',name:'12 × 10 × 2',l:12,w:10,t:2}],
 invoices:[],payments:[],suppliers:[],purchases:[],inventoryMovements:[],
 settings:{businessName:'Shankar Timber Depot',address:'',phone:'',gstRate:0,nextInvoice:1001,cloudUrl:'',cloudKey:SYNC_KEY}
};
// Migrate older V2/V3 local data without deleting anything.
db.customers=db.customers||[]; db.invoices=db.invoices||[]; db.payments=db.payments||[]; db.suppliers=db.suppliers||[]; db.purchases=db.purchases||[]; db.inventoryMovements=db.inventoryMovements||[];
db.settings=db.settings||{businessName:'Shankar Timber Depot',address:'',phone:'',gstRate:0,nextInvoice:1001,cloudUrl:'',cloudKey:SYNC_KEY};
db.settings.cloudKey=db.settings.cloudKey||SYNC_KEY;
function save(){localStorage.setItem(KEY,JSON.stringify(db))}
function cloudConfigured(){return !!(db.settings.cloudUrl&&db.settings.cloudKey)}
function cloudSync(silent=false){
  if(!cloudConfigured()){if(!silent) alert('Cloud Sync is not configured yet. Set the Google Sheets Web App URL and Sync Key in Settings.');return}
  const payload=JSON.stringify({action:'sync',key:db.settings.cloudKey,db});
  fetch(db.settings.cloudUrl,{method:'POST',mode:'no-cors',body:payload}).then(()=>{if(!silent) alert('Saved to Google Sheets. Cloud records are append-only and cannot be replaced or deleted by this app.');}).catch(()=>{if(!silent) alert('Could not sync right now. Your data is still saved on this phone. Try Sync Now later.');});
}
function cloudPull(){
  if(!cloudConfigured()){alert('Set the Google Sheets Web App URL and Sync Key in Settings first.');return}
  const cb='cloud_cb_'+Date.now();
  window[cb]=(data)=>{try{if(data&&data.ok&&data.db){
    // Pull is intentionally a local restore. It NEVER writes anything back to the cloud.
    db=data.db; db.settings=db.settings||{}; db.settings.cloudUrl=localStorage.getItem('__cloudUrl')||db.settings.cloudUrl||''; db.settings.cloudKey=localStorage.getItem('__cloudKey')||SYNC_KEY; save();
    let sales=db.invoices.reduce((a,i)=>a+i.total,0);
    alert('Cloud data loaded successfully. The Google Sheet was not changed.\n\nCustomers: '+db.customers.length+'\nBills: '+db.invoices.length+'\nPayments: '+db.payments.length+'\nSales: '+money(sales)+'\n\nShowing All Bills now.');
    closeModal(); historyDate=dateNow(); history('all');
  }else alert('Could not load cloud data.\n\n'+(data&&data.error?'Reason: '+data.error:'No response details were returned.'));}finally{delete window[cb];script.remove();}};
  localStorage.setItem('__cloudUrl',db.settings.cloudUrl); localStorage.setItem('__cloudKey',db.settings.cloudKey);
  const script=document.createElement('script');script.src=db.settings.cloudUrl+'?action=get&key='+encodeURIComponent(db.settings.cloudKey)+'&callback='+cb;
  script.onerror=()=>{if(window[cb]){delete window[cb];script.remove();alert('Cloud data could not be loaded.\n\nThe app could not even reach the Web App URL (network error or the URL/deployment is wrong). Double-check the URL in Settings.')}};
  document.body.appendChild(script);
  setTimeout(()=>{if(window[cb]){delete window[cb];script.remove();alert('Cloud data could not be loaded.\n\nThe server did not respond in time (30 seconds). This usually means the Sync Key does not match, or a temporary Google Apps Script slowdown. Try again in a minute.')}},30000);
}
function money(n){return '₹'+Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2})}
function dateNow(){return new Date().toISOString().slice(0,10)}
function home(){let ins=todayInvoices(),sales=ins.reduce((a,b)=>a+b.total,0);
app.innerHTML=`<div class="wrap"><div class="title">Welcome</div><div class="grid">
<button class="bigbtn primary" onclick="newBill()">＋<br>NEW BILL</button>
<button class="bigbtn soft" onclick="customers()">👤<br>CUSTOMERS</button>
<button class="bigbtn gold" onclick="payments()">₹<br>PAYMENTS</button>
<button class="bigbtn" onclick="history()">▣<br>HISTORY</button></div>
<div class="card"><b>Today's Summary</b><div class="row" style="margin-top:12px">
<div><div class="muted small">Bills</div><div class="title" style="margin:3px 0">${ins.length}</div></div>
<div class="right"><div class="muted small">Sales</div><div class="title" style="margin:3px 0">${money(sales)}</div></div></div></div>
<div class="card"><b>Billing Unit</b><div style="margin-top:7px"><span class="pill">CFT ONLY</span></div></div></div>`}
function todayInvoices(){return db.invoices.filter(i=>i.date===dateNow())}
function dimsFor(sizeId){let s=db.sizes.find(x=>x.id===sizeId);return s?[s.l,s.w,s.t]:[0,0,0]}
// Financial Year: 1 April to 31 March. Invoice numbers must never repeat within the same FY.
function fyRange(dateStr){let d=new Date(dateStr+'T00:00:00'),y=d.getFullYear(),m=d.getMonth()+1,fy=m>=4?y:y-1;return{start:fy+'-04-01',end:(fy+1)+'-03-31'}}
function nextInvoiceNo(billDate){
  const {start,end}=fyRange(billDate);
  const used=new Set(db.invoices.filter(i=>i.date>=start&&i.date<=end).map(i=>+i.no));
  let n=used.size?Math.max(...used)+1:(+db.settings.nextInvoice||1001);
  while(used.has(n))n++; // self-healing: skip any number already on record, even after a bad restore
  return n;
}
function cft(l,w,t,p){return (l*w*t/144)*p}
function newBill(){
app.innerHTML=`<div class="wrap"><div class="title">New Bill</div>
<div class="card"><div class="label">Customer</div><select id="cust" class="select"><option value="">Walk-in Customer</option>${db.customers.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}
</select><div class="label">Invoice Date</div><input id="bdate" class="input" type="date" value="${dateNow()}"></div>
<div class="card"><b>Timber Items</b><div id="items"></div><button class="bigbtn soft" style="width:100%;margin-top:8px" onclick="addItem()">＋ ADD TIMBER ITEM</button></div>
<div class="card"><div class="muted">Total CFT</div><div id="totalCft" class="amount">0.00 CFT</div><div class="muted">Subtotal</div><div id="subtotal" class="amount">₹0.00</div>
<div class="row"><div><div class="label">GST %</div><input id="gst" class="input" type="number" value="${db.settings.gstRate}" oninput="recalc()"></div><div><div class="label">GST Amount</div><input id="gstAmt" class="input" readonly></div></div>
<div class="label">Grand Total</div><div id="grand" class="amount">₹0.00</div></div>
<button class="bigbtn primary" style="width:100%;margin-bottom:10px" onclick="saveBill()">SAVE & PRINT BILL</button></div>`;
addItem();
}
function addItem(){
let n=document.querySelectorAll('.item').length;
let d=document.createElement('div');d.className='item';d.dataset.i=n;
d.innerHTML=`<div class="itemhead"><span>Item ${n+1}</span><button class="remove" onclick="this.closest('.item').remove();recalc()">Remove</button></div>
<div class="label">Timber</div><select class="select timber">${db.timber.map(t=>`<option value="${t.id}">${t.name}</option>`).join('')}</select>
<div class="label">Size</div><select class="select size"><option value="">Select size</option>${db.sizes.map(s=>`<option value="${s.id}">${s.name}</option>`).join('')}<option value="custom">Custom Size</option></select>
<div class="custom hidden"><div class="three"><input class="input cl" type="number" placeholder="Length ft"><input class="input cw" type="number" placeholder="Width in"><input class="input ct" type="number" placeholder="Thick in"></div></div>
<div class="ratebox"><div><div class="label">Pieces</div><input class="input pieces" type="number" min="1" value="1" inputmode="numeric"></div><div><div class="label rate-label">RATE / CFT (₹)</div><input class="input rate rate-input" type="number" min="0" value="0" inputmode="decimal" placeholder="Enter rate"></div></div>
<div class="itemresult"><span class="icft">0.00 CFT</span><span>•</span><b class="iamt">₹0.00</b></div>`;
document.getElementById('items').appendChild(d);
d.querySelectorAll('input,select').forEach(x=>x.addEventListener('input',()=>{if(x.classList.contains('size'))d.querySelector('.custom').classList.toggle('hidden',x.value!=='custom');recalc()}));
recalc()
}
function readItems(){
return [...document.querySelectorAll('.item')].map(d=>{
let sid=d.querySelector('.size').value,l,w,t;
if(sid==='custom'){l=+d.querySelector('.cl').value||0;w=+d.querySelector('.cw').value||0;t=+d.querySelector('.ct').value||0}else{[l,w,t]=dimsFor(sid)}
let p=+d.querySelector('.pieces').value||0,r=+d.querySelector('.rate').value||0,v=cft(l,w,t,p);
return {timberId:d.querySelector('.timber').value,timber:db.timber.find(x=>x.id===d.querySelector('.timber').value)?.name||'',size:`${l}×${w}×${t}`,length:l,width:w,thickness:t,pieces:p,rate:r,cft:+v.toFixed(3),amount:+(v*r).toFixed(2),id:crypto.randomUUID()}
})}
function recalc(){let arr=readItems(),tc=arr.reduce((a,x)=>a+x.cft,0),sub=arr.reduce((a,x)=>a+x.amount,0),g=+(document.getElementById('gst')?.value||0),ga=sub*g/100;
document.querySelectorAll('.item').forEach((d,i)=>{let x=arr[i];if(x){d.querySelector('.icft').textContent=x.cft.toFixed(2)+' CFT';d.querySelector('.iamt').textContent=money(x.amount)}})
if(document.getElementById('totalCft')){totalCft.textContent=tc.toFixed(2)+' CFT';subtotal.textContent=money(sub);gstAmt.value=money(ga);grand.textContent=money(sub+ga)}}
function saveBill(){
let arr=readItems();if(!arr.length||arr.some(x=>!x.length||!x.width||!x.thickness||!x.pieces||!x.rate)){alert('Complete every timber item: size, pieces and rate.');return}
let customer=db.customers.find(c=>c.id===cust.value),sub=arr.reduce((a,x)=>a+x.amount,0),gr=+(gst.value||0),ga=+(sub*gr/100).toFixed(2);
let billDate=bdate.value,no=nextInvoiceNo(billDate);
let inv={id:crypto.randomUUID(),createdAt:new Date().toISOString(),no:no,date:billDate,customerId:customer?.id||'',customer:customer?.name||'Walk-in Customer',items:arr,subtotal:+sub.toFixed(2),gstRate:gr,gstAmount:ga,total:+(sub+ga).toFixed(2)};
db.invoices.push(inv);db.settings.nextInvoice=no+1;save();cloudSync(true);printInvoice(inv)
}
function printInvoice(i){
let rows=i.items.map(x=>`<tr><td>${x.timber}</td><td>${x.size}</td><td>${x.pieces}</td><td>${x.cft.toFixed(2)}</td><td>${money(x.rate)}</td><td>${money(x.amount)}</td></tr>`).join('');
let html=`<!doctype html><html><head><title>Invoice ${i.no}</title><style>
body{font-family:Arial;margin:0;padding:35px;color:#17332e} .top{border-bottom:4px solid #123c36;padding-bottom:18px}h1{margin:0;color:#123c36;font-size:28px}.meta{display:flex;justify-content:space-between;margin-top:22px}.box{background:#f2f6f4;padding:12px;border-radius:8px}table{width:100%;border-collapse:collapse;margin-top:25px}th{background:#123c36;color:white;text-align:left}th,td{padding:11px;border:1px solid #d5dfdc}td:nth-child(n+3),th:nth-child(n+3){text-align:right}.totals{margin-left:auto;width:320px;margin-top:20px}.line{display:flex;justify-content:space-between;padding:7px}.grand{font-size:21px;font-weight:bold;border-top:2px solid #123c36;margin-top:6px;padding-top:10px}.foot{margin-top:45px;color:#667}@media print{body{padding:15px}}</style></head><body>
<div class="top"><h1>${db.settings.businessName}</h1><div>${db.settings.address||''}${db.settings.phone?' • '+db.settings.phone:''}</div></div>
<div class="meta"><div class="box"><b>Bill To</b><br>${i.customer}</div><div><b>Invoice No:</b> ${i.no}<br><b>Date:</b> ${i.date}</div></div>
<table><tr><th>Timber</th><th>Size</th><th>Pieces</th><th>CFT</th><th>Rate / CFT</th><th>Amount</th></tr>${rows}</table>
<div class="totals"><div class="line"><span>Total CFT</span><b>${i.items.reduce((a,x)=>a+x.cft,0).toFixed(2)} CFT</b></div><div class="line"><span>Subtotal</span><b>${money(i.subtotal)}</b></div><div class="line"><span>GST (${i.gstRate}%)</span><b>${money(i.gstAmount)}</b></div><div class="line grand"><span>GRAND TOTAL</span><b>${money(i.total)}</b></div></div>
<div class="foot">Thank you for your business.</div><script>window.onload=()=>window.print()<\/script></body></html>`;
let w=window.open('','_blank');w.document.write(html);w.document.close()
}
function customers(){app.innerHTML=`<div class="wrap"><div class="title">Customers</div><button class="bigbtn primary" style="width:100%;margin-bottom:13px" onclick="addCustomer()">＋ ADD CUSTOMER</button>${db.customers.length?db.customers.map(c=>{let s=db.invoices.filter(i=>i.customerId===c.id).reduce((a,i)=>a+i.total,0),p=db.payments.filter(x=>x.customerId===c.id).reduce((a,x)=>a+x.amount,0);return `<div class="card" onclick="customerDetail('${c.id}')"><div class="listrow"><div><b>${c.name}</b><div class="muted small">${c.mobile||''}</div></div><div class="right"><b>${money(s-p)}</b><div class="muted small">Balance Due</div></div></div></div>`}).join(''):'<div class="empty">No customers yet.</div>'}</div>`}
function addCustomer(){modal.innerHTML=`<div><div class="title">Add Customer</div><div class="label">Customer Name</div><div class="row" style="align-items:center"><input id="cn" class="input" style="margin:0;flex:1" autocomplete="name" placeholder="Speak or type name"><button class="voicebtn" type="button" onclick="speakCustomerName()">🎤 SPEAK</button></div><div id="voiceStatus" class="muted small" style="margin-top:7px">Tap SPEAK and say the customer name.</div><div class="label">Mobile</div><input id="cm" class="input" inputmode="tel"><button class="bigbtn primary" style="width:100%;margin-top:17px" onclick="saveCustomer()">SAVE CUSTOMER</button><button class="bigbtn" style="width:100%;margin-top:9px" onclick="closeModal()">CANCEL</button></div>`;modal.classList.remove('hidden')}
function transliterateDevanagari(text){
  if(!/[\u0900-\u097F]/.test(text)) return text;
  const independent={"अ":"a","आ":"aa","इ":"i","ई":"ee","उ":"u","ऊ":"oo","ऋ":"ri","ए":"e","ऐ":"ai","ओ":"o","औ":"au"};
  const cons={"क":"k","ख":"kh","ग":"g","घ":"gh","ङ":"ng","च":"ch","छ":"chh","ज":"j","झ":"jh","ञ":"ny","ट":"t","ठ":"th","ड":"d","ढ":"dh","ण":"n","त":"t","थ":"th","द":"d","ध":"dh","न":"n","प":"p","फ":"ph","ब":"b","भ":"bh","म":"m","य":"y","र":"r","ल":"l","व":"v","श":"sh","ष":"sh","स":"s","ह":"h","ळ":"l","क़":"q","ख़":"kh","ग़":"gh","ज़":"z","ड़":"r","ढ़":"rh","फ़":"f"};
  const matra={"ा":"aa","ि":"i","ी":"ee","ु":"u","ू":"oo","ृ":"ri","े":"e","ै":"ai","ो":"o","ौ":"au","ॅ":"e","ॉ":"o"};
  const digits={"०":"0","१":"1","२":"2","३":"3","४":"4","५":"5","६":"6","७":"7","८":"8","९":"9"};
  let out='';
  for(let i=0;i<text.length;i++){
    const ch=text[i], next=text[i+1];
    if(independent[ch]){out+=independent[ch];continue}
    if(digits[ch]){out+=digits[ch];continue}
    if(ch==='ं'){out+='n';continue} if(ch==='ः'){out+='h';continue} if(ch==='ँ'){out+='n';continue} if(ch==='ऽ'){continue}
    if(ch==='्'){continue}
    if(cons[ch]){
      let v='a';
      if(next==='्'){v=''; i++;}
      else if(matra[next]!==undefined){v=matra[next]; i++;}
      out+=cons[ch]+v; continue;
    }
    if(matra[ch]){out+=matra[ch];continue}
    out+=ch;
  }
  return out.replace(/aa/g,'a').replace(/ee/g,'i').replace(/oo/g,'u').replace(/\s+/g,' ').trim();
}
function speakCustomerName(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){alert('Voice input is not supported on this browser. Please open the app in Google Chrome on Android.');return}
  const r=new SR(); r.lang='mr-IN'; r.interimResults=false; r.maxAlternatives=1;
  const st=document.getElementById('voiceStatus'); if(st) st.textContent='Listening... Please say the customer name.';
  r.onresult=e=>{const spoken=e.results[0][0].transcript.trim(); const english=transliterateDevanagari(spoken); document.getElementById('cn').value=english; if(st) st.textContent='Name converted to English. You can edit it if needed.'};
  r.onerror=e=>{if(st) st.textContent='Could not hear clearly. Tap SPEAK and try again.'};
  r.onend=()=>{if(st && st.textContent==='Listening... Please say the customer name.') st.textContent='Tap SPEAK and try again.'};
  r.start();
}
function saveCustomer(){if(!cn.value.trim())return alert('Enter customer name');db.customers.push({id:crypto.randomUUID(),name:cn.value.trim(),mobile:cm.value.trim(),createdAt:new Date().toISOString()});save();cloudSync(true);closeModal();customers()}
function customerDetail(id){let c=db.customers.find(x=>x.id===id),s=db.invoices.filter(i=>i.customerId===id).reduce((a,i)=>a+i.total,0),p=db.payments.filter(x=>x.customerId===id).reduce((a,x)=>a+x.amount,0);
app.innerHTML=`<div class="wrap"><div class="title">${c.name}</div><div class="card"><div class="muted">Balance Due</div><div class="amount">${money(s-p)}</div><button class="bigbtn primary" style="width:100%" onclick="newPayment('${id}')">₹ RECEIVE PAYMENT</button></div><div class="card"><b>Invoices</b>${db.invoices.filter(i=>i.customerId===id).map(i=>`<div class="listrow"><span>#${i.no}<br><span class="muted small">${i.date}</span></span><b>${money(i.total)}</b></div>`).join('')||'<div class="empty">No invoices.</div>'}</div></div>`}
function payments(){app.innerHTML=`<div class="wrap"><div class="title">Payments</div><button class="bigbtn primary" style="width:100%;margin-bottom:13px" onclick="newPayment()">＋ RECEIVE PAYMENT</button>${db.payments.slice().reverse().map(p=>`<div class="card"><div class="listrow"><div><b>${p.customer}</b><div class="muted small">${p.date} • ${p.mode}</div></div><b class="success">${money(p.amount)}</b></div></div>`).join('')||'<div class="empty">No payments recorded.</div>'}</div>`}
function newPayment(id=''){modal.innerHTML=`<div><div class="title">Receive Payment</div><div class="label">Customer</div><select id="pc" class="select">${db.customers.map(c=>`<option value="${c.id}" ${c.id===id?'selected':''}>${c.name}</option>`).join('')}</select><div class="label">Amount</div><input id="pa" class="input" type="number"><div class="label">Mode</div><select id="pm" class="select"><option>Cash</option><option>UPI</option><option>Bank</option><option>Other</option></select><button class="bigbtn primary" style="width:100%;margin-top:17px" onclick="savePayment()">SAVE PAYMENT</button><button class="bigbtn" style="width:100%;margin-top:9px" onclick="closeModal()">CANCEL</button></div>`;modal.classList.remove('hidden')}
function savePayment(){let c=db.customers.find(x=>x.id===pc.value),a=+pa.value;if(!c||!a)return alert('Select customer and enter amount');db.payments.push({id:crypto.randomUUID(),customerId:c.id,customer:c.name,amount:a,mode:pm.value,date:dateNow(),createdAt:new Date().toISOString()});save();cloudSync(true);closeModal();payments()}
function today(){history('date')}
let historyDate=dateNow(), historyMode='date';
function history(mode){if(mode==='all')historyMode='all';if(mode==='date')historyMode='date';if(!historyDate)historyDate=dateNow();renderHistory()}
function historyPrev(){let d=new Date(historyDate+'T00:00:00');d.setDate(d.getDate()-1);historyDate=d.toISOString().slice(0,10);historyMode='date';renderHistory()}
function historyNext(){let d=new Date(historyDate+'T00:00:00');d.setDate(d.getDate()+1);historyDate=d.toISOString().slice(0,10);historyMode='date';renderHistory()}
function historyPick(v){if(!v)return;historyDate=v;historyMode='date';renderHistory()}
function historyAll(){historyMode='all';renderHistory()}
function historyToday(){historyDate=dateNow();historyMode='date';renderHistory()}
function historyInvoices(){let list=historyMode==='all'?db.invoices.slice():db.invoices.filter(i=>i.date===historyDate);return list.slice().sort((a,b)=>(a.date+'-'+String(a.no).padStart(8,'0')).localeCompare(b.date+'-'+String(b.no).padStart(8,'0'))).reverse()}
function historyPayments(){return historyMode==='all'?db.payments.slice():db.payments.filter(p=>p.date===historyDate)}
function renderHistory(){
let ins=historyInvoices(),pays=historyPayments(),sales=ins.reduce((a,i)=>a+i.total,0),received=pays.reduce((a,p)=>a+p.amount,0);
let label=historyMode==='all'?'All Bills':(historyDate===dateNow()?'Today':historyDate);
app.innerHTML=`<div class="wrap"><div class="title">Sales History</div>
<div class="card">
<div class="row" style="grid-template-columns:auto 1fr auto;align-items:center;gap:8px">
<button class="bigbtn soft" style="padding:14px 8px" onclick="historyPrev()">←</button>
<input type="date" class="input" style="text-align:center;padding:11px" value="${historyMode==='date'?historyDate:''}" onchange="historyPick(this.value)">
<button class="bigbtn soft" style="padding:14px 8px" onclick="historyNext()">→</button>
</div>
<div class="row" style="margin-top:10px">
<button class="bigbtn ${historyMode==='date'?'primary':'soft'}" onclick="historyToday()">TODAY</button>
<button class="bigbtn ${historyMode==='all'?'primary':'soft'}" onclick="historyAll()">ALL BILLS</button>
</div></div>
<div class="card"><b>${label}</b><div class="row" style="margin-top:12px">
<div><div class="muted small">Bills</div><div class="title" style="margin:3px 0">${ins.length}</div></div>
<div class="right"><div class="muted small">Sales</div><div class="title" style="margin:3px 0">${money(sales)}</div></div></div>
<div class="muted small" style="margin-top:8px">Payments Received</div><div class="amount" style="margin:4px 0 0;font-size:22px">${money(received)}</div></div>
<div class="card"><b>Invoices</b>${ins.length?ins.map(i=>`<div class="listrow" style="cursor:pointer" onclick="viewInvoice('${i.id}')"><span>#${i.no} • ${i.customer}<br><span class="muted small">${i.date} • ${i.items.map(x=>x.timber).join(', ')} • ${i.items.reduce((a,x)=>a+x.cft,0).toFixed(2)} CFT</span></span><b>${money(i.total)}</b></div>`).join(''):'<div class="empty">No bills for this selection.</div>'}</div></div>`}
function printInvoiceById(id){let i=db.invoices.find(x=>x.id===id);if(i)printInvoice(i)}
function viewInvoice(id){let i=db.invoices.find(x=>x.id===id);if(!i)return;
let rows=i.items.map(x=>`<div class="listrow"><span>${x.timber} • ${x.size}<br><span class="muted small">${x.pieces} pcs • ${x.cft.toFixed(2)} CFT</span></span><b>${money(x.amount)}</b></div>`).join('');
modal.innerHTML=`<div><div class="title">Invoice #${i.no}</div><div class="muted small">${i.date} • ${i.customer}</div><div class="card" style="margin-top:14px">${rows}<div class="listrow"><b>Grand Total</b><b>${money(i.total)}</b></div></div>
<button class="bigbtn primary" style="width:100%;margin-top:10px" onclick="printInvoiceById('${i.id}')">🖨 PRINT INVOICE</button>
<button class="bigbtn" style="width:100%;margin-top:9px" onclick="closeModal()">CLOSE</button></div>`;
modal.classList.remove('hidden')}
function settings(){modal.innerHTML=`<div><div class="title">Settings</div><div class="label">Business Name</div><input id="bn" class="input" value="${db.settings.businessName}"><div class="label">Address</div><input id="ba" class="input" value="${db.settings.address}"><div class="label">Phone</div><input id="bp" class="input" value="${db.settings.phone}"><div class="label">Default GST %</div><input id="bg" class="input" type="number" value="${db.settings.gstRate}"><div class="label">Invoice Start Number</div><div class="muted small" style="margin:-4px 0 6px">Used only when a new Financial Year (1 Apr) has no bills yet. Numbers already used this FY are never reused.</div><input id="binv" class="input" type="number" value="${db.settings.nextInvoice}"><div class="cloudtitle">☁️ Google Sheets Sync</div><div class="muted small">One-time setup. Your bills and customers can then be backed up to Google Sheets.</div><div class="label">Google Sheets Web App URL</div><input id="cu" class="input" value="${db.settings.cloudUrl||''}" placeholder="Paste your Web App URL"><div class="label">Sync Key</div><input id="ck" class="input" value="${db.settings.cloudKey||''}" placeholder="Paste your Sync Key" autocomplete="off"><button class="bigbtn primary" style="width:100%;margin-top:17px" onclick="saveSettings()">SAVE SETTINGS</button><button class="bigbtn soft" style="width:100%;margin-top:9px" onclick="cloudSync(false)">☁️ SYNC NOW</button><button class="bigbtn soft" style="width:100%;margin-top:9px" onclick="cloudPull()">☁️ LOAD FROM GOOGLE SHEETS</button><button class="bigbtn soft" style="width:100%;margin-top:9px" onclick="exportCSV()">📥 EXPORT SALES CSV</button><button class="bigbtn soft" style="width:100%;margin-top:9px" onclick="backup()">💾 BACKUP JSON</button><button class="bigbtn danger" style="width:100%;margin-top:9px" onclick="resetData()">RESET ALL DATA</button><button class="bigbtn" style="width:100%;margin-top:9px" onclick="closeModal()">CLOSE</button></div>`;modal.classList.remove('hidden')}
function saveSettings(){db.settings.businessName=bn.value;db.settings.address=ba.value;db.settings.phone=bp.value;db.settings.gstRate=+bg.value||0;db.settings.nextInvoice=+binv.value||1001;db.settings.cloudUrl=cu.value.trim();db.settings.cloudKey=ck.value.trim();save();if(cloudConfigured())cloudSync(true);closeModal();home()}
function exportCSV(){let rows=[['Invoice Date','Invoice No','Customer','Timber','Size','Length ft','Width in','Thickness in','Pieces','CFT','Rate/CFT','Amount','GST Rate','GST Amount','Grand Total']];db.invoices.forEach(i=>i.items.forEach(x=>rows.push([i.date,i.no,i.customer,x.timber,x.size,x.length,x.width,x.thickness,x.pieces,x.cft,x.rate,x.amount,i.gstRate,i.gstAmount,i.total])));download('Shankar_Timber_Depot_Sales.csv',rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n'),'text/csv')}
function backup(){download('Shankar_Timber_Depot_Backup.json',JSON.stringify(db,null,2),'application/json')}
function download(n,d,t){let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([d],{type:t}));a.download=n;a.click()}
function closeModal(){modal.classList.add('hidden');modal.innerHTML=''}
function resetData(){if(confirm('This clears ONLY data stored on this phone. Google Sheets cloud data will NOT be deleted or changed. Continue?')){localStorage.removeItem(KEY);localStorage.removeItem('__cloudUrl');localStorage.removeItem('__cloudKey');location.reload()}}
home();