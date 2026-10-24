/* 文字武装 — ロマン砲専用の豪華な描画（ゲーム判定やSEには干渉しない）。
   金／白／朱色のチャージ、残光を伴う砲弾、着弾衝撃波。
   K.O.・撃破などの文字演出は一切描かない。 */
(function(){
 'use strict';
 const TAU=Math.PI*2;
 const clamp=v=>Math.max(0,Math.min(1,v));
 function ring(c,x,y,r,color,width,alpha=1){
  c.globalAlpha=alpha;c.strokeStyle=color;c.lineWidth=width;
  c.beginPath();c.arc(x,y,r,0,TAU);c.stroke();
 }
 function drawCharge(c,x,y,t,progress=0.5){
  if(!c)return;
  const p=clamp(progress),pulse=Math.sin(t/90)*2.7;
  c.save();c.translate(x,y);c.lineJoin='round';
  c.shadowColor='#ffc260';c.shadowBlur=18;
  ring(c,0,0,32+p*15+pulse,'#ffefa8',3);
  ring(c,0,0,47+p*20-pulse,'#ff993d',2.5,.85);
  // Rotating gold seals and glyph sparks circle the charger.
  for(let i=0;i<12;i++){
   const a=i*TAU/12+(t/800)*(i%2?1:-1);
   const radius=57+p*23+(i%3)*5;
   const xx=Math.cos(a)*radius,yy=Math.sin(a)*radius;
   const sz=3.5+(i%3)*1.3+p*2;
   c.fillStyle=i%3===0?'#ffffff':i%2?'#ff8b41':'#ffde79';
   c.beginPath();c.moveTo(xx,yy-sz);c.lineTo(xx+sz*.5,yy);
   c.lineTo(xx,yy+sz);c.lineTo(xx-sz*.5,yy);c.closePath();c.fill();
  }
  c.rotate(-t/580);
  c.strokeStyle='#ffc86a';c.lineWidth=2;c.globalAlpha=.7+.2*p;
  for(let i=0;i<6;i++){
   const a=i*TAU/6;c.beginPath();c.moveTo(Math.cos(a)*41,Math.sin(a)*41);
   c.lineTo(Math.cos(a)*57,Math.sin(a)*57);c.stroke();
  }
  c.restore();
 }
 function drawShot(c,x,y,angle,t){
  if(!c)return;
  const a=Number.isFinite(angle)?angle:0;
  c.save();c.translate(x,y);c.rotate(a);
  c.lineJoin='round';c.textAlign='center';c.textBaseline='middle';
  // Directional tail: layers of flame and a piercing white-gold core.
  c.shadowColor='#ff8728';c.shadowBlur=23;
  const flicker=Math.sin(t/75)*5;
  const tail=c.createLinearGradient(-132,0,22,0);
  tail.addColorStop(0,'#ff701000');tail.addColorStop(.32,'#ff802755');
  tail.addColorStop(.7,'#ffd45fc4');tail.addColorStop(1,'#fffce9');
  c.fillStyle=tail;c.beginPath();c.moveTo(28,-19);
  c.quadraticCurveTo(-40,-29,-130-flicker,0);
  c.quadraticCurveTo(-40,29,28,19);c.closePath();c.fill();
  c.shadowBlur=12;c.fillStyle='#ffe5a6';
  c.beginPath();c.moveTo(26,-10);c.lineTo(-90+flicker,0);c.lineTo(26,10);c.closePath();c.fill();
  c.shadowColor='#fff9e7';c.shadowBlur=24;
  c.fillStyle='#fffdf3';c.beginPath();c.ellipse(8,0,30,24,0,0,TAU);c.fill();
  c.strokeStyle='#ff9a4c';c.lineWidth=3;c.beginPath();c.ellipse(8,0,35,29,0,0,TAU);c.stroke();
  c.shadowBlur=5;c.fillStyle='#a74e20';c.font='900 22px serif';c.fillText('砲',8,1);
  // A bright wing of sparks gives the slow, lethal shell a heavy silhouette.
  for(let i=0;i<13;i++){
   const phase=i*2.39996+t/225,dist=33+(i%5)*15;
   const xx=-15+Math.cos(phase)*dist*.75;
   const yy=Math.sin(phase)*dist*.62;
   c.strokeStyle=i%3===0?'#ffffff':i%2?'#ffad55':'#ffe6a0';
   c.lineWidth=i%3===0?2.5:1.5;c.globalAlpha=.55+(i%4)*.12;
   c.beginPath();c.moveTo(xx,yy);c.lineTo(xx-9-(i%4)*3,yy+(i%2?4:-4));c.stroke();
  }
  c.restore();
 }
 function drawImpact(c,x,y,age){
  const p=clamp(age/720);
  if(!c||p>=1)return;
  const fade=Math.pow(1-p,1.3),radius=16+p*116;
  c.save();c.translate(x,y);c.globalAlpha=fade;
  c.shadowColor='#ffb347';c.shadowBlur=24*(1-p)+4;
  const glow=c.createRadialGradient(0,0,0,0,0,95+p*45);
  glow.addColorStop(0,'#fffff4');glow.addColorStop(.19,'#fff4abdd');
  glow.addColorStop(.48,'#ff933c80');glow.addColorStop(1,'#ff662000');
  c.fillStyle=glow;c.beginPath();c.arc(0,0,95+p*45,0,TAU);c.fill();
  ring(c,0,0,radius,'#fff4b6',7*(1-p)+2);
  ring(c,0,0,radius*.73,'#ff9c48',5*(1-p)+1);
  // Particle shrapnel radiates out from the point of impact, not screen-wide.
  for(let i=0;i<23;i++){
   const a=i*2.39996,dist=26+p*(68+(i%4)*20);
   const xx=Math.cos(a)*dist,yy=Math.sin(a)*dist;
   const len=7+(i%4)*3;
   c.strokeStyle=i%3===0?'#fffefd':i%3===1?'#ffe28e':'#ff793a';
   c.lineWidth=2+(i%3);c.beginPath();
   c.moveTo(xx,yy);c.lineTo(xx+Math.cos(a)*len,yy+Math.sin(a)*len);c.stroke();
  }
  c.restore();
 }
 window.MojiRomanFX=Object.freeze({drawCharge,drawShot,drawImpact});
})();
