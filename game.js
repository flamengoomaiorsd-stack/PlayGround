(() => {
'use strict';
const $ = s => document.querySelector(s);
const all = s => [...document.querySelectorAll(s)];
const canvas = $('#scene');
const ctx = canvas.getContext('2d');
const W = 960, H = 540, ground = 422;
canvas.width = W;
canvas.height = H;
ctx.imageSmoothingEnabled = false;
const chapters = [
  ['A Caçada','HELL’S KITCHEN','Uma sequência de alarmes leva o Vigia aos telhados. Encontre os saqueadores antes que desapareçam.'],
  ['Fios Cruzados','MIDTOWN','Um sinal clandestino atravessa os rádios da cidade. Interrompa a operação e descubra quem está por trás dela.'],
  ['Luzes Apagadas','CHINATOWN','O apagão deixou um quarteirão vulnerável. Proteja os moradores e afaste os invasores.'],
  ['Carga Perigosa','FINANCIAL DISTRICT','Uma carga instável está prestes a ser levada. Derrube os guardas e mantenha a rua segura.'],
  ['O Homem de Aço','LOWER MANHATTAN','O mercenário conhecido como Bastião apareceu. Encare-o e impeça seu plano.'],
  ['Sinal de Socorro','GREENWICH VILLAGE','Um chamado urgente vem de um prédio cercado. Abra caminho até os civis.'],
  ['A Cidade em Jogo','EAST VILLAGE','Uma rede de drones bloqueia as ruas. Desative os operadores no alto dos telhados.'],
  ['Noite de Aço','BROOKLYN BRIDGE','O último comboio cruza a ponte. Você tem uma chance de acabar com isso.'],
  ['Um Novo Amanhã','MANHATTAN','A cidade respira de novo. Uma última ronda confirma que ninguém ficou para trás.']
];
const side = [
  ['Patrulha do Bairro','Afaste cinco saqueadores da vizinhança.','150'],
  ['Entrega Expressa','Interceptar os batedores antes que alcancem a avenida.','180'],
  ['Telhado Seguro','Limpar a rota para que os moradores possam voltar para casa.','220'],
  ['Sinal Perdido','Desativar a equipe que bloqueia as comunicações locais.','250']
].map(a=>[a[0],a[1],+a[2]]);
const suits = [
  ['Vigia Clássico','O traje de tecido reforçado que começou tudo.','Disponível'],
  ['Arco Carmesim','Costuras vermelhas e placas leves para combate.','Conclua o capítulo 02'],
  ['Fantasma Urbano','Tons escuros para se mover sem chamar atenção.','Alcance o nível 3'],
  ['Sentinela','Armadura de alta resistência para a última batalha.','Conclua o capítulo 05']
];
const base = {chapter:0,unlocked:0,completed:[],level:1,xp:0,crimes:0,rescues:0,collectibles:0,score:0,suit:0,skills:[],health:100,muted:false,volume:.55};
let save;
try { save={...base,...JSON.parse(localStorage.getItem('aranha-noite-save')||'{}')}; } catch { save={...base}; }
if (!Array.isArray(save.completed)) save.completed=[];
if (!Array.isArray(save.skills)) save.skills=[];
const persist=()=>{try{localStorage.setItem('aranha-noite-save',JSON.stringify(save));}catch(e){console.warn('Não foi possível salvar neste navegador.',e);}};
let state='title', tab='chapters', previousMenu='title', active=null, origin='campaign';
let hp=save.health||100, web=100, combo=0, enemies=[], particles=[], keys={}, held={}, worldTime=0, toastTimer=0;
let player={x:180,y:ground-64,vx:0,vy:0,face:1,onGround:true,invuln:0,attack:0,dodge:0,anim:0};
let cityOffset=0, dialogueIndex=0, sceneData=null, lastTime=0, hitFlash=0;
const tabItems=[['chapters','CAPÍTULOS'],['missions','MISSÕES'],['suits','TRAJES'],['skills','HABILIDADES'],['map','MAPA'],['stats','ESTATÍSTICAS'],['settings','AJUSTES'],['credits','CRÉDITOS']];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function screen(name){state=name;for(const id of ['titleScreen','gameScreen','menuScreen','pauseScreen','cutscene','endScreen'])$('#'+id).classList.toggle('hidden',({titleScreen:'title',gameScreen:'game',menuScreen:'menu',pauseScreen:'pause',cutscene:'cutscene',endScreen:'end'}[id]!==name));}
function msg(text){const el=$('#toast');el.textContent=text;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2100);}
function updateHud(){const h=clamp(hp,0,100);$('#healthFill').style.width=h+'%';$('#healthText').textContent=Math.ceil(h);$('#levelText').textContent=String(save.level).padStart(2,'0');$('#xpText').textContent=`${save.xp} XP`;$('#xpFill').style.width=(save.xp%300/3)+'%';$('#combo').innerHTML=`✦ <span>${combo}</span> SEQUÊNCIA`;$(`#webFill`).style.background=`linear-gradient(90deg,var(--cyan) ${web}%,#34404b ${web}%)`;
 const chap=active?.title||chapters[save.chapter]?.[0]||chapters[0][0];$('#missionName').textContent=(active?.kind==='side'?'ATIVIDADE':'CAPÍTULO')+` · ${chap.toUpperCase()}`;$('#districtName').textContent=active?.district||chapters[save.chapter][1];
 let objective=active?.kind==='side'?'Afaste os invasores':active?.index===8?'Faça uma ronda pela vizinhança':active?.index===2?'Proteja o quarteirão':active?.index===5?'Abra caminho até os moradores':active?.index===7?'Intercepte o comboio':active?.index===4?'Derrote Bastião':'Enfrente os invasores';
 if(active?.kind==='side')objective=`Afaste os invasores (${Math.min(active.count,active.goal)}/${active.goal})`;
 else if(active?.index===8)objective='A cidade está segura. Faça uma última ronda.';
 else if(active?.index===2||active?.index===5)objective=`${active.index===2?'Proteja o quarteirão':'Abra caminho'} · ${Math.min(active.count,active.goal)}/${active.goal}`;
 else objective=`${active?.index===4?'Derrote Bastião':'Afaste os invasores'} · ${Math.min(active?.count||0,active?.goal||0)}/${active?.goal||0}`;
 $('#objective').textContent=objective;
}
function startMenu(from='title',which='chapters'){previousMenu=from;tab=which;screen('menu');render();}
function render(){const nav=$('#menuTabs');nav.innerHTML='';tabItems.forEach(([id,label])=>{const b=document.createElement('button');b.textContent=label;b.className=id===tab?'active':'';b.onclick=()=>{tab=id;render();};nav.append(b);});$('#panelTitle').textContent=({chapters:'CAPÍTULOS',missions:'MISSÕES',suits:'TRAJES',skills:'HABILIDADES',map:'NOVA YORK',stats:'SEU LEGADO',settings:'AJUSTES',credits:'CRÉDITOS'})[tab];const c=$('#panelContent');
 if(tab==='chapters')c.innerHTML=`<div class="chapter-list">${chapters.map((a,i)=>`<div class="chapter-row"><span>${String(i+1).padStart(2,'0')}　${a[0].toUpperCase()}</span><small>${save.completed.includes(i)?'CONCLUÍDO':i<=save.unlocked?'DISPONÍVEL':'BLOQUEADO'}</small><button data-ch="${i}" ${i>save.unlocked?'disabled':''}>${i<=save.unlocked?'JOGAR':'🔒'}</button></div>`).join('')}</div>`;
 else if(tab==='missions')c.innerHTML=`<div class="content-grid">${side.map((a,i)=>{const done=save.completed.includes('side-'+i);return `<article class="info-card"><span class="tag">ATIVIDADE ${i+1} · ${done?'CONCLUÍDA':'DISPONÍVEL'}</span><b>${a[0]}</b><p>${a[1]}</p><button data-side="${i}" ${done?'disabled':''}>${done?'CONCLUÍDA':`ACEITAR · +${a[2]} XP`}</button></article>`;}).join('')}</div>`;
 else if(tab==='suits')c.innerHTML=`<div class="content-grid">${suits.map((a,i)=>{const ok=i===0||(save.completed.includes(1)&&i===1)||(save.level>=3&&i===2)||(save.completed.includes(4)&&i===3);return `<article class="info-card"><span class="tag">${i===save.suit?'EQUIPADO':ok?'DESBLOQUEADO':'BLOQUEADO'}</span><b>${a[0]}</b><p>${a[1]} ${ok?'':`· ${a[2]}`}</p><button data-suit="${i}" ${ok?'':'disabled'}>${i===save.suit?'EM USO':ok?'EQUIPAR':'REQUISITO PENDENTE'}</button></article>`;}).join('')}</div>`;
 else if(tab==='skills'){const skills=[['Punhos firmes','Ataques causam dano extra.','fight'],['Teia elástica','Recupera teia mais rápido.','web'],['Passo fantasma','Esquiva dura mais tempo.','dodge'],['Foco total','Mais vida ao concluir missões.','focus']];c.innerHTML=`<p class="muted">Pontos disponíveis: <b>${Math.max(0,save.level-1-save.skills.length)}</b> · Cada habilidade custa 1.</p><div class="content-grid">${skills.map(q=>{const got=save.skills.includes(q[2]),can=save.level-1-save.skills.length>0;return `<article class="info-card"><span class="tag">${got?'ADQUIRIDA':can?'CUSTO · 1 PONTO':'BLOQUEADA'}</span><b>${q[0]}</b><p>${q[1]}</p><button data-skill="${q[2]}" ${got||!can?'disabled':''}>${got?'DESBLOQUEADA':can?'ADQUIRIR':'SUBA DE NÍVEL'}</button></article>`;}).join('')}</div>`;}
 else if(tab==='map')c.innerHTML=`<p class="muted">MANHATTAN · REDE DE BAIRROS</p><div class="map-board">${chapters.slice(0,8).map((a,i)=>`<button data-district="${i}" class="map-district ${i===save.chapter?'selected':''}" ${i>save.unlocked?'disabled':''}><i></i>${a[1]}<small>${i<=save.unlocked?'EXPLORADO':'???'}</small></button>`).join('')}</div><p class="muted">Complete capítulos e missões para revelar atividades.</p>`;
 else if(tab==='stats')c.innerHTML=`<div class="content-grid">${[['NÍVEL',save.level],['EXPERIÊNCIA',save.xp+' XP'],['CRIMINOS RESOLVIDOS',save.crimes],['PESSOAS AJUDADAS',save.rescues],['FICHAS DE PESQUISA',save.collectibles],['PONTUAÇÃO',save.score]].map(a=>`<div class="info-card"><span class="tag">REGISTRO DA CIDADE</span><b>${a[1]}</b><p>${a[0]}</p></div>`).join('')}</div>`;
 else if(tab==='settings')c.innerHTML=`<div class="setting-row"><span>MÚSICA E EFEITOS</span><label><input id="muteToggle" type="checkbox" ${save.muted?'checked':''}> SILENCIAR</label></div><div class="setting-row"><span>VOLUME</span><input id="volumeSlider" type="range" min="0" max="100" value="${Math.round(save.volume*100)}"></div><div class="setting-row"><span>SALVAMENTO LOCAL</span><button class="inline-action" id="saveNow">SALVAR AGORA</button></div><div class="setting-row"><span>APAGAR PROGRESSO</span><button class="inline-action" id="resetSave">REINICIAR DADOS</button></div><p class="muted">O progresso é guardado neste navegador.</p>`;
 else c.innerHTML='<p class="muted">Uma aventura original sobre responsabilidade, coragem e as pessoas que fazem uma cidade. Personagens, história, arte e sons são criações próprias deste projeto. HTML5 Canvas, CSS e JavaScript.</p><p class="muted">ARANHA DA CIDADE · NOITE DE AÇO</p>';
 all('[data-ch]').forEach(b=>b.onclick=()=>startChapter(+b.dataset.ch));all('[data-side]').forEach(b=>b.onclick=()=>startSide(+b.dataset.side));all('[data-suit]').forEach(b=>b.onclick=()=>{save.suit=+b.dataset.suit;persist();render();});all('[data-skill]').forEach(b=>b.onclick=()=>{if(!save.skills.includes(b.dataset.skill)&&save.level-1-save.skills.length>0){save.skills.push(b.dataset.skill);persist();render();}});all('[data-district]').forEach(b=>b.onclick=()=>{const i=+b.dataset.district;if(i<=save.unlocked){save.chapter=i;tab='chapters';render();msg('BAIRRO SELECIONADO · ESCOLHA UM CAPÍTULO');}});$('#muteToggle')?.addEventListener('change',e=>{save.muted=e.target.checked;persist();});$('#volumeSlider')?.addEventListener('input',e=>{save.volume=+e.target.value/100;persist();});$('#saveNow')?.addEventListener('click',()=>{save.health=hp;persist();msg('PROGRESSO SALVO');});$('#resetSave')?.addEventListener('click',()=>{if(confirm('Apagar todo o progresso salvo neste navegador?')){save={...base,completed:[],skills:[]};persist();render();msg('DADOS REINICIADOS');}});
}
function playTone(freq=280,duration=.08,type='square'){if(save.muted)return;try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;const ac=playTone.ac||(playTone.ac=new AC());const osc=ac.createOscillator(),gain=ac.createGain();osc.type=type;osc.frequency.value=freq;gain.gain.setValueAtTime(Math.max(.001,save.volume*.07),ac.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ac.currentTime+duration);osc.connect(gain);gain.connect(ac.destination);osc.start();osc.stop(ac.currentTime+duration);}catch{}}
function beginCutscene(index){const c=chapters[index];sceneData={index,step:0,lines:[
 ['A CIDADE CHAMA.','Uma noite tranquila termina quando os alarmes ecoam por Manhattan.'],
 [c[0].toUpperCase()+'.',c[2]],
 ['O VIGIA ESTÁ A CAMINHO.','Respire fundo, mantenha os olhos abertos e cuide de quem precisa.']
 ]};dialogueIndex=0;updateScene();screen('cutscene');}
