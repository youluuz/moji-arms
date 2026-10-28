/* Glyph Strike v14.2: reliable two-finger move/skill/fire transitions and input recovery.
   The first finger can remain captured by the joystick while the second picks a slot.
   Pointerdown fires immediately, before delayed touch click synthesis. */
(() => {
  'use strict';
  // Touch-capable desktop computers must keep PC controls, even with coarse pointers.
  const ua = navigator.userAgent || '';
  const coarse = matchMedia('(hover:none) and (pointer:coarse)').matches;
  const mobile = navigator.userAgentData?.mobile === true ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ||
    (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) ||
    (Math.min(screen.width, screen.height) <= 680 && navigator.maxTouchPoints > 0);
  document.body.classList.toggle('mobile-touch-input', Boolean(coarse && mobile));
  function onSlotPointerDown(event) {
    if (event.pointerType === 'mouse' || !document.body.classList.contains('in-match')) return;
    if (!(event.target instanceof Element)) return;
    const slot = event.target.closest('#weapons .weapon');
    if (!slot || !slot.isConnected) return;
    // Neutralize touch selection gestures for this finger, not the other pointer.
    if (event.cancelable) event.preventDefault();
    // Existing CPU code owns the actual selected slot, HUD and cooldown:
    // reuse its click handler instead of duplicating game state.
    slot.click();
  }
  document.addEventListener('pointerdown', onSlotPointerDown, true);

  // Input release safety: a cancelled touch, interrupted iframe, rotation or
  // missed key-up must never leave a player walking in one direction forever.
  // Both the CPU canvas and the embedded PvP frame load this script.
  const movePointers = new Set();
  const heldDirections = new Set();
  // Hold-to-fire pointers are separate from joystick fingers. When the mouse
  // releases outside the canvas, or the browser cancels a long touch, don't
  // leave the legacy 'down' flag stuck in autofire mode.
  const firingPointers = new Map(); // pointerId -> pointerType; mouseup must not cancel a separate touch
  let heldSpace = false;
  const arrowMap = {ArrowUp:'w',ArrowDown:'s',ArrowLeft:'a',ArrowRight:'d'};
  const arrows = {w:'ArrowUp',a:'ArrowLeft',s:'ArrowDown',d:'ArrowRight'};
  const moveKeys = ['w','a','s','d'];
  const keyLastSeen = new Map();
  let spaceLastSeen = 0;
  const playing = () => document.body.classList.contains('in-match') ||
                        document.body.classList.contains('online-battle');
  const movementKey = e => arrowMap[e.key] || (moveKeys.includes(e.key.toLowerCase()) ? e.key.toLowerCase() : null);
  const editable = element => Boolean(element?.closest?.('input,textarea,select,[contenteditable="true"]'));

  function syncDirections(preserveKeyboard) {
    if (typeof keys === 'undefined' || !keys) return;
    for (const key of moveKeys) {
      const pressed = preserveKeyboard && heldDirections.has(key);
      keys[key] = pressed;
      // The legacy CPU loop also accepts Arrow* properties.
      if (Object.prototype.hasOwnProperty.call(keys, arrows[key])) keys[arrows[key]] = pressed;
    }
  }
  function stopFiring(force=false) {
    if(force){firingPointers.clear();heldSpace=false;spaceLastSeen=0;}
    if(typeof down !== 'undefined')
      down = !force && (firingPointers.size>0 || heldSpace);
  }
  function releaseMovement(preserveKeyboard=false) {
    movePointers.clear();
    if (!preserveKeyboard){heldDirections.clear();keyLastSeen.clear();}
    // This is the CPU joystick's movement vector. A missed pointerup in the
    // old handler otherwise leaves it non-null for every subsequent frame.
    if (typeof touch !== 'undefined') touch = null;
    // PvP's original joystick keeps a pointer ID and its own thumb position.
    if (typeof cpuStickRelease === 'function') cpuStickRelease();
    if (typeof releaseStick === 'function') releaseStick();
    syncDirections(preserveKeyboard);
    if (!preserveKeyboard && typeof down !== 'undefined') down = false;
  }
  // Capture the physical press on the battlefield. A pointerup outside the
  // canvas still reaches it, while cancelled/dragged/blurred presses are cleared.
  // Mouse and touch have independent pointer IDs: firing never steals the stick.
  document.addEventListener('pointerdown', e => {
    if(!playing() || !(e.target instanceof Element))return;
    const canvas=e.target.closest('#field,#arena');
    if(!canvas || (e.pointerType==='mouse' && e.button!==0))return;
    firingPointers.set(e.pointerId,e.pointerType);
    // Only the original battlefield handler may capture this pointer.
    // Capturing from document-capture phase can steal it from a subsequent
    // ability-aim or movement interaction on some mobile browsers.
    // The window-wide up/cancel listeners below still safely release it.
  }, true);
  function finishFirePointer(e){
    if(!firingPointers.delete(e.pointerId))return;
    stopFiring();
  }
  for(const type of ['pointerup','pointercancel','lostpointercapture'])
    window.addEventListener(type,finishFirePointer,true);
  // Compatibility events for mouse releases that happen outside the canvas.
  window.addEventListener('mouseup',e=>{
    if(e.button!==0)return;
    for(const [id,type] of firingPointers){if(type==='mouse')firingPointers.delete(id);}
    stopFiring();
  },true);
  document.addEventListener('pointermove',e=>{
    // Browsers can drop mouseup after context-menu or drag operations.
    if(e.pointerType==='mouse' && !(e.buttons&1) && firingPointers.has(e.pointerId)){
      firingPointers.delete(e.pointerId);stopFiring();
    }
  },true);
  window.addEventListener('dragstart',()=>stopFiring(true),true);
  document.addEventListener('contextmenu',e=>{
    if(playing() && e.target?.closest?.('#field,#arena')){
      e.preventDefault();stopFiring(true);
    }
  },true);
  const releaseFinishedPointer = e => {
    if (!movePointers.delete(e.pointerId) || movePointers.size) return;
    // Never reset a newly pressed joystick when the previous finger's
    // cancel/lostcapture notification arrives late.
    queueMicrotask(() => { if (!movePointers.size) releaseMovement(true); });
  };
  document.addEventListener('pointerdown', e => {
    if (!playing() || e.pointerType === 'mouse' || !(e.target instanceof Element)) return;
    if (!e.target.closest('#cpuMoveZone,#moveZone')) return;
    // After an interrupted or cancelled touch, the old joystick may still
    // own an abandoned ID. A newly primary finger must always be able to
    // start moving; do not require the player to restart the match.
    // A secondary finger never resets an active primary joystick.
    if (e.isPrimary && movePointers.size) releaseMovement(true);
    movePointers.add(e.pointerId);
  }, true);
  window.addEventListener('pointerup', releaseFinishedPointer, true);
  window.addEventListener('pointercancel', releaseFinishedPointer, true);
  window.addEventListener('lostpointercapture', releaseFinishedPointer, true);
  // Older mobile WebViews sometimes deliver touchend without pointerup.
  for (const type of ['touchend','touchcancel']) {
    document.addEventListener(type, e => {
      if (playing() && e.touches.length === 0) {
        queueMicrotask(() => {
          releaseMovement(true);
          // Legacy WebViews can deliver touchend without pointerup.
          firingPointers.clear();stopFiring();
        });
      }
    }, true);
  }
  document.addEventListener('keydown', e => {
    if (!playing()) return;
    // The old game's keydown handler lives on window. Do not let typing in
    // a lobby/chat input accidentally enable movement during a match.
    if(editable(e.target)){
      if(movementKey(e) || e.key===' ')e.stopPropagation();
      return;
    }
    if(e.key===' '){heldSpace=true;spaceLastSeen=performance.now();}
    const key = movementKey(e);
    if(key){heldDirections.add(key);keyLastSeen.set(key,performance.now());}
  }, true);
  window.addEventListener('keyup', e => {
    if(e.key===' '){
      heldSpace=false;spaceLastSeen=0;
      // In mixed keyboard+mouse input, mouse hold may still be active.
      queueMicrotask(()=>stopFiring());
    }
    const key = movementKey(e);
    if (!key) return;
    heldDirections.delete(key);keyLastSeen.delete(key);
    // If the original keyup was ignored because focus moved, repair it.
    queueMicrotask(() => { if (playing() && !movePointers.size) syncDirections(true); });
  }, true);
  // Safety net for browsers that swallow keyup while a held fire pointer is
  // captured. Real held keys produce repeat keydown events; abandoned keys don't.
  setInterval(()=>{
    if(!playing())return;
    const now=performance.now();
    let changed=false;
    for(const key of heldDirections){
      if(now-(keyLastSeen.get(key)||now)>4500){
        heldDirections.delete(key);keyLastSeen.delete(key);changed=true;
      }
    }
    if(changed&&!movePointers.size)syncDirections(true);
    if(heldSpace&&now-spaceLastSeen>4500){
      heldSpace=false;spaceLastSeen=0;stopFiring();
    }
  },750);
  document.addEventListener('focusin', e => {
    if (playing() && editable(e.target)) {
      stopFiring(true);
      releaseMovement(false);
    }
  }, true);
  const releaseAll = () => {
    stopFiring(true);
    releaseMovement(false);
  };
  window.addEventListener('blur', releaseAll);
  window.addEventListener('pagehide', releaseAll);
  window.addEventListener('orientationchange', releaseAll);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseAll();
  });
  // A lobby/replay transition may swallow keyup and pointerup without blurring
  // the browser. Never carry any held input into the next round.
  new MutationObserver(() => {if(!playing())releaseAll();})
    .observe(document.body,{attributes:true,attributeFilter:['class']});
  // Test hook and an emergency reset for users switching modes.
  window.MojiInputSafety = {
    releaseAll,
    activePointers:()=>movePointers.size,
    firingPointers:()=>firingPointers.size,
    resetFire:()=>stopFiring(true),
    heldDirections:()=>Array.from(heldDirections)
  };
})();
