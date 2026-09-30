'use strict';
const {cuisines,areas}=window.DATA;
const state={cuisine:cuisines.indexOf('Caribbean'),metric:'share'};
const $=id=>document.getElementById(id);
const pct=n=>`${n.toFixed(1)}%`;
const num=n=>n.toLocaleString('en-US');
const share=(a,c)=>a.counts[c]/a.total*100;
const value=(a,c)=>state.metric==='share'?share(a,c):a.counts[c];
const format=n=>state.metric==='share'?pct(n):num(n);
const sortAreas=()=>[...areas].sort((a,b)=>value(b,state.cuisine)-value(a,state.cuisine)||a.name.localeCompare(b.name));
const maxShare=Math.max(...areas.flatMap(a=>a.counts.map((_,c)=>share(a,c))));
const maxCount=Math.max(...areas.flatMap(a=>a.counts));

// Brooklyn-wide baseline calculations
const boroughTotal=window.DATA.borough.total;
const boroughCounts=window.DATA.borough.counts;
const boroughShares=cuisines.map((_,c)=>(boroughCounts[c]/boroughTotal)*100);

const rows=new Map(); let activeCell=null;
let hoveredCol=-1; let hoveredRow=null;

function el(tag,text,cls){
  const e=document.createElement(tag);
  if(text!==undefined)e.textContent=text;
  if(cls)e.className=cls;
  return e;
}

function setCrosshair(a,c){
  clearCrosshair();
  hoveredCol=c;
  hoveredRow=rows.get(a);
  const colHeader=header.children[c+1];
  if(colHeader)colHeader.classList.add('col-hover');
  if(hoveredRow)hoveredRow.classList.add('row-hover');
}

function clearCrosshair(){
  if(hoveredCol!==-1&&header.children[hoveredCol+1]){
    header.children[hoveredCol+1].classList.remove('col-hover');
  }
  if(hoveredRow){
    hoveredRow.classList.remove('row-hover');
  }
  hoveredCol=-1;
  hoveredRow=null;
}

cuisines.forEach((c,i)=>{
  const option=el('option',c);
  option.value=i;
  $('cuisine').append(option);
});

const header=el('tr');
header.append(el('th','ZIP-BASED AREA'));
cuisines.forEach((c,i)=>{
  const th=el('th');
  th.scope='col';
  const b=el('button',c);
  b.type='button';
  b.title=`Rank areas by ${c}`;
  b.addEventListener('click',()=>setState(i,state.metric));
  th.append(b);
  header.append(th);
});
$('matrix').querySelector('thead').append(header);

areas.forEach(a=>{
  const tr=el('tr');
  const label=el('th',a.name);
  label.scope='row';
  label.append(el('small',`${a.zips.join(', ')} · n = ${num(a.total)}`));
  label.title=`Click to view ${a.name} cuisine profile`;
  label.tabIndex=0;
  label.setAttribute('role','button');
  label.setAttribute('aria-label',`View ${a.name} cuisine profile`);
  label.addEventListener('click',()=>showAreaDNA(a,state.cuisine));
  label.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showAreaDNA(a,state.cuisine);}});
  tr.append(label);

  a.counts.forEach((count,c)=>{
    const td=el('td');
    const b=el('button');
    b.type='button';
    b.tabIndex=-1;
    b.setAttribute('aria-label',`${a.name}, ${cuisines[c]}: ${pct(share(a,c))}, ${count} of ${a.total} restaurants`);
    b.addEventListener('mouseenter',()=>{inspect(a,c);setCrosshair(a,c);});
    b.addEventListener('mouseleave',clearCrosshair);
    b.addEventListener('focus',()=>{
      if(activeCell)activeCell.tabIndex=-1;
      activeCell=b;
      b.tabIndex=0;
      inspect(a,c);
      setCrosshair(a,c);
    });
    b.addEventListener('blur',clearCrosshair);
    b.addEventListener('click',()=>{inspect(a,c);setCrosshair(a,c);});
    b.addEventListener('keydown',e=>{
      const dirs={ArrowRight:[0,1],ArrowLeft:[0,-1],ArrowDown:[1,0],ArrowUp:[-1,0]};
      if(!dirs[e.key])return;
      e.preventDefault();
      const order=sortAreas(),r=order.indexOf(a),[dr,dc]=dirs[e.key];
      const next=rows.get(order[Math.max(0,Math.min(order.length-1,r+dr))]);
      next.children[Math.max(0,Math.min(cuisines.length-1,c+dc))+1].firstChild.focus();
    });
    td.append(b);
    tr.append(td);
  });
  rows.set(a,tr);
});

