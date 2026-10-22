export function enhanceStories(root) {
 if(!root||!root.querySelector('[data-story-grid]'))return ()=>{};
 const cards=[...root.querySelectorAll('[data-story-card]')];
 const filters=[...root.querySelectorAll('[data-filter]')];
 const search=root.querySelector('[data-story-search]');
 const count=root.querySelector('[data-result-count]');
 const feature=root.querySelector('[data-feature]');
 const load=root.querySelector('[data-load-more]');
 const empty=root.querySelector('[data-empty]');
 const reset=root.querySelector('[data-reset]');
 const form=root.querySelector('[data-filter-form]');
 let selected='All stories',visible=6;
 const handlers=[];
 const on=(el,type,fn)=>{el?.addEventListener(type,fn);handlers.push(()=>el?.removeEventListener(type,fn));};
 function update(){
  const q=search.value.trim().toLowerCase();
  let matches=0;
  cards.forEach(card=>{const match=(selected==='All stories'||(card.dataset.tags||card.dataset.category).split('|').includes(selected))&&(!q||card.dataset.search.includes(q));card.hidden=!match||matches>=visible;if(match)matches++;});
  filters.forEach(btn=>{const active=btn.dataset.filter===selected;btn.classList.toggle('is-active',active);btn.setAttribute('aria-pressed',String(active));});
  feature.hidden=selected!=='All stories'||!!q;
  count.textContent=`Showing ${Math.min(matches,visible)} of ${matches} ${matches===1?'story':'stories'}`;
  empty.hidden=matches!==0;
  load.hidden=matches<=visible;
 }
 on(form,'submit',e=>e.preventDefault());
 filters.forEach(btn=>on(btn,'click',()=>{selected=btn.dataset.filter;visible=6;update();}));
 on(search,'input',()=>{visible=6;update();});
 on(reset,'click',()=>{selected='All stories';search.value='';visible=6;update();search.focus();});
 on(load,'click',()=>{const before=visible;visible+=6;update();const shown=cards.filter(c=>!c.hidden);shown[before]?.querySelector('h3 a')?.focus({preventScroll:true});});
 update();
 // Filtering reduces the initial server-rendered document height; restore a
 // direct package-chooser anchor after the initial list is shortened.
 if(window.location.hash==='#ts-get-started')root.querySelector('#ts-get-started')?.scrollIntoView({block:'start'});
 return ()=>handlers.forEach(dispose=>dispose());
}
