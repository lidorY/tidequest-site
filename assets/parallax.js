// Mouse parallax: the invite drifts with the pointer and, when the static screenshot is the
// background (no interactive sea), the screenshot drifts against it.
// Mouse-only (no touch) and disabled when the visitor prefers reduced motion.
(() => {
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const bg = document.querySelector('.shot');
  const fg = document.querySelector('main');
  if (!finePointer.matches || !bg || !fg) return;

  const BG_SHIFT = 14; // px at the viewport edge, against the pointer
  const FG_SHIFT = 8;  // px at the viewport edge, with the pointer
  const EASE = 0.08;   // fraction of the remaining distance covered per frame

  let targetX = 0;
  let targetY = 0;
  let x = 0;
  let y = 0;
  let frame = 0;

  document.documentElement.classList.add('parallax');

  function render() {
    x += (targetX - x) * EASE;
    y += (targetY - y) * EASE;
    // The interactive sea stays put so painted tiles land exactly under the cursor.
    bg.style.transform = document.documentElement.classList.contains('sea-live')
      ? ''
      : `translate3d(${(-x * BG_SHIFT).toFixed(2)}px, ${(-y * BG_SHIFT).toFixed(2)}px, 0)`;
    fg.style.transform = `translate3d(${(x * FG_SHIFT).toFixed(2)}px, ${(y * FG_SHIFT).toFixed(2)}px, 0)`;
    const settled = Math.abs(targetX - x) < 0.001 && Math.abs(targetY - y) < 0.001;
    frame = settled ? 0 : requestAnimationFrame(render);
  }

  function aim(nx, ny) {
    targetX = nx;
    targetY = ny;
    if (!frame) frame = requestAnimationFrame(render);
  }

  function reset() {
    cancelAnimationFrame(frame);
    frame = 0;
    targetX = targetY = x = y = 0;
    bg.style.transform = '';
    fg.style.transform = '';
  }

  addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || reducedMotion.matches) return;
    aim((event.clientX / innerWidth) * 2 - 1, (event.clientY / innerHeight) * 2 - 1);
  }, { passive: true });

  // Pointer left the window: glide back to centre.
  document.addEventListener('mouseout', (event) => {
    if (!event.relatedTarget) aim(0, 0);
  });

  reducedMotion.addEventListener('change', (event) => {
    if (event.matches) reset();
  });
})();