function inspect(a,c){
  window.dispatchEvent(new CustomEvent('spotlight:inspect',{detail:{area:a,cuisine:c}}));
  rows.forEach((r,x)=>r.classList.toggle('linked',x===a));
  const box=$('detail');
  const localShare=share(a,c);
  const bShare=boroughShares[c];
  const ratio=bShare>0?(localShare/bShare):1;
  const rank=1+areas.filter(other=>value(other,c)>value(a,c)).length;
  const tied=areas.filter(other=>value(other,c)===value(a,c)).length>1;

  let badgeText='';
  let badgeClass='neutral';
  if(localShare===0){
    badgeText=`0 restaurants in area · Borough avg: ${pct(bShare)}`;
    badgeClass='neutral';
  }else if(ratio>=2.0){
    badgeText=`${ratio.toFixed(1)}× Brooklyn share (${pct(bShare)}) · Higher local share`;
    badgeClass='specialty';
  }else if(ratio>=1.2){
    badgeText=`▲ +${Math.round((ratio-1)*100)}% above borough avg (${pct(bShare)})`;
    badgeClass='above';
  }else if(ratio<=0.8){
    badgeText=`▼ ${Math.round((1-ratio)*100)}% below borough avg (${pct(bShare)})`;
    badgeClass='below';
  }else{
    badgeText=`≈ On par with borough avg (${pct(bShare)})`;
    badgeClass='neutral';
  }

  box.replaceChildren(
    el('span','CELL DETAILS','eyebrow'),
    el('h3',a.name),
    el('p',`${cuisines[c]} · ZIP ${a.zips.join(', ')}`),
    el('span',`${tied?'Tied rank':'Rank'} #${rank} of ${areas.length} areas in ${cuisines[c]} (${state.metric==='share'?'by share':'by count'})`,'rank-badge')
  );

  const ns=el('div',undefined,'numbers');
  [[pct(localShare),'share of area'],[num(a.counts[c]),'restaurants']].forEach(([v,l])=>{
    const d=el('div');
    d.append(el('strong',v),el('span',l));
    ns.append(d);
  });
  box.append(ns);

  const badge=el('div',badgeText,`benchmark-badge ${badgeClass}`);
  box.append(badge);
  const difference=localShare-bShare;
  box.append(el('p',`${Math.abs(difference).toFixed(1)} percentage points ${difference>=0?'above':'below'} Brooklyn’s share. Benchmark: ${num(boroughCounts[c])} of ${num(boroughTotal)} cleaned Brooklyn restaurants. Ratios describe concentration, not statistical significance.`));

  box.append(el('p',`Out of ${num(a.total)} restaurants in this area.`));
  if(cuisines[c]==='Other'){
    box.append(el('p','Other combines cuisines below the EDA’s 71-restaurant threshold.'));
  }

  const dnaBtn=el('button','View top five cuisines','btn-dna-toggle');
  dnaBtn.type='button';
  dnaBtn.addEventListener('click',()=>showAreaDNA(a,c));
  box.append(dnaBtn);
}

function showAreaDNA(a,originCuisine=state.cuisine){
  rows.forEach((r,x)=>r.classList.toggle('linked',x===a));
  const box=$('detail');
  box.replaceChildren(
    el('span','AREA PROFILE · TOP FIVE CUISINES','eyebrow'),
    el('h3',a.name),
    el('p',`ZIP ${a.zips.join(', ')} · ${num(a.total)} total restaurants`)
  );

  const backBtn=el('button','← Back to cell details','btn-back-cell');
  backBtn.type='button';
  backBtn.addEventListener('click',()=>inspect(a,originCuisine));
  box.append(backBtn);

  const ranked=cuisines.map((cName,idx)=>({
    name:cName,
    idx:idx,
    count:a.counts[idx],
    share:share(a,idx)
  })).sort((x,y)=>y.share-x.share);

  const dnaList=el('div',undefined,'dna-list');
  ranked.slice(0,5).forEach((item,rankIdx)=>{
    const itemWrap=el('div',undefined,'dna-item');
    const rowHead=el('div',undefined,'dna-row');
    rowHead.append(
      el('strong',`${rankIdx+1}. ${item.name}`),
      el('span',`${pct(item.share)} (${num(item.count)})`)
    );
    const track=el('div',undefined,'dna-track');
    const bar=el('div',undefined,'dna-bar');
    bar.style.width=`${(item.share/ranked[0].share)*100}%`;
    track.append(bar);

    const spotBtn=el('button',`Spotlight ${item.name}`,'dna-btn-spotlight');
    spotBtn.type='button';
    spotBtn.addEventListener('click',()=>{
      setState(item.idx,state.metric);
      highlightArea(a);
    });

    itemWrap.append(rowHead,track,spotBtn);
    dnaList.append(itemWrap);
  });
  box.append(dnaList);
}

