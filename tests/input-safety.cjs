'use strict';
// Event-level regression checks for the shared solo/online input guard.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function game(mode) {
 const docEvents = new Map(),winEvents = new Map();
 function listen(map,type,listener) {
  if(!map.has(type))map.set(type,[]);
  map.get(type).push(listener);
 }
 class FakeElement {
  constructor(zone=false,canvas=false){this.zone=zone;this.canvas=canvas;this.captures=[];}
  closest(selector){
   if(this.zone && selector.includes('#cpuMoveZone'))return this;
   if(this.canvas && selector.includes('#field'))return this;
   return null;
  }
  setPointerCapture(id){this.captures.push(id);}
 }
 const body = {classList:{
  contains:name=>name===mode,
  toggle:()=>{}
 }};
 const document = {body,addEventListener:(t,fn)=>listen(docEvents,t,fn)};
 const window = {addEventListener:(t,fn)=>listen(winEvents,t,fn)};
 const sandbox = {
  document,window,Element:FakeElement,keys:{},touch:null,down:false,
  navigator:{userAgent:'unit test',maxTouchPoints:0},
  screen:{width:1200,height:900},
  matchMedia:()=>({matches:false}),queueMicrotask,console,
  setInterval:()=>0, // timers are tested separately in a browser, never run in the VM fixture
  MutationObserver:class { observe(){} disconnect(){} },
  releaseStick:()=>{sandbox.releases++},releases:0
 };
 vm.runInNewContext(fs.readFileSync('public/mobile-input-v70.js','utf8'),sandbox,{filename:'mobile-input-v70.js'});
 const emit=(t,e={},onWindow=false)=>{
  for(const fn of (onWindow?winEvents:docEvents).get(t)||[])fn(e);
 };
 return {sandbox,emit,zone:new FakeElement(true),field:new FakeElement(false,true),other:new FakeElement()};
}
async function main(){
 for(const mode of ['in-match','online-battle']) {
  const g=game(mode), {sandbox:s,emit,zone}=g;
  emit('pointerdown',{pointerType:'touch',pointerId:1,target:zone});
  assert.equal(s.window.MojiInputSafety.activePointers(),1);
  s.touch={x:1,y:0};s.keys.d=true;
  emit('pointerup',{pointerId:1,target:zone});
  await Promise.resolve();
  assert.equal(s.touch,null,mode+' must clear stale joystick vector');
  assert.equal(s.keys.d,false,mode+' must clear stale right movement');
  assert.equal(s.window.MojiInputSafety.activePointers(),0);
  assert.ok(s.releases>0,mode+' must release thumbstick when available');

  emit('keydown',{key:'w',target:zone});
  emit('pointerdown',{pointerType:'touch',pointerId:2,target:zone});
  emit('pointerdown',{pointerType:'touch',pointerId:3,target:zone});
  s.keys.d=true;s.touch={x:1,y:0};
  emit('pointercancel',{pointerId:2,target:zone});
  await Promise.resolve();
  assert.notEqual(s.touch,null,'one remaining joystick finger must keep moving');
  emit('lostpointercapture',{pointerId:3,target:zone});
  await Promise.resolve();
  assert.equal(s.touch,null);
  assert.equal(s.keys.w,true,'held keyboard movement must survive touch release');
  assert.equal(s.keys.d,false);

  emit('keyup',{key:'w',target:zone},true);
  await Promise.resolve();
  assert.equal(s.keys.w,false);
  emit('keydown',{key:'ArrowRight',target:zone});
  s.keys.d=true;s.touch={x:1,y:0};s.down=true;
  emit('blur',{},true);
  assert.equal(s.touch,null);
  assert.equal(s.keys.d,false);
  assert.equal(s.down,false);

  // Mouse auto-fire must clear even if the up event is delivered to window
  // instead of the canvas (e.g. pointer capture or a drag off the field).
  const field=g.field;
  emit('pointerdown',{pointerType:'mouse',pointerId:20,button:0,target:field});
  assert.equal(s.window.MojiInputSafety.firingPointers(),1);
  assert.deepEqual(field.captures,[20]);
  s.down=true;
  emit('pointerup',{pointerId:20,pointerType:'mouse'},true);
  assert.equal(s.window.MojiInputSafety.firingPointers(),0);
  assert.equal(s.down,false,mode+' released mouse hold must not keep auto-firing');

  emit('pointerdown',{pointerType:'touch',pointerId:21,target:field});
  s.down=true;
  emit('pointercancel',{pointerId:21,pointerType:'touch'},true);
  assert.equal(s.down,false,mode+' cancelled long touch must stop firing');

  emit('pointerdown',{pointerType:'mouse',pointerId:22,button:0,target:field});
  s.down=true;
  emit('pointermove',{pointerType:'mouse',pointerId:22,buttons:0});
  assert.equal(s.down,false,mode+' missed mouseup should clear on next mouse move');

  emit('keydown',{key:' ',target:field});
  s.down=true;
  emit('keyup',{key:' ',target:field},true);
  await Promise.resolve();
  assert.equal(s.down,false,mode+' space auto-fire must release');

  emit('pointerdown',{pointerType:'mouse',pointerId:23,button:0,target:field});
  s.down=true;
  emit('blur',{},true);
  assert.equal(s.down,false,mode+' blur during held fire must release');
  assert.equal(s.window.MojiInputSafety.firingPointers(),0);

  emit('pointerdown',{pointerType:'touch',pointerId:4,target:zone});
  s.touch={x:1,y:0};s.keys.d=true;
  emit('touchcancel',{touches:[]});
  await Promise.resolve();
  assert.equal(s.touch,null,mode+' must handle touchcancel without pointerup');
  assert.equal(s.keys.d,false);
  console.log(mode+': movement release, multi-touch, keyup and blur verified');
 }
}
main().catch(err=>{console.error(err);process.exitCode=1});