function updateScene(){const line=sceneData.lines[sceneData.step];$('#sceneChapter').textContent=`CAPÍTULO ${String(sceneData.index+1).padStart(2,'0')} · ${chapters[sceneData.index][1]}`;$('#sceneTitle').textContent=line[0];$('#sceneLine').textContent=line[1];$('#sceneProgress').style.width=`${((sceneData.step+1)/sceneData.lines.length)*100}%`;}
function advanceScene(){if(!sceneData)return;if(++sceneData.step>=sceneData.lines.length){sceneData=null;launchMission();}else updateScene();playTone(360,.04);}
function startChapter(index){if(index>save.unlocked)return;save.chapter=index;persist();active=null;origin='campaign';beginCutscene(index);}
function spawnEnemy(x,boss=false){return{x,y:ground-48,hp:boss?12:2,maxHp:boss?12:2,boss,stun:0,attack:Math.random()*.7,walk:Math.random()*5,hit:0,dead:false};}
function setupActive(kind,index,title,goal,district){active={kind,index,title,goal,count:0,district,startTime:0};enemies=[];particles=[];cityOffset=0;player.x=170;player.y=ground-64;player.vx=0;player.vy=0;player.face=1;player.invuln=1;web=100;combo=0;hp=clamp(save.health||100,55,100);if(goal>0){if(index===4&&kind==='campaign')enemies.push(spawnEnemy(720,true));else for(let i=0;i<goal;i++)enemies.push(spawnEnemy(380+(i%3)*190+(Math.floor(i/3)*130),false));}active.startTime=worldTime;updateHud();}
function launchMission(){const i=active?.index??save.chapter;const goal=i===8?0:i===4?1:(active?.kind==='side'?5:4);setupActive('campaign',i,chapters[i][0],goal,chapters[i][1]);screen('game');$('#dialogue').classList.add('hidden');if(i===8)msg('PATRULHA INICIADA · A CIDADE CONTA COM VOCÊ');else msg(`OBJETIVO ATUALIZADO · ${chapters[i][0].toUpperCase()}`);}
function startSide(i){const a=side[i];active={kind:'side',index:i,title:a[0],goal:5,count:0,district:chapters[save.chapter][1]};origin='side';setupActive('side',i,a[0],5,chapters[save.chapter][1]);screen('game');msg(`MISSÃO ACEITA · ${a[0].toUpperCase()}`);}
function openPause(){if(state!=='game')return;screen('pause');playTone(220,.08);}
function finishMission(){if(!active||state!=='game')return;const wasSide=active.kind==='side';const index=active.index;const xp=wasSide?side[index][2]:index===4?400:250;save.xp+=xp;save.score+=xp+active.count*50;save.crimes+=active.count;save.rescues+=index===2||index===5?3:1;save.collectibles+=1;while(save.xp>=save.level*300){save.xp-=save.level*300;save.level++;msg(`NÍVEL ${save.level} ALCANÇADO · NOVO PONTO DE HABILIDADE`);}
 if(wasSide){if(!save.completed.includes('side-'+index))save.completed.push('side-'+index);$('#endTitle').textContent='BAIRRO PROTEGIDO.';$('#endMessage').textContent=`${side[index][1]} A vizinhança está mais segura graças a você.`;$('#rewardLine').textContent=`+ ${xp} XP　·　+ 1 FICHA DE PESQUISA`;$('#nextMission').textContent='VOLTAR À CIDADE　→';}
 else {save.completed=save.completed.filter(v=>v!==index);save.completed.push(index);save.unlocked=Math.max(save.unlocked,Math.min(8,index+1));save.chapter=Math.min(8,index+1);$('#endTitle').textContent=index===8?'A CIDADE AGRADECE.':'BOA, VIGIA.';$('#endMessage').textContent=index===8?'A noite foi longa, mas ninguém precisou enfrentá-la sozinho. Manhattan segue em frente — e você também.':`Você protegeu ${chapters[index][1]}. Mas a noite ainda guarda outros chamados.`;$('#rewardLine').textContent=`+ ${xp} XP　·　+ 1 FICHA DE PESQUISA`;$('#nextMission').textContent=index>=8?'JOGAR NOVAMENTE':'PRÓXIMO CAPÍTULO　↗';}
 hp=Math.min(100,hp+20);save.health=hp;persist();updateHud();screen('end');playTone(560,.25,'triangle');}
