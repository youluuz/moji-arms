/* Glyph Strike v7.0: independent multi-touch equipment selection for CPU arena.
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
  const arrowMap = {ArrowUp:'w',ArrowDown:'s',ArrowLeft:'a',ArrowRight:'d'};
  const arrows = {w:'ArrowUp',a:'ArrowLeft',s:'ArrowDown',d:'ArrowRight'};
  const moveKeys = ['w','a','s','d'];
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
  function releaseMovement(preserveKeyboard=false) {
    movePointers.clear();
    if (!preserveKeyboard) heldDirections.clear();
    // This is the CPU joystick's movement vector. A missed pointerup in the
    // old handler otherwise leaves it non-null for every subsequent frame.
    if (typeof touch !== 'undefined') touch = null;
    // PvP's original joystick keeps a pointer ID and its own thumb position.
    if (typeof releaseStick === 'function') releaseStick();
    syncDirections(preserveKeyboard);
    if (!preserveKeyboard && typeof down !== 'undefined') down = false;
  }
  const releaseFinishedPointer = e => {
    if (!movePointers.delete(e.pointerId) || movePointers.size) return;
    // Let the game's original handler finish first, then override stale input.
    queueMicrotask(() => { if (!movePointers.size) releaseMovement(true); });
  };
  document.addEventListener('pointerdown', e => {
    if (!playing() || e.pointerType === 'mouse' || !(e.target instanceof Element)) return;
    if (e.target.closest('#cpuMoveZone,#moveZone')) movePointers.add(e.pointerId);
  }, true);
  document.addEventListener('pointerup', releaseFinishedPointer, true);
  document.addEventListener('pointercancel', releaseFinishedPointer, true);
  document.addEventListener('lostpointercapture', releaseFinishedPointer, true);
  // Older mobile WebViews sometimes deliver touchend without pointerup.
  for (const type of ['touchend','touchcancel']) {
    document.addEventListener(type, e => {
      if (playing() && e.touches.length === 0) {
        queueMicrotask(() => releaseMovement(true));
      }
    }, true);
  }
  document.addEventListener('keydown', e => {
    if (!playing() || editable(e.target)) return;
    const key = movementKey(e);
    if (key) heldDirections.add(key);
  }, true);
  document.addEventListener('keyup', e => {
    const key = movementKey(e);
    if (!key) return;
    heldDirections.delete(key);
    // If the original keyup was ignored because focus moved, repair it.
    queueMicrotask(() => { if (playing() && !movePointers.size) syncDirections(true); });
  }, true);
  document.addEventListener('focusin', e => {
    if (playing() && editable(e.target)) releaseMovement(false);
  }, true);
  const releaseAll = () => { if (playing()) releaseMovement(false); };
  window.addEventListener('blur', releaseAll);
  window.addEventListener('pagehide', releaseAll);
  window.addEventListener('orientationchange', releaseAll);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseAll();
  });
  // Test hook and an emergency reset for users switching modes.
  window.MojiInputSafety = {releaseAll, activePointers:()=>movePointers.size};
})();