function highlightArea(a){
  if(window.mapExplorer?.isActive()){window.mapExplorer.selectArea(a);return;}
  const row=rows.get(a);
  if(!row)return;
  row.getAnimations().forEach(animation=>animation.cancel());
  const scroller=document.querySelector('.matrix-scroll');
  const cell=row.children[state.cuisine+1];
  scroller.scrollTop+=row.getBoundingClientRect().top-scroller.getBoundingClientRect().top-scroller.clientHeight/2;
  scroller.scrollLeft+=cell.getBoundingClientRect().left-scroller.getBoundingClientRect().left-row.firstChild.getBoundingClientRect().width;
  row.classList.add('search-highlight');
  setTimeout(()=>row.classList.remove('search-highlight'),2600);
  inspect(a,state.cuisine);
  const cellBtn=row.children[state.cuisine+1]?.firstChild;
  if(cellBtn){
    if(activeCell)activeCell.tabIndex=-1;
    activeCell=cellBtn;
    cellBtn.tabIndex=0;
    cellBtn.focus({preventScroll:true});
  }
}


function render(animate=true){
  rows.forEach(row=>row.getAnimations().forEach(a=>a.cancel()));
  const tbody=$('matrix').querySelector('tbody');
  const before=new Map([...rows].map(([a,r])=>[a,r.getBoundingClientRect().top]));
  const ordered=sortAreas();
  const max=state.metric==='share'?maxShare:maxCount;

  ordered.forEach(a=>{
    const row=rows.get(a);
    a.counts.forEach((n,c)=>{
      const td=row.children[c+1],b=td.firstChild,v=value(a,c),t=v/max;
      td.classList.toggle('active',c===state.cuisine);
      const start=[238,246,244],end=[8,105,94];
      b.style.setProperty('--cell',`rgb(${start.map((x,i)=>Math.round(x+(end[i]-x)*t)).join(',')})`);
      b.style.setProperty('--ink',t>.58?'#fff':'#214842');
      b.textContent=c===state.cuisine?format(v):'';
    });
    tbody.append(row);
  });

  if(animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
    rows.forEach((row,a)=>{
      const delta=before.get(a)-row.getBoundingClientRect().top;
      if(delta)row.animate([{transform:`translateY(${delta}px)`},{transform:'translateY(0)'}],{duration:420,easing:'cubic-bezier(.2,.7,.2,1)'});
    });
  }

  [...header.children].slice(1).forEach((h,c)=>{
    h.classList.toggle('active',c===state.cuisine);
    h.setAttribute('aria-sort',c===state.cuisine?'descending':'none');
    h.firstChild.setAttribute('aria-pressed',String(c===state.cuisine));
  });

  $('cuisine').value=state.cuisine;
  ['share','count'].forEach(m=>$(m).setAttribute('aria-pressed',String(m===state.metric)));

  const first=ordered[0],c=cuisines[state.cuisine];
  $('headline').textContent=state.metric==='share'?`${c} accounts for ${pct(share(first,state.cuisine))} of restaurants in ${first.name}.`:`${first.name} leads with ${num(first.counts[state.cuisine])} ${c} restaurants.`;
  const shareLeader=[...areas].sort((a,b)=>share(b,state.cuisine)-share(a,state.cuisine)||a.name.localeCompare(b.name))[0];
  const countLeader=[...areas].sort((a,b)=>b.counts[state.cuisine]-a.counts[state.cuisine]||a.name.localeCompare(b.name))[0];
  $('summary').textContent=state.metric==='share'?`${num(first.counts[state.cuisine])} of ${num(first.total)} restaurants in this area. Switch to count to see where there are the most venues.`:`That is ${pct(share(first,state.cuisine))} of its ${num(first.total)} restaurants. ${shareLeader===countLeader?'This area also leads by share.':`${shareLeader.name} leads by share at ${pct(share(shareLeader,state.cuisine))}.`}`;
  if(c==='Other')$('summary').textContent+=' Other is a collection of smaller cuisine categories.';

  $('legend-label').textContent=state.metric==='share'?'Share of restaurants in each area':'Number of restaurants per cell';
  $('legend-max').textContent=format(max);
  $('ranking-title').textContent=`Top 5 · ${c}`;
  $('ranking-note').textContent=state.metric==='share'?'Ranked by share of local restaurants':'Ranked by number of restaurants';

  $('leaders').replaceChildren();
  ordered.slice(0,5).forEach((a,i)=>{
    const li=el('li'),label=el('button',undefined,'leader-label');
    label.type='button';
    label.addEventListener('click',()=>highlightArea(a));
    label.append(el('span',`${i+1}. ${a.name}`),el('b',format(value(a,state.cuisine))));
    const track=el('div',undefined,'track'),bar=el('div',undefined,'bar');
    bar.style.width=`${value(first,state.cuisine)?value(a,state.cuisine)/value(first,state.cuisine)*100:0}%`;
    track.append(bar);
    li.append(label,track);
    $('leaders').append(li);
  });

  if(!activeCell){
    activeCell=rows.get(first).children[state.cuisine+1].firstChild;
    activeCell.tabIndex=0;
  }
  inspect(first,state.cuisine);
  window.dispatchEvent(new Event('spotlight:render'));
}

