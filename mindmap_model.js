/* Display-only hierarchy: never changes source nodes or inferred relationships. */
(function (global) {
  'use strict';
  const labels = {knowledge:'知识点 / 考法',concept:'概念',law:'规律 / 定律',method:'解题方法',question:'题目',answer:'答案',page:'原书扫描页'};
  const colors = {concept:'#1a94b0',law:'#b8479a',method:'#c8952a',question:'#2f7ed8',answer:'#8a6caa',page:'#899690'};
  const palette = ['#2f7ed8','#e76b36','#1b9e77','#b8479a','#7556d8','#c8952a','#1696b0','#d74762','#688e31'];
  function make(id,title,extra={}) { return {id,title,children:[],parent:null,open:false,...extra}; }
  function attach(p,n) { n.parent=p; p.children.push(n); }
  function buildForest(nodes) {
    const real=new Map(), all=new Map(), roots=[], rootByKey=new Map();
    const bookOf=n=>n.book||n.sources?.[0]?.book||'专题整理';
    function rootFor(n) {
      const subject=n.subject||'未分类', book=bookOf(n), key=subject+'|'+book;
      if (!rootByKey.has(key)) {
        const root=make('map:root:'+key,subject+' · '+book,{subject,book,kind:'root',open:true});
        roots.push(root); rootByKey.set(key,root); all.set(root.id,root);
      }
      return rootByKey.get(key);
    }
    nodes.forEach(n=>{const m=make(String(n.id),n.title||'未命名条目',{data:n,kind:n.kind,subject:n.subject,book:bookOf(n)});real.set(m.id,m);all.set(m.id,m);rootFor(n);});
    nodes.forEach(n=>{
      const m=real.get(String(n.id)), candidate=real.get(String(n.parent));
      let p=candidate&&candidate.subject===m.subject&&candidate.book===m.book?candidate:rootFor(n);
      // Protect navigation against malformed imported parent cycles.
      const seen=new Set([m.id]);let ancestor=p;
      while(ancestor){if(seen.has(ancestor.id)){p=rootFor(n);break;}seen.add(ancestor.id);ancestor=ancestor.parent;}
      if(labels[m.kind]&&['root','chapter','section'].includes(p.kind)) {
        const groupId='map:group:'+p.id+':'+m.kind;
        if(!all.has(groupId)){const g=make(groupId,labels[m.kind],{kind:'group',groupKind:m.kind,subject:m.subject,book:m.book});all.set(groupId,g);attach(p,g);}
        p=all.get(groupId);
      }
      attach(p,m);
    });
    // A curated supplement is a distinct original node, not a duplicate book chapter.
    // Nest that supplement under the matching lecture chapter while keeping its ID.
    const normalized=s=>String(s).replace(/[\s\u3000、，,。:：·]/g,'');
    for(const n of real.values())if(n.kind==='chapter'&&n.book==='精讲册'&&/精编|人工整理/.test(n.data.status||'')){
      const matches=[...real.values()].filter(p=>p!==n&&p.kind==='chapter'&&p.subject===n.subject&&p.book===n.book&&!/精编|人工整理/.test(p.data.status||'')&&normalized(p.title)===normalized(n.title));
      if(matches.length===1){n.parent.children=n.parent.children.filter(c=>c!==n);attach(matches[0],n);n.title='精编专题';n.displayNote='原章节：'+n.data.title;}
    }
    const priority={chapter:0,section:1,knowledge:2,concept:3,law:4,method:5,question:6,answer:7,page:8};
    for(const n of all.values())n.children.sort((a,b)=>(priority[a.groupKind||a.kind]??9)-(priority[b.groupKind||b.kind]??9));
    return {real,all,roots};
  }
  function reveal(node) {let root=node;for(let p=node.parent;p;p=p.parent){p.open=true;root=p;}return root;}
  function layoutTree(root) {
    const shown=[];
    const context=typeof document!=='undefined'?document.createElement('canvas').getContext('2d'):null;
    const textWidth=(s,fs,bold)=>{if(context){context.font=(bold?'600 ':'')+fs+'px system-ui,"Microsoft YaHei",sans-serif';return context.measureText(s).width;}return [...s].reduce((sum,c)=>sum+(/[\u0000-\u007f]/.test(c)?.58:1)*fs,0);};
    function measure(n,color,depth){
      n.color=colors[n.groupKind||n.kind]||color;n.depth=depth;
      n.card=n!==root&&['concept','law','method','question','answer','page'].includes(n.kind);
      n.fs=depth===0?22:n.card?(n.kind==='question'?12:12.5):depth===1?16.5:depth===2?14.5:depth===3?13.5:13;
      n.bold=depth===0||['chapter','section','group'].includes(n.kind)||n.card&&n.kind!=='question';n.lh=n.fs*(n.card?1.45:1.5);
      const cw=['question','answer','page'].includes(n.kind)?340:430;
      const maxW=n.card?cw-24:depth===0?300:depth===1?215:depth===2?250:depth===3?290:330,maxLines=n.card?2:4;
      const lines=[];let line='';
      for(const ch of String(n.title).replace(/\s+/g,' ').replace(/\$/g,'')){if(line&&textWidth(line+ch,n.fs,n.bold)>maxW){lines.push(line);line=ch;}else line+=ch;}if(line)lines.push(line);
      if(lines.length>maxLines){lines.length=maxLines;let last=lines[maxLines-1];while(last&&textWidth(last+'…',n.fs,n.bold)>maxW)last=last.slice(0,-1);lines[maxLines-1]=last+'…';}
      n.lines=lines.length?lines:[''];n.w=n.card?cw:Math.max(26,...n.lines.map(s=>textWidth(s,n.fs,n.bold)))+(depth===0?40:4);
      n.h=n.lines.length*n.lh+(depth===0?26:n.card?20:9)+Math.max(0,Number(n.extraHeight)||0);n.span=n.h+11;shown.push(n);
      if(n.open&&n.children.length){n.children.forEach(c=>measure(c,n.color,depth+1));n.span=Math.max(n.span,n.children.reduce((s,c)=>s+c.span,0)+6);}
    }
    measure(root,'#2c4661',0);root.x=-root.w/2;root.y=0;root.dir=0;
    const children=root.open?root.children:[];
    // Preserve book order while balancing the two sides, as in the mathematics map.
    const total=children.reduce((s,c)=>s+c.span,0);let sum=0,split=children.length,best=Infinity;
    children.forEach((n,i)=>{sum+=n.span;const diff=Math.abs(total-2*sum);if(diff<best){split=i+1;best=diff;}});
    function place(n,near,top,dir,color){n.dir=dir;n.x=dir>0?near:near-n.w;n.y=top+n.span/2;n.color=colors[n.groupKind||n.kind]||color;let y=top+(n.span-(n.open?n.children.reduce((s,c)=>s+c.span,0):0))/2;if(n.open)n.children.forEach(c=>{place(c,near+dir*(n.w+(n.depth===1?56:46)),y,dir,n.color);y+=c.span;});}
    for(const [items,dir] of [[children.slice(0,split),1],[children.slice(split),-1]]){let y=-items.reduce((s,n)=>s+n.span,0)/2;items.forEach(n=>{place(n,dir*(root.w/2+90),y,dir,palette[children.indexOf(n)%palette.length]);y+=n.span;});}
    return shown;
  }
  const api={buildForest,layoutTree,reveal};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else global.KBMindMap=api;
})(typeof globalThis!=='undefined'?globalThis:this);
