/* Mathematics-style branches and rich cards over the original searchable graph. */
(() => {
 'use strict';
 const NS='http://www.w3.org/2000/svg',FONT='system-ui,-apple-system,"Segoe UI","Microsoft YaHei","PingFang SC",sans-serif';
 const forest=KBMindMap.buildForest(nodes),body=document.body,CARDS=new Set(['concept','law','method','question','answer','page']);
 const mc=document.createElement('canvas').getContext('2d'),cache=new Map(),measurer=element('div','map-card-measurer');document.body.append(measurer);
 let root,shown=[],selection=null,relationMode=false,branchMode=false,richMode=true;
 let stage,svg,viewport,linkLayer,crossLayer,nodeLayer,info,zoomLabel,bookSelect;
 let scale=1,tx=0,ty=0,drag=null,moved=false;
 const isMap=()=>body.classList.contains('map-mode');
 function S(type,attrs={}){const e=document.createElementNS(NS,type);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);return e;}
 function button(text,id,fn){const b=element('button','',text);if(id)b.id=id;b.type='button';b.addEventListener('click',fn);return b;}
 function transform(){viewport.setAttribute('transform',`translate(${tx},${ty}) scale(${scale})`);zoomLabel.textContent=Math.round(scale*100)+'%';}
 function zoom(next,x=stage.clientWidth/2,y=stage.clientHeight/2){next=Math.max(.06,Math.min(2.5,next));tx=x-(x-tx)*next/scale;ty=y-(y-ty)*next/scale;scale=next;transform();}
 function fit(){
  if(!shown.length||!stage.clientWidth||!stage.clientHeight)return;
  const l=Math.min(...shown.map(n=>n.x-15)),r=Math.max(...shown.map(n=>n.x+n.w+15)),t=Math.min(...shown.map(n=>n.y-n.h/2-10)),b=Math.max(...shown.map(n=>n.y+n.h/2+10));
  scale=Math.max(.06,Math.min(1.6,(stage.clientWidth-64)/(r-l+35),(stage.clientHeight-95)/(b-t+35)));tx=stage.clientWidth/2-(l+r)*scale/2;ty=(stage.clientHeight-30)/2-(t+b)*scale/2;transform();
 }
 function focus(n,branch=false){if(!n)return;scale=Math.max(.72,Math.min(1.6,scale));const anchor=branch&&n!==root?(n.dir>0?n.x:n.x+n.w):n.x+n.w/2;tx=(branch&&n!==root?(n.dir>0?stage.clientWidth*.24:stage.clientWidth*.76):stage.clientWidth/2)-anchor*scale;ty=stage.clientHeight/2-n.y*scale;transform();}
 const center=n=>[n.x+n.w/2,n.y],underY=n=>n.card||n===root?n.y:n.y+n.h/2-3;
 const innerPoint=n=>[n.dir>0?n.x:n.x+n.w,underY(n)],outPoint=n=>[n.dir>0?n.x+n.w:n.x,underY(n)];
 function curve(a,b){const dx=(b[0]-a[0])*.52;return `M${a[0]},${a[1]} C${a[0]+dx},${a[1]} ${b[0]-dx},${b[1]} ${b[0]},${b[1]}`;}
 function taper(a,b,w0,w1){const dx=(b[0]-a[0])*.52;return `M${a[0]},${a[1]-w0} C${a[0]+dx},${a[1]-w0} ${b[0]-dx},${b[1]-w1} ${b[0]},${b[1]-w1} L${b[0]},${b[1]+w1} C${b[0]-dx},${b[1]+w1} ${a[0]+dx},${a[1]+w0} ${a[0]},${a[1]+w0} Z`;}
 function wrap(text,width,fs=12.5,max=3){mc.font=`${fs}px ${FONT}`;const lines=[];let line='';for(const ch of String(text).replace(/\s+/g,' ')){if(mc.measureText(line+ch).width>width&&line){lines.push(line);line=ch;}else line+=ch;}if(line)lines.push(line);if(lines.length>max){lines.length=max;let last=lines[max-1];while(last&&mc.measureText(last+'…').width>width)last=last.slice(0,-1);lines[max-1]=last+'…';}return lines;}
 function previewOf(n){
  const source=String(n.data?.text||'');if(!source)return '';
  const breaks=[...source.matchAll(/\n\s*\n/g)];let end=Math.min(source.length,breaks[2]?.index??source.length,700);
  const re=/\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|(?<!\\)\$[^\n$]+?\$/g;
  for(const m of source.matchAll(re))if(end>m.index&&end<m.index+m[0].length)end=m.index+m[0].length;
  return source.slice(0,end)+(end<source.length?'\n\n…':'');
 }
 function prepareCards(){
  const visible=[];(function visit(n){visible.push(n);if(n.open)n.children.forEach(visit);})(root);
  richMode=visible.filter(n=>n!==root&&(n.card||CARDS.has(n.kind))).length<=(relationMode?12:80);
  for(const n of visible){
   const card=n!==root&&(n.card||CARDS.has(n.kind)),width=Math.max(90,(n.w||(n.kind==='question'?340:430))-24);
   n.relationLines=n.relation?wrap(n.relation,width,11,3):[];n.relationHeight=n.relationLines.length?8+n.relationLines.length*16:0;
   n.cardBody=card&&richMode?previewOf(n):'';const key=(n.data?.id||n.id)+'|'+width+'|'+n.cardBody;let value=cache.get(key);
   if(!value){const html=n.cardBody?safeMarkdown(n.cardBody):'';measurer.style.width=width+'px';measurer.innerHTML=html;value={html,height:html?Math.min(220,Math.ceil(measurer.getBoundingClientRect().height)):0};cache.set(key,value);}
   n.cardHTML=value.html;n.cardBodyHeight=value.height;n.extraHeight=n.relationHeight+(card?(value.height?value.height+34:26):0);
  }
 }
 function nodeText(n,g){
  const isRoot=n===root,fs=n.fs||n.style?.fs||(isRoot?22:n.depth===1?16.5:13.5),lh=n.lh||fs*1.5,header=n.lines.length*lh+(isRoot?26:n.card?20:9),top=n.card?12:isRoot?13:3;
  n.lines.forEach((line,i)=>{const x=isRoot?n.w/2:n.card?12:n.dir>0?2:n.w-2,t=S('text',{class:n.card?'map-card-title':'map-branch-title',x,y:top+n.relationHeight+i*lh+fs*.82,'text-anchor':isRoot?'middle':n.card||n.dir>0?'start':'end','font-size':fs,'font-family':FONT,'font-weight':(n.bold??n.style?.bold)?600:400,fill:isRoot?'#fff':n.card||n.depth===1?n.color:'#25313c'});t.textContent=line;g.append(t);});
  n.relationLines.forEach((line,i)=>{const t=S('text',{class:'map-relation-note',x:12,y:16+i*16,'font-size':11,fill:'#73549a'});t.textContent=line;g.append(t);});
  if(n.card){
   if(n.cardHTML&&n.cardBodyHeight){const fo=S('foreignObject',{x:12,y:header+n.relationHeight,width:n.w-24,height:n.cardBodyHeight}),div=element('div','map-card-body');div.style.width=(n.w-24)+'px';div.innerHTML=n.cardHTML;fo.append(div);g.append(fo);}
   const foot=S('text',{x:12,y:n.h-10,class:'map-card-footer','font-size':10.5,fill:'#7a838b'});foot.textContent=(kinds[n.data?.kind||n.kind]||n.kind)+' · '+(isReviewed(n.data?.review_status||n.data?.status)?'已核对':'待核对')+' · 点击查看全文 / 原书页';g.append(foot);
  }
 }
 function draw(doFit=false){
  if(!root)return;shown=KBMindMap.layoutTree(root);prepareCards();shown=KBMindMap.layoutTree(root);linkLayer.replaceChildren();crossLayer.replaceChildren();nodeLayer.replaceChildren();const present=new Set(shown);
  for(const n of shown){
   if(n!==root&&present.has(n.parent)){const p=n.parent,a=p===root?[p.x+p.w/2+n.dir*p.w/2,p.y]:outPoint(p),b=innerPoint(n);if(p===root)linkLayer.append(S('path',{d:taper(a,b,5.5,1.8),fill:n.color,opacity:.92,class:'map-taper'}));else if(p.depth===1)linkLayer.append(S('path',{d:taper(a,b,2.4,1.1),fill:n.color,opacity:.85,class:'map-taper'}));else linkLayer.append(S('path',{d:curve(a,b),stroke:n.color,'stroke-width':1.4,opacity:n.card?.4:.7,fill:'none'}));}
   const selected=selection===n.id||Boolean(n.data&&selection===n.data.id),cls='map-node '+(n===root?'map-root':n.card?'map-card':'map-branch')+(n.kind==='group'?' map-group':'')+(selected?' selected':'');
   const g=S('g',{class:cls,'data-id':n.data?.id||n.id,'data-uid':n.id,transform:`translate(${n.x},${n.y-n.h/2})`,role:'button',tabindex:'0','aria-label':n.title+(n.children.length?`，${n.children.length} 个分支，${n.open?'已展开':'已收起'}`:''),'aria-expanded':String(n.open)});
   if(n===root)g.append(S('rect',{class:'map-box',width:n.w,height:n.h,rx:14,fill:'#2c4661',stroke:'#22384f','stroke-width':1}));
   else if(n.card){g.append(S('rect',{class:'map-box',width:n.w,height:n.h,rx:8,fill:'#fff',stroke:n.color,'stroke-width':selected?2:1.3}));const fs=n.fs||12.5,lh=n.lh||fs*1.5,hh=n.lines.length*lh+20+n.relationHeight;g.append(S('path',{d:`M8,0 H${n.w-8} Q${n.w},0 ${n.w},8 V${hh} H0 V8 Q0,0 8,0 Z`,fill:n.color,opacity:.1,class:'map-card-head'}));}
   else{g.append(S('rect',{class:'map-hit',x:-7,y:-1,width:n.w+14,height:n.h+2,rx:7,fill:selected?n.color:'transparent',opacity:selected?.13:1}));g.append(S('line',{x1:0,y1:n.h-3,x2:n.w,y2:n.h-3,stroke:n.color,'stroke-width':n.depth===1?2.6:1.7,'stroke-linecap':'round',opacity:.95,class:'map-underline'}));}
   nodeText(n,g);
   if(n.children.length&&!n.open){const cx=n===root?n.w/2:n.dir<0?-11:n.w+11,cy=n===root?n.h+12:n.card?n.h/2:n.h-3;g.append(S('circle',{cx,cy,r:9,fill:'#fff',stroke:n.color,'stroke-width':1.4,class:'map-count'}));const t=S('text',{x:cx,y:cy+3.6,'text-anchor':'middle',fill:n.color,'font-size':10,'font-weight':600});t.textContent=n.children.length>99?'99+':n.children.length;g.append(t);}
   if(n.data&&n.card)g.append(S('circle',{cx:n.w-8,cy:8,r:3.2,fill:isReviewed(n.data.review_status||n.data.status)?'#2f6b4f':'#c8952a'}));
   const title=S('title');title.textContent=n.title+(n.relation?'\n'+n.relation:'')+(n.data?' · '+(n.data.review_status||n.data.status||'待核对'):'');g.append(title);
   g.addEventListener('click',e=>{e.stopPropagation();if(!moved)activate(n);});g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(n);}});nodeLayer.append(g);
  }
  const visible=new Map(shown.filter(n=>n.data).map(n=>[n.data.id,n]));let crossCount=0;
  if(!relationMode&&selection&&visible.has(selection))for(const e of adjacency.get(selection)||[]){const a=visible.get(e.from),b=visible.get(e.to);if(!a||!b||a.parent===b||b.parent===a||/包含|出处|依据|contains|source/.test(e.type))continue;const path=S('path',{d:curve(center(a),center(b))}),title=S('title');title.textContent=(relationNames[e.type]||e.type)+' · '+(e.status||'待核对');path.append(title);crossLayer.append(path);crossCount++;}
  info.textContent=`${relationMode?'关联图':branchMode?'当前分支':'思维导图'} · ${shown.length} 个可见节点${crossCount?' · '+crossCount+' 条关联':''}${!richMode?(relationMode?' · 密集关联图显示标题与关系':' · 大图仅显示卡片标题'):''}　点击展开本支 · 拖动平移 · 滚轮缩放 · 金点待核对`;
  $('map-relations').classList.toggle('active',relationMode);$('map-branch').classList.toggle('active',branchMode);if(doFit)fit();else transform();
 }
 function openBranch(n){let used=0;(function visit(m){if(!m.children.length)return;const count=m.children.filter(c=>c.card||CARDS.has(c.kind)).length;if(count&&m!==n&&used+count>56){m.open=false;return;}m.open=true;used+=count;m.children.forEach(visit);})(n);}
 function closeBranch(n){n.open=false;n.children.forEach(closeBranch);}
 function closeDetail(){body.classList.remove('detail-open');draw();}
 function addClose(){if(!$('detail-close'))$('detail').prepend(button('关闭详情 ×','detail-close',closeDetail));$('detail-close').className='detail-close';}
 const originalOpen=openNode;
 function openDetail(id,history=true){originalOpen(id,history);body.classList.add('detail-open');addClose();}
 function openGroup(n){
  const detail=$('detail');detail.classList.remove('is-empty');detail.replaceChildren();const head=element('div','detail-top'),title=element('h2','',n.title);title.id='detail-title';head.append(title,element('div','muted',`${n.subject||''} · ${n.book||''} · ${n.children.length} 个条目`));const content=element('div','detail-content');content.append(element('div','review-note','这是导图浏览分组。每个条目的内容、来源与核对状态请点开查看。'));
  n.children.slice(0,100).forEach(child=>{const b=button(child.title,null,()=>{selection=child.id;if(child.data)openNode(child.data.id);else{openBranch(child);openGroup(child);draw();focus(child,true);}});b.className='relation-button';content.append(b);});if(n.children.length>100)content.append(element('p','muted',`此处列出前100项；共${n.children.length}项，全部内容可用全文检索。`));detail.append(head,content);body.classList.add('detail-open');addClose();detail.scrollTop=0;
 }
 function activate(n){selection=n.data?.id||n.id;const opening=n.children.length&&!n.open;if(n.children.length){if(opening)openBranch(n);else closeBranch(n);}if(n.data)openDetail(n.data.id);else if(n.kind==='group')openGroup(n);body.classList.remove('searching');draw();focus(n,Boolean(n.children.length));}
 openNode=function(id,history=true){if(!stage||!isMap()){originalOpen(id,history);return;}const n=forest.real.get(String(id));if(!n)return;selection=n.id;relationMode=false;branchMode=false;root=KBMindMap.reveal(n);if(n.children.length)openBranch(n);syncControls();openDetail(id,history);body.classList.remove('searching');draw();focus(n,Boolean(n.children.length));};
 function syncControls(){const actual=forest.roots.find(r=>r.subject===(root?.subject||'化学')&&r.book===(root?.book||'精讲册'));if(actual)bookSelect.value=actual.book;["物理"].forEach(s=>$('map-'+s)?.classList.toggle('active',s===root?.subject));}
 function switchRoot(subject,book='精讲册'){const next=forest.roots.find(r=>r.subject===subject&&r.book===book)||forest.roots.find(r=>r.subject===subject);if(!next)return;root=next;root.open=true;relationMode=false;branchMode=false;selection=null;if($('subject').value&&$('subject').value!==subject){$('subject').value=subject;updateResults();}body.classList.remove('detail-open','searching');syncControls();draw(true);searchState();}
 function collapse(){for(const n of forest.all.values())n.open=n.kind==='root';if(relationMode)root.children.forEach(n=>n.open=false);root.open=true;draw(true);}
 function expandOne(){const candidates=shown.filter(n=>!n.open&&n.children.length);let budget=220-shown.length;for(const n of candidates){if(n.children.length>budget)continue;n.open=true;budget-=n.children.length;}draw(true);}
 function expandTo(level){(function visit(n,depth){n.open=Boolean(n.children.length&&depth<level);n.children.forEach(c=>visit(c,depth+1));})(root,0);draw(true);}
 function onlyBranch(){const n=forest.real.get(selection)||forest.all.get(selection);if(!n){info.textContent='先点击一个分组、知识点或题目，再只看本支。';return;}root=n;relationMode=false;branchMode=true;openBranch(n);draw(true);}
 function relations(){
  const source=forest.real.get(selection);if(!source){info.textContent='先点击一个知识点或题目，再查看关联图。';return;}relationMode=true;branchMode=false;root={...source,id:'map:relations:'+source.id,parent:null,kind:'root',children:[],open:true,extraHeight:0};const grouped=new Map();
  for(const e of adjacency.get(source.id)||[]){const targetId=e.from===source.id?e.to:e.from,target=forest.real.get(targetId);if(!target||target.kind==='page'||/包含|原文出处|原文依据|contains|source/.test(e.type))continue;const label=(e.from===source.id?'→ ':'← ')+(relationNames[e.type]||e.type)+' · '+(isReviewed(e.review_status||e.status)?'已核对':'待核对');if(!grouped.has(targetId))grouped.set(targetId,{target,labels:new Set()});grouped.get(targetId).labels.add(label);}
  for(const {target,labels} of grouped.values())root.children.push({...target,id:'map:rel:'+target.id,parent:root,children:[],open:false,relation:[...labels].join(' / '),extraHeight:0});draw(true);if(!root.children.length)info.textContent='此条目暂未记录知识或题目关联；原书出处可在右侧查看。';
 }
 function searchState(){if(isMap())body.classList.toggle('searching',Boolean($('search').value.trim()||$('kind').value));}
 function mode(map){body.classList.toggle('map-mode',map);if(map){if(currentId&&forest.real.has(currentId))openNode(currentId,false);else draw(true);searchState();}else body.classList.remove('searching');}
 function initializeMap(){
  body.classList.add('map-mode');document.title='物理知识图谱';document.querySelector('h1').firstChild.textContent='物理知识图谱';stage=element('div','map-stage');stage.id='map-stage';stage.setAttribute('aria-label','可展开的物理思维导图');svg=S('svg',{class:'map-svg',id:'mindmap','aria-label':'知识点、方法和题目思维导图'});viewport=S('g');linkLayer=S('g',{class:'map-links'});crossLayer=S('g',{class:'map-cross'});nodeLayer=S('g');viewport.append(linkLayer,crossLayer,nodeLayer);svg.append(viewport);stage.append(svg);
  info=element('div','map-info');const zoomer=element('div','map-zoom');zoomLabel=element('span');zoomer.append(button('−','map-minus',()=>zoom(scale/1.2)),zoomLabel,button('+','map-plus',()=>zoom(scale*1.2)),button('适应','map-fit',fit));stage.append(info,zoomer);document.querySelector('.workspace').prepend(stage);
  const tabs=element('div','map-tools map-subject-tabs');["物理"].forEach(s=>tabs.append(button(s,'map-'+s,()=>switchRoot(s,bookSelect.value))));tabs.append(button('核对进度','map-progress',()=>body.classList.toggle('show-progress')),button('列表检索','list-mode',()=>mode(false)),button('返回思维导图','map-return',()=>mode(true)));document.querySelector('.brandrow').append(tabs);
  const tools=element('div','map-tools'),levels=element('select');levels.id='map-level';levels.setAttribute('aria-label','导图展开层级');['一级','两级','三级','四级','五级'].forEach((label,i)=>levels.append(new Option(label,String(i+1))));levels.addEventListener('change',()=>expandTo(Number(levels.value)));bookSelect=element('select');bookSelect.id='map-book';bookSelect.setAttribute('aria-label','导图书册');const books=[...new Set(forest.roots.map(r=>r.book))].sort((a,b)=>['精讲册','精练册','答案册'].indexOf(a)-['精讲册','精练册','答案册'].indexOf(b));books.forEach(b=>bookSelect.append(new Option(b==='精讲册'?'知识图谱 · 精讲':b,b)));bookSelect.addEventListener('change',()=>switchRoot(root.subject,bookSelect.value));tools.append(bookSelect,levels,button('总览','map-overview',()=>{switchRoot(root.subject,root.book);collapse();}),button('展开一级','map-expand',expandOne),button('收起','map-collapse',collapse),button('只看本支','map-branch',onlyBranch),button('关联图','map-relations',relations));document.querySelector('.toolbar').append(tools);
  $('search').addEventListener('input',searchState);$('search').addEventListener('focus',searchState);$('kind').addEventListener('change',searchState);$('subject').addEventListener('change',()=>{if($('subject').value)switchRoot($('subject').value,bookSelect.value);searchState();});$('reset').addEventListener('click',()=>{body.classList.remove('searching','detail-open');switchRoot(root.subject,root.book);collapse();});
  svg.addEventListener('wheel',e=>{e.preventDefault();const r=svg.getBoundingClientRect();zoom(scale*(e.deltaY<0?1.12:1/1.12),e.clientX-r.left,e.clientY-r.top);},{passive:false});svg.addEventListener('pointerdown',e=>{if(e.button!==0)return;moved=false;drag={x:e.clientX,y:e.clientY,tx,ty,id:e.pointerId};});svg.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>5){moved=true;stage.classList.add('dragging');svg.setPointerCapture(e.pointerId);}if(moved){tx=drag.tx+dx;ty=drag.ty+dy;transform();}});const end=e=>{if(drag&&svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);drag=null;stage.classList.remove('dragging');};svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end);svg.addEventListener('click',e=>{if(!e.target.closest('.map-node'))body.classList.remove('searching','show-progress');});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&isMap()){body.classList.remove('searching','show-progress','detail-open');draw();}});
  new ResizeObserver(()=>{if(isMap()){const selected=shown.find(n=>n.id===selection||n.data?.id===selection);if(selected)focus(selected,Boolean(selected.children.length));else fit();}}).observe(stage);switchRoot("物理");if(currentId)openNode(currentId,false);
 }
 window.addEventListener('DOMContentLoaded',initializeMap);
})();
