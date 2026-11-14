(() => {
  'use strict';
  const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
  const mapCanvas = document.getElementById('map'), mapCtx = mapCanvas.getContext('2d');
  const $ = id => document.getElementById(id);
  const intro = $('intro'), menu = $('menu'), hud = $('hud'), dialog = $('dialog');
  const W = 640, H = 360, WORLD_W = 2200, WORLD_H = 1800;
  const keys = new Set(), camera = { x: 0, y: 0 };
  const state = { scene: 'intro', introAt: performance.now(), introDuration: 17000, last: 0, time: 0, sound: true, paused: false, toastUntil: 0, toastText: '', started: false, missionDone: false, luggage: [] };
  const player = { x: 1060, y: 1290, face: 1, walk: 0, speed: 116 };
  const delivery = { x: 1060, y: 1320, r: 38 };
  let audio = null;

  const rnd = (seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; })(7021);
  const roadsX = [220, 620, 1020, 1420, 1820];
  const roadsY = [180, 580, 980, 1380];
  const buildings = [], parks = [], props = [], cars = [];
  function makeCity() {
    for (let yi = 0; yi < roadsY.length - 1; yi++) for (let xi = 0; xi < roadsX.length - 1; xi++) {
      const x0 = roadsX[xi] + 68, y0 = roadsY[yi] + 68, bw = roadsX[xi + 1] - roadsX[xi] - 136, bh = roadsY[yi + 1] - roadsY[yi] - 136;
      if (rnd() < .18) {
        parks.push({ x: x0 + 8, y: y0 + 8, w: bw - 16, h: bh - 16, trees: [] });
        const park = parks[parks.length - 1];
        for (let i = 0; i < 8; i++) park.trees.push({ x: park.x + 15 + rnd() * (park.w - 30), y: park.y + 15 + rnd() * (park.h - 30), s: 7 + rnd() * 5 });
      } else {
        const count = 2 + Math.floor(rnd() * 3);
        for (let i = 0; i < count; i++) {
          const cols = count > 2 ? 2 : 1, rows = Math.ceil(count / cols), cellW = bw / cols, cellH = bh / rows;
          const cx = x0 + (i % cols) * cellW, cy = y0 + Math.floor(i / cols) * cellH;
          const pad = 8 + rnd() * 9, w = Math.max(43, cellW - pad * 2), h = Math.max(42, cellH - pad * 2);
          buildings.push({ x: cx + pad, y: cy + pad, w, h, tone: Math.floor(rnd() * 4), roof: rnd(), height: 4 + Math.floor(rnd() * 9), sign: rnd() > .78 });
        }
      }
    }
    for (let i = 0; i < 84; i++) {
      const x = 70 + rnd() * (WORLD_W - 140), y = 90 + rnd() * 1480;
      if (buildings.some(b => x > b.x - 12 && x < b.x + b.w + 12 && y > b.y - 12 && y < b.y + b.h + 12)) continue;
      props.push({ x, y, type: rnd() > .5 ? 0 : 1 });
    }
    for (let i = 0; i < 23; i++) {
      const horizontal = rnd() > .5, road = horizontal ? roadsY[Math.floor(rnd() * roadsY.length)] : roadsX[Math.floor(rnd() * roadsX.length)];
      cars.push({ x: horizontal ? 90 + rnd() * 2010 : road + (rnd() > .5 ? 24 : -24), y: horizontal ? road + (rnd() > .5 ? 23 : -23) : 90 + rnd() * 1490, horizontal, color: ['#e9b875','#d76f5f','#76a6a0','#e5e0cb','#68769a'][Math.floor(rnd() * 5)], dir: rnd() > .5 ? 1 : -1 });
    }
  }
  makeCity();
  state.luggage = [{ x: 660, y: 355, found: false, color: '#e87c58' }, { x: 1460, y: 760, found: false, color: '#e8b94f' }, { x: 1860, y: 1180, found: false, color: '#78a9ad' }];

  function rect(x,y,w,h,color) { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), Math.ceil(w), Math.ceil(h)); }
  function line(x1,y1,x2,y2,color,width=1) { ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke(); }
  function text(str,x,y,size,color,font='Outfit',align='left') { ctx.font=`${size}px ${font}`;ctx.textAlign=align;ctx.fillStyle=color;ctx.fillText(str,x,y); }
  function box(x,y,w,h,c1,c2) { rect(x+2,y+3,w,h,'#10172230');rect(x,y,w,h,c1);rect(x+3,y+3,w-6,Math.max(3,h-6),c2); }
  function drawIntro(t) {
    const p = Math.min(1, t / state.introDuration), phase = p * 3;
    const sky = ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#52789a');sky.addColorStop(.52,'#e58e78');sky.addColorStop(1,'#f3bf85');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    // distant clouds and the warm horizon
    rect(0,210,640,34,'#f0a57e');rect(0,224,640,4,'#ffd392');
    for (let i=0;i<11;i++){const x=((i*97-t*.009)%760+760)%760-40,y=36+(i*47)%112;rect(x,y,31,3,'#ffffff27');rect(x+8,y-3,26,3,'#ffffff20');}
    // ocean, shoreline, islands and the city skyline grow into view during approach
    rect(0,235,640,125,'#386f83');
    for(let i=0;i<18;i++){const xx=(i*47+(t*.018*(i%3+1)))%660-10, yy=247+(i*31)%105;rect(xx,yy,22+(i%4)*7,2,i%2?'#79a0a0':'#527f8b');}
    rect(0,232,640,5,'#f4cb9a');
    const cityFade=Math.min(1,Math.max(0,(p-.08)*2.5));ctx.globalAlpha=cityFade;
    // coastal silhouette
    const skyline=[34,76,51,100,67,48,124,80,54,94,63,131,75,54,89,116,65,46,95,71,109,61,83,52,105,73,45,91,67,119,55,78];
    let sx=0;for(let i=0;i<skyline.length;i++){const ww=12+(i%3)*3,hh=skyline[i]*(.45+phase*.10);rect(sx,232-hh,ww,hh,'#48566a');rect(sx+3,238-hh,2,2,'#ffd18d');sx+=ww+3;}
    ctx.globalAlpha=1;
    // runway foreground sweeps into view in the final approach
    if(p>.48){const a=Math.min(1,(p-.48)*3);ctx.globalAlpha=a;rect(0,294,640,66,'#59645e');rect(0,294,640,4,'#d9b685');for(let i=0;i<10;i++){let xx=((i*90-t*.04)%700+700)%700;rect(xx,323,32,3,'#f8e9bd');}ctx.globalAlpha=1;}
    // plane, descending and moving across screen
    const px=60+p*490, py=52+p*171+Math.sin(t*.001)*4, scale=1+Math.min(.5,p*.42);
    ctx.save();ctx.translate(px,py);ctx.scale(scale,scale);ctx.rotate(.09+p*.04);
    rect(-33,0,66,8,'#e8e5d7');rect(-19,-15,37,8,'#d1d1c5');rect(-8,-27,19,10,'#c7c9c4');rect(-8,8,17,13,'#c6c8c0');rect(25,1,7,5,'#ffb468');rect(-33,1,6,5,'#e67767');rect(-5,-5,18,3,'#88a4a7');rect(4,-4,4,3,'#ffcc7b');
    ctx.restore();
    // overlay subtle camera grain pixels
    for(let i=0;i<22;i++){const xx=(i*137+Math.floor(t*.016))%640, yy=(i*83+Math.floor(t*.009))%360;rect(xx,yy,1,1,'#ffffff28');}
    const copy = p<.30 ? ['Acima das nuvens.','A costa aparece no horizonte.'] : p<.66 ? ['A cidade lá embaixo.','Vesper Coast — população: 2,8 milhões.'] : ['Pés no chão.','Toda grande história começa com uma chegada.'];
    $('intro-line').textContent=copy[0];$('intro-sub').textContent=copy[1];
    const elapsed=Math.floor(t/1000);document.querySelector('.intro-time').textContent=`00:${String(elapsed).padStart(2,'0')}`;
    $('intro-progress').style.width=`${p*100}%`;
    if(p>=1) showMenu();
  }

  function drawMenuBackdrop() {
    const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#efaa8a');g.addColorStop(.43,'#e5a078');g.addColorStop(.44,'#e2cb9b');g.addColorStop(.45,'#75a5a1');g.addColorStop(1,'#3e717e');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    rect(435,49,61,61,'#ffe6ad');for(let i=0;i<14;i++){let x=i*51-10,h=45+(i*73%95);rect(x,201-h,30,h,'#40535a');rect(x+6,208-h,2,2,'#ffd28c');rect(x+17,208-h,2,2,'#ffd28c');}
    rect(0,201,640,5,'#f6d1a2');rect(0,206,640,6,'#69766e');
    for(let i=0;i<10;i++){let x=i*72+8;rect(x,216,3,33,'#564d3d');rect(x-9,212,22,4,'#42654c');rect(x-6,207,16,5,'#42654c');}
    for(let i=0;i<16;i++){let yy=240+i*9;rect((i*71)%640,yy,35,2,'#83a3a0');}
    ctx.fillStyle='#192431';ctx.globalAlpha=.42;ctx.fillRect(0,0,640,360);ctx.globalAlpha=1;
    const shade=ctx.createLinearGradient(0,0,540,0);shade.addColorStop(0,'#101827');shade.addColorStop(.62,'#101827d9');shade.addColorStop(1,'#10182728');ctx.fillStyle=shade;ctx.fillRect(0,0,W,H);
  }
  function startIntro(){state.scene='intro';state.introAt=performance.now();state.paused=false;intro.classList.remove('hidden');intro.style.opacity='1';menu.classList.add('hidden');hud.classList.add('hidden');dialog.classList.add('hidden');}
  function showMenu(){if(state.scene==='menu')return;state.scene='menu';intro.classList.add('hidden');menu.classList.remove('hidden');hud.classList.add('hidden');$('continue-button').classList.toggle('hidden',!state.started);$('play-label').textContent=state.started?'RETOMAR JOGO':'COMEÇAR JORNADA';}
  function beginGame(){state.scene='game';state.started=true;state.paused=false;menu.classList.add('hidden');intro.classList.add('hidden');hud.classList.remove('hidden');dialog.classList.add('hidden');updateMission();if(state.sound) startAmbient();}
  function returnMenu(){if(state.scene==='game'){state.paused=true;showMenu();}}
  function startAmbient(){try{if(!audio){audio=new(window.AudioContext||window.webkitAudioContext)();}if(audio.state==='suspended')audio.resume();}catch{}}
  function beep(freq=520,duration=.08){if(!state.sound)return;try{startAmbient();const o=audio.createOscillator(),g=audio.createGain();o.type='triangle';o.frequency.value=freq;g.gain.setValueAtTime(.035,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration);}catch{}}

  function drawTree(x,y,s=10){rect(x-2,y-2,s+3,5,'#243b37');rect(x,y-s*.65,s,7,'#315a49');rect(x+2,y-s,s-3,6,'#467052');rect(x+3,y-s-2,3,3,'#62845b');rect(x+s/2,y+2,3,5,'#795b43');}
  function drawBuilding(b){const palette=[['#d2b798','#b69d81','#897b69'],['#b7b9aa','#92998f','#687974'],['#cf9e88','#b27d70','#79645d'],['#b9c9bd','#91aaa5','#718a8a']][b.tone];
    rect(b.x-5,b.y-5,b.w+10,b.h+10,'#b4a890');rect(b.x,b.y,b.w,b.h,palette[1]);rect(b.x+3,b.y+3,b.w-6,b.h-8,palette[0]);
    rect(b.x+4,b.y+b.h-7,b.w-8,5,palette[2]);rect(b.x+5,b.y+5,b.w-10,2,'#efe0c4');
    if(b.roof>.32){rect(b.x+b.w*.19,b.y+b.h*.23,b.w*.57,b.h*.48,'#8e928b');rect(b.x+b.w*.24,b.y+b.h*.29,b.w*.47,b.h*.35,'#9b9d92');rect(b.x+b.w*.11,b.y+b.h*.17,6,6,'#737e79');}
    if(b.sign){rect(b.x+b.w*.29,b.y+b.h-13,b.w*.48,5,'#355d63');rect(b.x+b.w*.34,b.y+b.h-12,b.w*.25,1,'#e7c984');}
    for(let wx=b.x+9;wx<b.x+b.w-5;wx+=13){for(let wy=b.y+10;wy<b.y+b.h-13;wy+=15){rect(wx,wy,5,6,'#647f82');rect(wx+1,wy+1,3,4,(Math.floor(wx+wy)%2)?'#e5bf7d':'#c6a877');}}
  }
  function drawPark(p){rect(p.x,p.y,p.w,p.h,'#75926a');rect(p.x+5,p.y+5,p.w-10,p.h-10,'#85a273');rect(p.x+p.w*.45,p.y+6,10,p.h-12,'#c7b98d');rect(p.x+6,p.y+p.h*.47,p.w-12,9,'#c7b98d');for(const t of p.trees)drawTree(t.x,t.y,t.s);}
  function drawCar(car){const x=car.x,y=car.y;ctx.save();ctx.translate(x,y);if(!car.horizontal)ctx.rotate(Math.PI/2);if(car.dir<0)ctx.rotate(Math.PI);rect(-10,-6,21,13,'#27353b');rect(-9,-5,19,10,car.color);rect(-5,-4,9,8,'#718e91');rect(-3,-4,4,8,'#9ab1aa');rect(-10,-4,2,3,'#f3d09a');rect(8,2,2,3,'#f0876f');rect(-7,-8,4,2,'#22292e');rect(4,-8,4,2,'#22292e');rect(-7,6,4,2,'#22292e');rect(4,6,4,2,'#22292e');ctx.restore();}
  function drawRoads(){
    rect(0,0,WORLD_W,WORLD_H,'#91a17a');
    // sandy coast and ocean at the southern edge
    rect(0,1510,WORLD_W,120,'#d7c18d');rect(0,1628,WORLD_W,172,'#488493');
    for(let i=0;i<34;i++){let x=(i*89)%WORLD_W,y=1640+(i*47)%150;rect(x,y,26+(i%3)*12,2,i%2?'#79a8a0':'#61979a');}
    // city roads and sidewalks
    for(const x of roadsX){rect(x-45,0,90,1518,'#73766d');rect(x-39,0,78,1518,'#50575a');rect(x-47,0,4,1518,'#d4c59b');rect(x+43,0,4,1518,'#d4c59b');for(let y=10;y<1500;y+=37)rect(x-2,y,4,18,'#d4c99d');}
    for(const y of roadsY){rect(0,y-45,WORLD_W,90,'#73766d');rect(0,y-39,WORLD_W,78,'#50575a');rect(0,y-47,WORLD_W,4,'#d4c59b');rect(0,y+43,WORLD_W,4,'#d4c59b');for(let x=8;x<WORLD_W;x+=40)rect(x,y-2,20,4,'#d4c99d');}
    // pedestrian crossings
    for(const x of roadsX)for(const y of roadsY){for(let i=0;i<5;i++){rect(x-36+i*15,y-43,8,7,'#d8ceb1');rect(x-36+i*15,y+36,8,7,'#d8ceb1');rect(x-43,y-36+i*15,7,8,'#d8ceb1');rect(x+36,y-36+i*15,7,8,'#d8ceb1');}}
    // coast walk and palms
    rect(0,1503,WORLD_W,5,'#eee0b7');rect(0,1621,WORLD_W,5,'#f4dfb1');
    for(let x=40;x<WORLD_W;x+=95){rect(x,1540,3,23,'#765c44');rect(x-8,1537,20,4,'#36734f');rect(x-5,1532,14,5,'#447c53');}
  }
  function drawWorld(){
    drawRoads();
    for(const p of parks)if(p.x-camera.x<690&&p.x+p.w-camera.x>-10&&p.y-camera.y<390&&p.y+p.h-camera.y>-10)drawPark(p);
    for(const b of buildings)if(b.x-camera.x<680&&b.x+b.w-camera.x>-20&&b.y-camera.y<390&&b.y+b.h-camera.y>-20)drawBuilding(b);
    for(const p of props){if(Math.abs(p.x-player.x)<550&&Math.abs(p.y-player.y)<380){if(p.type===0){drawTree(p.x,p.y,8);}else{rect(p.x-4,p.y-4,9,9,'#b9b19a');rect(p.x-2,p.y-2,5,5,'#827d6c');}}}
    for(const car of cars)if(Math.abs(car.x-player.x)<500&&Math.abs(car.y-player.y)<360)drawCar(car);
    // small colorful kiosks by the boardwalk
    for(let i=0;i<7;i++){const x=180+i*285;rect(x,1562,45,19,'#ecd19b');rect(x+3,1558,39,7,i%2?'#d97563':'#477d78');rect(x+8,1567,9,12,'#87694c');}
    for(const bag of state.luggage)if(!bag.found)drawLuggage(bag);
    drawLuggageMarker();
    drawPlayer();
  }
  function drawLuggage(bag){const x=bag.x,y=bag.y;ctx.fillStyle='#ffe78d24';ctx.beginPath();ctx.arc(x,y,17+Math.sin(state.time*.006)*3,0,Math.PI*2);ctx.fill();rect(x-7,y-6,14,12,'#2e3738');rect(x-6,y-5,12,10,bag.color);rect(x-4,y-8,8,3,'#363d3c');rect(x-2,y-7,4,2,'#d8cba6');rect(x-5,y+5,3,2,'#333b3d');rect(x+3,y+5,3,2,'#333b3d');rect(x-2,y-1,4,2,'#f3d99a');}
  function drawLuggageMarker(){const target=state.luggage.find(b=>!b.found);const goal=target||(!state.missionDone?delivery:null);if(!goal)return;const x=goal.x,y=goal.y;if(x-camera.x<0||x-camera.x>W||y-camera.y<0||y-camera.y>H){const sx=Math.max(16,Math.min(W-16,x-camera.x)),sy=Math.max(16,Math.min(H-16,y-camera.y));text('◆',sx,sy,11,'#d8ff88','Arial','center');}}
  function drawPlayer(){const x=player.x,y=player.y,step=Math.floor(player.walk/7)%2;rect(x-7,y+6,15,4,'#17252b55');rect(x-5,y-11,10,14,'#dc9476');rect(x-6,y-15,12,6,'#30363a');rect(x-5,y-8,10,11,'#ee765f');rect(x-6,y+1,5,7,step?'#e4c69b':'#d7ba91');rect(x+1,y+1,5,7,step?'#d7ba91':'#e4c69b');rect(x-6,y+7,5,3,'#374653');rect(x+1,y+7,5,3,'#374653');rect(player.face>0?x+3:x-6,y-9,3,2,'#f1d8a4');}

  function blocked(x,y){if(x<12||y<12||x>WORLD_W-12||y>WORLD_H-190)return true;for(const b of buildings)if(x>b.x-9&&x<b.x+b.w+9&&y>b.y-7&&y<b.y+b.h+7)return true;return false;}
  function updateMission(){const count=state.luggage.filter(b=>b.found).length;$('count-label').textContent=state.missionDone?'COMPLETA':'MALAS';document.querySelectorAll('.count-dots i').forEach((el,i)=>el.classList.toggle('active',i<count));if(state.missionDone){$('mission-title').textContent='Bem-vindo à cidade';$('mission-detail').textContent='A primeira noite em Vesper é toda sua.';}else if(count===3){$('mission-title').textContent='Uma última parada';$('mission-detail').textContent='Leve as malas até o ponto de encontro na praia.';}else{$('mission-title').textContent='Bagagem extraviada';$('mission-detail').textContent=`Encontre as 3 malas perdidas pela cidade. (${count}/3)`;}}
  function interact(){if(state.scene!=='game')return;const bag=state.luggage.find(b=>!b.found&&Math.hypot(player.x-b.x,player.y-b.y)<35);if(bag){bag.found=true;beep(680,.13);toast(['Boa. Uma mala recuperada.','Mais uma parte da sua vida encontrada.','Última mala. Agora, para a praia.'][state.luggage.filter(b=>b.found).length-1]);updateMission();return;}if(state.luggage.every(b=>b.found)&&!state.missionDone&&Math.hypot(player.x-delivery.x,player.y-delivery.y)<48){state.missionDone=true;beep(790,.22);toast('MISSÃO COMPLETA · A CIDADE É SUA');updateMission();try{localStorage.setItem('neonCoastProgress','done');}catch{}return;}if(!state.luggage.every(b=>b.found))toast('Explore a cidade. Siga o marcador ◆');else toast('Aperte E para entregar as malas.');}
  function toast(message){state.toastText=message;state.toastUntil=performance.now()+2400;$('toast').textContent=message;$('toast').classList.remove('hidden');}

  function updateGame(dt){
    const dx=(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0),dy=(keys.has('ArrowDown')||keys.has('s')?1:0)-(keys.has('ArrowUp')||keys.has('w')?1:0);
    if(dx||dy){const norm=Math.hypot(dx,dy),mx=dx/norm*player.speed*dt,my=dy/norm*player.speed*dt;if(!blocked(player.x+mx,player.y))player.x+=mx;if(!blocked(player.x,player.y+my))player.y+=my;player.walk+=dt*16;if(dx)player.face=Math.sign(dx);}
    camera.x=Math.max(0,Math.min(WORLD_W-W,(player.x-W/2)*.12+(player.x-W/2)));camera.y=Math.max(0,Math.min(WORLD_H-H,(player.y-H/2)*.12+(player.y-H/2)));
    const near=state.luggage.some(b=>!b.found&&Math.hypot(player.x-b.x,player.y-b.y)<37)||(!state.missionDone&&state.luggage.every(b=>b.found)&&Math.hypot(player.x-delivery.x,player.y-delivery.y)<48);
    $('prompt').classList.toggle('hidden',!near);if(performance.now()>state.toastUntil)$('toast').classList.add('hidden');
    const minutes=Math.floor((18*60+42+state.time/1700)%1440);$('clock').textContent=`${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
  }
  function drawMap(){const c=mapCtx;c.fillStyle='#849473';c.fillRect(0,0,112,84);c.fillStyle='#596166';for(const x of roadsX)c.fillRect(x/WORLD_W*112-2,0,4,84);for(const y of roadsY)c.fillRect(0,y/WORLD_H*84-2,112,4);c.fillStyle='#d5c28e';c.fillRect(0,1510/WORLD_H*84,112,6);c.fillStyle='#3f7887';c.fillRect(0,1628/WORLD_H*84,112,84/WORLD_H*WORLD_H);for(const b of buildings){c.fillStyle=['#a9957b','#8e9b90','#ac8272','#9db2a8'][b.tone];c.fillRect(b.x/WORLD_W*112,b.y/WORLD_H*84,Math.max(1,b.w/WORLD_W*112),Math.max(1,b.h/WORLD_H*84));}for(const bag of state.luggage)if(!bag.found){c.fillStyle='#ffe18a';c.fillRect(bag.x/WORLD_W*112-1,bag.y/WORLD_H*84-1,3,3);}if(!state.missionDone&&state.luggage.every(b=>b.found)){c.fillStyle='#b6ff78';c.fillRect(delivery.x/WORLD_W*112-2,delivery.y/WORLD_H*84-2,4,4);}c.fillStyle='#fff';c.fillRect(player.x/WORLD_W*112-2,player.y/WORLD_H*84-2,4,4);c.fillStyle='#20272d';c.fillRect(player.x/WORLD_W*112-1,player.y/WORLD_H*84-1,2,2);}
  function frame(now){const dt=Math.min(.04,(now-state.last)/1000||0);state.last=now;state.time+=dt*1000;
    if(state.scene==='intro')drawIntro(now-state.introAt);
    else if(state.scene==='menu')drawMenuBackdrop();
    else if(state.scene==='game'){updateGame(dt);ctx.clearRect(0,0,W,H);ctx.save();ctx.translate(-Math.floor(camera.x),-Math.floor(camera.y));drawWorld();ctx.restore();drawMap();}
    requestAnimationFrame(frame);
  }

  function showDialog(kind){dialog.classList.remove('hidden');const title=$('dialog-title'),body=$('dialog-body'),kicker=$('dialog-kicker');
    if(kind==='controls'){kicker.textContent='GUIA RÁPIDO';title.textContent='Como jogar';body.innerHTML='<div class="dialog-row"><span>Mover pela cidade</span><span class="keycap">W A S D</span></div><div class="dialog-row"><span>Movimento alternativo</span><span class="keycap">↑ ↓ ← →</span></div><div class="dialog-row"><span>Pegar malas / interagir</span><span class="keycap">E</span></div><div class="dialog-row"><span>Pausar / voltar ao menu</span><span class="keycap">ESC</span></div><p class="dialog-note">Recupere as três malas espalhadas por Vesper Coast. Siga os losangos no minimapa e entregue tudo no calçadão da praia.</p>';}
    else if(kind==='settings'){kicker.textContent='PREFERÊNCIAS';title.textContent='Ajustes';body.innerHTML=`<div class="dialog-row toggle-row"><span>Efeitos sonoros</span><button id="sound-toggle">${state.sound?'LIGADO':'DESLIGADO'}</button></div><div class="dialog-row"><span>Controles</span><span class="keycap">WASD / TOQUE</span></div><p class="dialog-note">O áudio é gerado pelo navegador e só começa após sua primeira interação.</p>`;$('sound-toggle').onclick=()=>{state.sound=!state.sound;$('sound-toggle').textContent=state.sound?'LIGADO':'DESLIGADO';if(state.sound)beep();};}
    else{kicker.textContent='UMA PRODUÇÃO INDEPENDENTE';title.textContent='Créditos';body.innerHTML='<p class="dialog-note">NEON COAST<br><br>Uma aventura original em pixel art, feita com carinho para quem gosta de cidades à beira-mar e noites cheias de possibilidades.<br><br>Arte, código e trilha sonora procedural: Neon Coast Studio.<br><br>Obrigado por jogar.</p>';}
  }
  function closeDialog(){dialog.classList.add('hidden');}
  $('skip-intro').addEventListener('click',showMenu);
  $('play-button').addEventListener('click',()=>{beep(540);if(state.started&&state.scene==='menu'){beginGame();return;}beginGame();});
  $('continue-button').addEventListener('click',beginGame);
  $('controls-button').addEventListener('click',()=>showDialog('controls'));
  $('settings-button').addEventListener('click',()=>showDialog('settings'));
  $('credits-button').addEventListener('click',()=>showDialog('credits'));
  $('dialog-close').addEventListener('click',closeDialog);
  dialog.addEventListener('click',e=>{if(e.target===dialog)closeDialog();});
  window.addEventListener('keydown',e=>{const key=e.key.length===1?e.key.toLowerCase():e.key;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(key))e.preventDefault();
    if(key==='Escape'){if(!dialog.classList.contains('hidden'))closeDialog();else if(state.scene==='game')returnMenu();else if(state.scene==='menu'&&state.started)beginGame();return;}
    if(key==='Enter'&&state.scene==='intro'){showMenu();return;}
    if(state.scene==='game'&&key==='e'){interact();return;}
    keys.add(key);
  });
  window.addEventListener('keyup',e=>keys.delete(e.key.length===1?e.key.toLowerCase():e.key));
  window.addEventListener('blur',()=>keys.clear());
  document.querySelectorAll('[data-dir]').forEach(button=>{const dir=button.dataset.dir,key={up:'w',down:'s',left:'a',right:'d'}[dir];button.addEventListener('pointerdown',e=>{e.preventDefault();keys.add(key);button.setPointerCapture(e.pointerId);});const stop=()=>keys.delete(key);button.addEventListener('pointerup',stop);button.addEventListener('pointercancel',stop);button.addEventListener('lostpointercapture',stop);});
  document.querySelector('[data-action="interact"]').addEventListener('pointerdown',e=>{e.preventDefault();interact();});
  // Start the arrival cinematic immediately; the complete menu follows automatically.
  requestAnimationFrame(frame);
})();