function setState(c,m){
  if(!Number.isInteger(c)||c<0||c>=cuisines.length||!['share','count'].includes(m))throw new Error('Choose a valid cuisine and metric.');
  state.cuisine=c;
  state.metric=m;
  render();
}

// Search functionality
const searchInput=$('search-input');
const searchClear=$('search-clear');
const searchDropdown=$('search-dropdown');

if(searchInput){
  const doSearch=()=>{
    const q=searchInput.value.trim().toLowerCase();
    if(!q){
      searchClear.hidden=true;
      searchDropdown.hidden=true;
      searchDropdown.replaceChildren();
      return;
    }
    searchClear.hidden=false;
    const matches=areas.filter(a=>a.zips.some(z=>z.includes(q))||a.name.toLowerCase().includes(q));
    searchDropdown.replaceChildren();
    if(matches.length===0){
      searchDropdown.append(el('div','No matching Brooklyn areas or ZIPs.','search-empty'));
    }else{
      matches.slice(0,6).forEach(a=>{
        const item=el('button',undefined,'search-item');
        item.type='button';
        item.append(el('strong',a.name),el('small',`ZIP ${a.zips.join(', ')} · ${num(a.total)} restaurants`));
        item.addEventListener('click',()=>{
          searchInput.value=a.name;
          searchDropdown.hidden=true;
          highlightArea(a);
        });
        searchDropdown.append(item);
      });
    }
    searchDropdown.hidden=false;
  };

  searchInput.addEventListener('input',doSearch);
  searchInput.addEventListener('keydown',e=>{
    if(e.key==='Enter'){
      e.preventDefault();
      const q=searchInput.value.trim().toLowerCase();
      if(!q)return;
      const match=areas.find(a=>a.zips.some(z=>z.includes(q))||a.name.toLowerCase().includes(q));
      if(match){
        searchInput.value=match.name;
        searchDropdown.hidden=true;
        highlightArea(match);
      }else{doSearch();}
    }else if(e.key==='ArrowDown'){
      e.preventDefault();
      doSearch();
      searchDropdown.querySelector('button')?.focus();
    }else if(e.key==='Escape'){
      searchDropdown.hidden=true;
    }
  });

  searchClear.addEventListener('click',()=>{
    searchInput.value='';
    searchClear.hidden=true;
    searchDropdown.hidden=true;
    searchInput.focus();
  });

  document.addEventListener('click',e=>{
    if(!searchInput.contains(e.target)&&!searchDropdown.contains(e.target)){
      searchDropdown.hidden=true;
    }
  });
}

$('cuisine').addEventListener('change',e=>setState(Number(e.target.value),state.metric));
['share','count'].forEach(m=>$(m).addEventListener('click',()=>setState(state.cuisine,m)));
$('reset').addEventListener('click',()=>{
  setState(cuisines.indexOf('Caribbean'),'share');
  if(searchInput){
    searchInput.value='';
    searchClear.hidden=true;
    searchDropdown.hidden=true;
  }
  document.querySelector('.matrix-scroll').scrollTo({top:0,left:0});
  window.mapExplorer?.reset();
});

render(false);

if(document.modelContext?.registerTool){
  try{
    Promise.resolve(document.modelContext.registerTool({
      name:'set_cuisine_spotlight',
      description:'Select the cuisine and measurement in the Brooklyn heatmap.',
      inputSchema:{
        type:'object',
        properties:{cuisine:{type:'string',enum:cuisines},metric:{type:'string',enum:['share','count']}},
        required:['cuisine','metric'],
        additionalProperties:false
      },
      annotations:{readOnlyHint:false},
      execute(input){
        setState(cuisines.indexOf(input.cuisine),input.metric);
        return{cuisine:input.cuisine,metric:state.metric,leaders:sortAreas().slice(0,5).map(a=>({area:a.name,count:a.counts[state.cuisine],share:share(a,state.cuisine)}))};
      }
    })).catch(()=>{});
  }catch{}
}