function burst(x,y,color,n=8){for(let i=0;i<n;i++)particles.push({x,y,vx:(Math.random()-.5)*190,vy:(Math.random()-.65)*190,life:.35+Math.random()*.4,color});}
function damageEnemy(e,amount,stun=false){if(e.dead)return;e.hp-=amount;e.hit=.12;if(stun)e.stun=Math.max(e.stun,1.15);burst(e.x,e.y-25,stun?'#59d5e5':'#ffd071',5);playTone(stun?520:180,.05);if(e.hp<=0){e.dead=true;combo++;active.count++;save.score+=100;burst(e.x,e.y-20,'#e4434b',13);msg(e.boss?'BASTIÃO ATORDOADO':'AMEAÇA CONTIDA');updateHud();if(active.count>=active.goal)finishMission();}}
function attack(){if(state!=='game'||!active)return;player.attack=.18;playTone(220,.07);let target=null,d=999;for(const e of enemies){if(e.dead)continue;const dx=e.x-player.x;if(Math.sign(dx||1)===player.face&&Math.abs(dx)<(e.boss?125:100)&&Math.abs(e.y-player.y)<100&&Math.abs(dx)<d){target=e;d=Math.abs(dx);}}if(target)damageEnemy(target,save.skills.includes('fight')?2:1,false);else burst(player.x+player.face*44,player.y-28,'#edf3f4',3);}
function webShot(){if(state!=='game'||!active||web<24)return;web-=24;player.attack=.12;playTone(710,.1,'triangle');let target=null,d=999;for(const e of enemies){if(e.dead)continue;const dx=e.x-player.x;if(Math.sign(dx||1)===player.face&&Math.abs(dx)<310&&Math.abs(dx)<d){target=e;d=Math.abs(dx);}}if(target){damageEnemy(target,1,true);msg('TEIA ACERTOU · INIMIGO IMOBILIZADO');}else msg('TEIA LANÇADA');}
function dodge(){if(state!=='game')return;player.dodge=save.skills.includes('dodge')?.48:.3;player.invuln=Math.max(player.invuln,player.dodge);player.vx=player.face*450;playTone(380,.06,'triangle');}
function update(dt){worldTime+=dt;if(state!=='game'||!active)return;player.anim+=dt;player.invuln=Math.max(0,player.invuln-dt);player.attack=Math.max(0,player.attack-dt);player.dodge=Math.max(0,player.dodge-dt);web=Math.min(100,web+dt*(save.skills.includes('web')?24:13));
 let dir=(held.right||keys.ArrowRight||keys.KeyD?1:0)-(held.left||keys.ArrowLeft||keys.KeyA?1:0);if(dir&&!player.dodge){player.vx=dir*210;player.face=dir;}else if(!player.dodge)player.vx*=Math.pow(.001,dt);
 if((keys.Space||held.jump)&&player.onGround){player.vy=-410;player.onGround=false;playTone(430,.04,'triangle');keys.Space=false;held.jump=false;}
 if((held.attack||keys.KeyJ)&&worldTime-(attack.last||0)>.34){attack.last=worldTime;attack();}
 if((held.web||keys.KeyK)&&worldTime-(webShot.last||0)>.5){webShot.last=worldTime;}
 if((held.dodge||keys.KeyL)&&worldTime-(dodge.last||0)>.55){dodge.last=worldTime;dodge();}
 keys.KeyJ=keys.KeyK=keys.KeyL=false;
 player.x=clamp(player.x+player.vx*dt,42,918);player.vy+=1050*dt;player.y+=player.vy*dt;if(player.y>=ground-64){player.y=ground-64;player.vy=0;player.onGround=true;}cityOffset=(cityOffset+player.vx*dt*.16+4000)%4000;
 if(active.goal===0&&worldTime-active.startTime>15)finishMission();
 for(const e of enemies){if(e.dead)continue;e.hit=Math.max(0,e.hit-dt);e.stun=Math.max(0,e.stun-dt);e.attack-=dt;if(e.stun>0)continue;const dx=player.x-e.x;if(Math.abs(dx)>55){e.x+=Math.sign(dx)*Math.min(Math.abs(dx)-48, (e.boss?49:66)*dt);e.walk+=dt*8;}else if(e.attack<=0){e.attack=e.boss?1.05:1.55;if(player.invuln<=0){hp-=e.boss?13:8;hitFlash=.2;player.invuln=.7;combo=0;burst(player.x,player.y-25,'#e4434b',8);playTone(95,.1);if(hp<=0){hp=55;player.x=170;player.invuln=1.5;msg('RECUPEROU O FÔLEGO · CONTINUE!');}updateHud();}}}
 particles=particles.filter(p=>p.life>0);for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=360*dt;p.life-=dt;}hitFlash=Math.max(0,hitFlash-dt);if(enemies.length&&enemies.every(e=>e.dead)&&active.count<active.goal){for(let i=0;i<Math.min(3,active.goal-active.count);i++)enemies.push(spawnEnemy(800+Math.random()*180));}updateHud();
}
function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function drawCity(){const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#101d35');sky.addColorStop(.58,'#273b50');sky.addColorStop(1,'#111a27');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
 ctx.fillStyle='#d9e8e5';ctx.beginPath();ctx.arc(756,106,28,0,Math.PI*2);ctx.fill();ctx.fillStyle='#26384b';ctx.beginPath();ctx.arc(766,98,28,0,Math.PI*2);ctx.fill();
 for(let i=0;i<75;i++){let x=(i*137+37)%W,y=(i*71+19)%245;rect(x,y,2,2,i%5?'#b4d2da':'#f1ddb1');}
 const off=cityOffset*.25;for(let layer=0;layer<2;layer++){const step=layer?150:115;for(let i=-1;i<10;i++){let raw=i*step-(off%(step));let x=raw;let hash=(i+10)*37+layer*19;let bw=step-(layer?18:12),bh=100+((hash*17)%150);let y=ground-bh-(layer?25:0);rect(x,y,bw,bh,layer?'#19283a':'#202f40');rect(x,y,bw,4,layer?'#364759':'#405466');if(hash%4===0)rect(x+bw*.55,y-24,18,24,'#1c2a3d');for(let wy=y+14;wy<ground-18;wy+=17)for(let wx=x+10;wx<x+bw-8;wx+=18){if(((Math.floor(wx+wy)+hash)%5)!==0)rect(wx,wy,5,8,((Math.floor(wx/18)+Math.floor(wy/17)+hash)%3===0)?'#e5b968':'#7096a1');}}}
 // Rooftops and fire escapes
 rect(0,ground,W,H-ground,'#111b27');rect(0,ground,W,5,'#546675');for(let i=0;i<5;i++){let x=((i*230-cityOffset*.8)%1120+1120)%1120-80;rect(x,ground-52,70,52,'#172534');rect(x+8,ground-58,48,8,'#334454');rect(x+20,ground-84,3,28,'#536371');rect(x+20,ground-84,22,3,'#536371');rect(x+39,ground-81,3,20,'#536371');}
 // web strands between rooftop anchors
 ctx.strokeStyle='#78bdc5';ctx.globalAlpha=.38;ctx.lineWidth=1;for(let i=0;i<5;i++){const x=((i*245-cityOffset*1.2)%1100+1100)%1100-70;ctx.beginPath();ctx.moveTo(x,ground-120);ctx.lineTo(x+95,ground-175);ctx.stroke();}ctx.globalAlpha=1;
}
function drawHero(){const x=Math.round(player.x),y=Math.round(player.y),run=Math.abs(player.vx)>25,step=run?Math.sin(player.anim*15)*4:0;ctx.save();ctx.translate(x,y);if(player.face<0)ctx.scale(-1,1);const flash=player.invuln>0&&Math.floor(worldTime*18)%2===0;const red=flash?'#f4fcff':'#e4434b',dark='#8f2838',blue='#16354b';
 // shadow
 ctx.globalAlpha=.35;rect(-17,58,35,5,'#02070d');ctx.globalAlpha=1;
 // legs and torso
 rect(-12,33+step,10,22,blue);rect(3,33-step,10,22,blue);rect(-13,51+step,13,6,'#111a28');rect(2,51-step,14,6,'#111a28');rect(-14,7,28,29,red);rect(-17,11,5,23,dark);rect(12,11,5,23,dark);
 // spider motif
 rect(-2,13,4,10,'#f1e8dc');rect(-7,17,5,3,'#f1e8dc');rect(2,17,5,3,'#f1e8dc');rect(-8,21,4,4,'#f1e8dc');rect(4,21,4,4,'#f1e8dc');
 // arms
 let arm=player.attack>0?14:Math.sin(player.anim*11)*2;rect(-20,11+arm,6,20,'#17364c');rect(-22,27+arm,7,7,red);rect(14,11-arm,6,20,'#17364c');rect(16,26-arm,7,7,red);
 // head, mask lenses
 rect(-12,-13,24,22,red);rect(-9,-16,18,5,dark);rect(-9,-4,7,4,'#f1f3e9');rect(3,-4,7,4,'#f1f3e9');rect(-8,-3,5,2,'#8dc6cf');rect(3,-3,5,2,'#8dc6cf');ctx.restore();
}
function drawEnemy(e){const x=Math.round(e.x),y=Math.round(e.y);ctx.save();if(Math.abs(e.x-player.x)<220)ctx.globalAlpha=1;rect(x-18,y+47,38,5,'#03080e');let col=e.boss?'#cf9b43':'#303a49',accent=e.hit?'#f4e3ba':e.boss?'#e4434b':'#9a5360';rect(x-13,y+8,26,30,col);rect(x-17,y+14,6,22,accent);rect(x+11,y+14,6,22,accent);rect(x-12,y-11,24,20,'#282d38');rect(x-10,y-2,7,3,'#f3c96b');rect(x+3,y-2,7,3,'#f3c96b');rect(x-11,y+37,8,14,'#283544');rect(x+4,y+37,8,14,'#283544');if(e.stun>0){for(let i=0;i<3;i++){rect(x-14+i*13,y-25+Math.sin(worldTime*8+i)*3,5,5,'#59d5e5');}}if(e.boss){rect(x-25,y-38,50,5,'#293a4c');rect(x-25,y-38,50*clamp(e.hp/e.maxHp,0,1),5,'#e4434b');}ctx.restore();}
function draw(){ctx.clearRect(0,0,W,H);drawCity();if(state==='game'||state==='pause'||state==='end'){for(const e of enemies)if(!e.dead)drawEnemy(e);drawHero();for(const p of particles){ctx.globalAlpha=clamp(p.life*2,0,1);rect(p.x,p.y,4,4,p.color);}ctx.globalAlpha=1;if(hitFlash>0){ctx.fillStyle=`rgba(228,67,75,${hitFlash*.35})`;ctx.fillRect(0,0,W,H);}}
 else {player.x=710;player.y=ground-64;player.face=-1;drawHero();}
 // cinematic foreground framing
 if(state==='title'){ctx.fillStyle='rgba(4,11,20,.14)';ctx.fillRect(0,0,W,H);}
}
function resumeAfterMenu(){if(previousMenu==='pause')screen('pause');else if(previousMenu==='game')screen('game');else screen('title');}
function restartCurrent(){if(!active)return;if(active.kind==='side'){startSide(active.index);}else startChapter(active.index);}
$('#newGame').addEventListener('click',()=>{hp=100;save.health=100;persist();startChapter(0);});
$('#continueGame').addEventListener('click',()=>{startChapter(clamp(save.chapter,0,save.unlocked));});
$('#openMenu').addEventListener('click',()=>startMenu('title','chapters'));
$('#closeMenu').addEventListener('click',resumeAfterMenu);
$('#pauseButton').addEventListener('click',openPause);
$('#skipScene').addEventListener('click',()=>{sceneData=null;launchMission();});
$('#sceneNext').addEventListener('click',advanceScene);
$('#dialogueNext').addEventListener('click',()=>$('#dialogue').classList.add('hidden'));
$('#nextMission').addEventListener('click',()=>{if(active?.kind==='side'){screen('title');active=null;return;}const next=active?.index>=8?0:(active?.index??0)+1;startChapter(next);});
$('#backToCity').addEventListener('click',()=>{screen('title');active=null;save.health=hp;persist();});
all('[data-pause]').forEach(b=>b.addEventListener('click',()=>{const a=b.dataset.pause;if(a==='resume')screen('game');if(a==='restart')restartCurrent();if(a==='map'||a==='suits')startMenu('pause',a);if(a==='save'){save.health=hp;persist();msg('PROGRESSO SALVO');}if(a==='home'){save.health=hp;persist();active=null;screen('title');}}));
window.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code))e.preventDefault();if(e.repeat)return;if(e.code==='Escape'){if(state==='game')openPause();else if(state==='pause')screen('game');else if(state==='menu')resumeAfterMenu();return;}if(state==='cutscene'&&(e.code==='Enter'||e.code==='Space')){advanceScene();return;}if(state==='game'){keys[e.code]=true;if(e.code==='KeyJ')held.attack=true;if(e.code==='KeyK')held.web=true;if(e.code==='KeyL')held.dodge=true;}});
window.addEventListener('keyup',e=>{keys[e.code]=false;if(e.code==='KeyJ')held.attack=false;if(e.code==='KeyK')held.web=false;if(e.code==='KeyL')held.dodge=false;});
window.addEventListener('blur',()=>{keys={};held={};});
for(const button of all('[data-action]')){const action=button.dataset.action;button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture?.(e.pointerId);if(action==='left'||action==='right'||action==='jump')held[action]=true;else {held[action]=true;if(action==='dodge')dodge();if(action==='web')webShot();if(action==='attack')attack();}});const release=e=>{e.preventDefault();held[action]=false;};button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',()=>{held[action]=false;});}
$('#app').addEventListener('contextmenu',e=>e.preventDefault());
function frame(timestamp){const dt=Math.min(.04,(timestamp-(lastTime||timestamp))/1000);lastTime=timestamp;update(dt);draw();requestAnimationFrame(frame);}
$('#titleChapter').textContent=String(save.chapter+1).padStart(2,'0');
render();updateHud();requestAnimationFrame(frame);
})();
