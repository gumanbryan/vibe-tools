import names from './industry-names.json' with {type:'json'};
export function industryName(code,market) {
  const normalized=String(code??'').trim().padStart(2,'0');
  if(normalized==='17'&&market==='tpex')return '金融業';
  return names[normalized] ?? `未分類／待核對（${code||'缺代碼'}）`;
}
export function groupIndustries(securities) {
  const groups=new Map();
  for(const s of securities.filter(s=>s.productType==='stock')) {
    const code=String(s.industry??'').trim().padStart(2,'0'),name=industryName(s.industry,s.market),key=code+':'+name;
    if(!groups.has(key))groups.set(key,{id:'industry-'+code+(code==='17'?'-'+s.market:''),code,name,members:[]});
    groups.get(key).members.push({code:s.code,from:'2026-09-01',market:s.market});
  }
  return [...groups.values()].sort((a,b)=>a.code.localeCompare(b.code)).map(g=>({...g,members:g.members.sort((a,b)=>a.code.localeCompare(b.code))}));
}
