/* v10.0: Move the touchscreen joystick off the actual game canvas.
   The outer rail is intentionally small, but the entire ring is a hit target;
   the thumb, pointer capture and directional thresholds stay functional. */
(()=>{'use strict';
 function dock(screenSelector,arenaSelector,controlSelector){
  const screen=document.querySelector(screenSelector);
  const arena=screen?.querySelector(arenaSelector);
  const control=screen?.querySelector(controlSelector);
  if(!screen||!arena||!control)return false;
  let layout=arena.parentElement?.classList.contains('moji-map-with-stick')?arena.parentElement:null;
  if(!layout){
   layout=document.createElement('div');layout.className='moji-map-with-stick';
   arena.insertAdjacentElement('beforebegin',layout);
   layout.append(arena);
  }
  let rail=layout.querySelector(':scope > .moji-stick-dock');
  if(!rail){
   rail=document.createElement('div');rail.className='moji-stick-dock';
   rail.setAttribute('aria-label','マップ外の移動スティック');
   rail.setAttribute('role','group');
   layout.insertBefore(rail,arena);
  }
  if(control.parentElement!==rail)rail.append(control);
  return true;
 }
 function upgrade(){
  // The shared page has one of these modes; avoid moving anything in the
  // lobby, while preserving each control's original pointer event listeners.
  if(document.body.classList.contains('in-match')){
   dock('#gameScreen','.arena-shell','#cpuMoveZone');
  }
  if(document.body.classList.contains('online-battle')){
   dock('#gameArea','.arena-shell','#touchControls');
  }
 }
 function init(){
  upgrade();
  const observer=new MutationObserver(upgrade);
  observer.observe(document.body,{attributes:true,attributeFilter:['class']});
  // The old CPU canvas/joystick can be recreated at the match boundary.
  // Observe additions only, not per-frame text or combat state.
  for(const selector of ['#gameScreen','#gameArea']){
   const screen=document.querySelector(selector);
   if(screen)observer.observe(screen,{childList:true});
  }
  window.MojiStickDock={upgrade};
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();
