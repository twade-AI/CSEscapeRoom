/* ==========================================================================
   dragdrop.js — tiny pointer-based drag & drop that works with BOTH a mouse
   and touch screens (tablets / interactive whiteboards). No libraries.

   Usage:
     DnD.makeDraggable(el, { data });          // make an element draggable
     DnD.makeDropzone(el, { onDrop(el,zone) }); // make an element a drop target

   When a draggable is released over a dropzone, onDrop(draggable, zone) fires.
   Returning the element to its origin / re-parenting is left to the caller.
   ========================================================================== */
const DnD = (() => {
  let dragging = null;     // the original element being dragged
  let ghost = null;        // floating clone that follows the pointer
  let offsetX = 0, offsetY = 0;
  let currentZone = null;

  const dropzones = new Set();

  function makeDraggable(el, opts = {}) {
    el.classList.add("draggable");
    el._dnd = opts;
    el.addEventListener("pointerdown", onPointerDown);
    return el;
  }

  function makeDropzone(el, opts = {}) {
    el.classList.add("dropzone");
    el._dndZone = opts;
    dropzones.add(el);
    return el;
  }

  function clearDropzones() { dropzones.clear(); }

  function onPointerDown(e) {
    // Only primary button / single touch
    if (e.button !== undefined && e.button !== 0) return;
    const el = e.currentTarget;
    if (el.classList.contains("locked")) return;
    e.preventDefault();

    dragging = el;
    const rect = el.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    ghost = el.cloneNode(true);
    ghost.classList.add("dnd-ghost");
    ghost.style.width = rect.width + "px";
    ghost.style.height = rect.height + "px";
    ghost.style.left = rect.left + "px";
    ghost.style.top = rect.top + "px";
    document.body.appendChild(ghost);

    el.classList.add("dnd-source");

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  function onPointerMove(e) {
    if (!ghost) return;
    ghost.style.left = (e.clientX - offsetX) + "px";
    ghost.style.top = (e.clientY - offsetY) + "px";

    // Find the dropzone under the pointer
    ghost.style.pointerEvents = "none";
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const zone = under ? under.closest(".dropzone") : null;

    if (zone !== currentZone) {
      if (currentZone) currentZone.classList.remove("dnd-over");
      currentZone = (zone && dropzones.has(zone)) ? zone : null;
      if (currentZone) currentZone.classList.add("dnd-over");
    }
  }

  function onPointerUp() {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);

    if (currentZone) {
      currentZone.classList.remove("dnd-over");
      const zoneOpts = currentZone._dndZone || {};
      if (typeof zoneOpts.onDrop === "function") {
        zoneOpts.onDrop(dragging, currentZone);
      }
    }
    if (ghost) ghost.remove();
    if (dragging) dragging.classList.remove("dnd-source");

    ghost = null;
    dragging = null;
    currentZone = null;
  }

  return { makeDraggable, makeDropzone, clearDropzones };
})();
