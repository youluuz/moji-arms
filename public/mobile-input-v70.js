/* Glyph Strike v7.0: independent multi-touch equipment selection for CPU arena.
   The first finger can remain captured by the joystick while the second picks a slot.
   Pointerdown fires immediately, before delayed touch click synthesis. */
(() => {
  'use strict';
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
})();
