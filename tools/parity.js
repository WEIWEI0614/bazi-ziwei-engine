const fs=require('fs'), path=require('path');
global.window={};
const root=path.join(__dirname,'..','web');
eval(fs.readFileSync(path.join(root,'data.js'),'utf8'));
eval(fs.readFileSync(path.join(root,'engine.js'),'utf8'));
const cases=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const out=cases.map(c=>{
  try{
    const r=window.ML.buildReading(c);
    return {id:c.id, four:r.bazi.pillars.map(p=>p.gan+p.zhi).join(' '),
      lunar:[r.bazi.lunar.year,r.bazi.lunar.month,r.bazi.lunar.day,r.bazi.lunar.isLeap],
      strength:r.bazi.strength, elements:r.bazi.elementScores,
      structure:r.bazi.structure.name, tiaohou:r.bazi.tiaohou,
      ming:r.ziwei.mingBranch, ju:r.ziwei.ju, ziwei:r.ziwei.ziweiBranch,
      palaces:r.ziwei.palaces.map(p=>[p.branch,p.name,p.stars.map(s=>s.name).join('')]),
      overall:r.scores.overall, dims:r.scores.dimensions, areas:r.scores.areas,
      cycles:r.cycles.map(c=>[c.label,c.startAge,c.startYear]),
      timeline:r.timeline.map(t=>[t.name,t.label,t.score]),
      months:r.months.map(m=>[m.name,m.label,m.score])};
  }catch(e){return {id:c.id,error:String(e)}}
});
fs.writeFileSync(process.argv[3], JSON.stringify(out));
console.log('js done', out.length, out.filter(o=>o.error).length,'errors');
