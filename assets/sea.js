// © 2026 TideQuest. All rights reserved. Proprietary; see LICENSE. Do not copy, extract or reuse.
//
// Interactive sea, rendered by sea.wasm. Left-click or one finger builds sand, right-click or two
// fingers wash it away. Without WebAssembly the static screenshot stays.
(() => {
  const root = document.documentElement;
  const wasmUrl = new URL('sea.wasm', document.currentScript.src);

  const TILE = 16;          // game px per tile
  const TIDE_PERIOD = 24;   // seconds per full tide cycle
  const TIDE_LOW = 20;      // shore_offset (px) at low tide; 0 at high tide (game TideConfig)
  const FRAME_MS = 1000 / 30;
  const UNDO_MS = 250;      // a second finger this soon undoes the first finger's sand

  const fail = () => root.classList.remove('sea-live');
  if (!root.classList.contains('sea-live')) return;

  const host = document.createElement('div');
  host.className = 'sea';
  host.setAttribute('aria-hidden', 'true');
  const canvas = document.createElement('canvas');
  host.append(canvas);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    fail();
    return;
  }

  const load = WebAssembly.instantiateStreaming
    ? WebAssembly.instantiateStreaming(fetch(wasmUrl), {}).catch(() => fetchAndInstantiate())
    : fetchAndInstantiate();

  load
    .then(({ instance }) => start(instance.exports))
    .catch(() => {
      host.remove();
      fail();
    });

  // Fallback for servers that do not send application/wasm.
  function fetchAndInstantiate() {
    return fetch(wasmUrl)
      .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(response.statusText))))
      .then((bytes) => WebAssembly.instantiate(bytes, {}));
  }

  // ------------------------------------------------------------------ setup

  function start(sea) {
    if (!sea.sea_init()) throw new Error('sea init failed');

    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
    let width = 0;
    let height = 0;
    let image = null;
    let hover = null;
    let frame = 0;
    let lastDraw = -Infinity;
    let dirty = true;
    let startTime = performance.now();
    let pausedAt = null; // when paused, else null

    document.body.prepend(host);
    const hint = document.createElement('p');
    hint.className = 'sea-hint';
    hint.textContent = finePointer.matches
      ? 'Left-click the sea to build an island, right-click to wash it away'
      : 'Tap to build an island, hold two fingers to wash it away';
    const footer = document.querySelector('.site-footer');
    if (footer) footer.prepend(hint);
    else document.body.append(hint);

    // Icon buttons above the footer bar: pause (hidden under reduced motion) and mute.
    const controls = document.createElement('div');
    controls.className = 'sea-controls';
    if (footer) {
      footer.append(controls);
      footer.classList.add('has-controls');
    }
    const icon = (paths) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

    const PAUSE_ICON = icon('<path d="M9 6v12M15 6v12" stroke-width="3"/>');
    const PLAY_ICON = icon('<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>');
    const pause = document.createElement('button');
    pause.type = 'button';
    pause.className = 'sea-control';
    pause.hidden = reducedMotion.matches;
    const renderPause = () => {
      const label = pausedAt === null ? 'Pause animation' : 'Play animation';
      pause.setAttribute('aria-label', label);
      pause.title = label;
      pause.innerHTML = pausedAt === null ? PAUSE_ICON : PLAY_ICON;
    };
    renderPause();
    controls.append(pause);
    pause.addEventListener('click', () => {
      if (pausedAt === null) {
        pausedAt = performance.now();
      } else {
        startTime += performance.now() - pausedAt;
        pausedAt = null;
      }
      renderPause();
      requestDraw();
    });

    function layout() {
      const vw = host.clientWidth;
      const vh = host.clientHeight;
      const scale = Math.max(2, Math.min(6, Math.round(Math.min(vw / 480, vh / 270))));
      width = Math.ceil(vw / scale);
      height = Math.ceil(vh / scale);
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${width * scale}px`;
      canvas.style.height = `${height * scale}px`;
      sea.sea_resize(width, height);
      image = null;
      dirty = true;
    }

    function draw(now) {
      const t = reducedMotion.matches ? 0 : ((pausedAt ?? now) - startTime) / 1000;
      const tide = reducedMotion.matches ? 0.5 : 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / TIDE_PERIOD);
      sea.sea_render(t, TIDE_LOW * (1 - tide));
      // Memory can grow on resize, which detaches old views of it.
      if (!image || image.data.buffer !== sea.memory.buffer) {
        const pixels = new Uint8ClampedArray(sea.memory.buffer, sea.sea_frame(), width * height * 4);
        image = new ImageData(pixels, width, height);
      }
      ctx.putImageData(image, 0, 0);
    }

    // Up to 30 fps, or only on change when paused or with reduced motion.
    function tick(now) {
      frame = 0;
      const animate = !reducedMotion.matches && pausedAt === null;
      const elapsed = now - lastDraw;
      if (dirty || (animate && (elapsed >= FRAME_MS - 1 || elapsed < 0))) {
        dirty = false;
        lastDraw = now;
        draw(now);
      }
      if (animate) frame = requestAnimationFrame(tick);
    }

    function requestDraw() {
      dirty = true;
      if (!frame) frame = requestAnimationFrame(tick);
    }

    // ---------------------------------------------------------------- sound

    // Place Dirt and Place Water clips from the wasm. The AudioContext waits for the first press,
    // as browsers require.
    const SOUND_PLACE = 0;
    const SOUND_WASH = 1;
    const SOUND_GAP = 0.08; // seconds between repeats of one sound while dragging
    const SOUND_VOLUME = 0.6;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const sounds = [];
    const lastPlayed = [-Infinity, -Infinity];
    let audio = null;
    let soundOn = true; // not stored

    if (AudioCtx && window.OfflineAudioContext) {
      const decoder = new OfflineAudioContext(1, 1, 48000);
      for (const index of [SOUND_PLACE, SOUND_WASH]) {
        const length = sea.sea_sound_len(index);
        if (!length) continue;
        // decodeAudioData takes ownership of the buffer, so copy it out of wasm memory.
        const bytes = new Uint8Array(sea.memory.buffer, sea.sea_sound(index), length).slice();
        decoder.decodeAudioData(bytes.buffer).then((buffer) => {
          sounds[index] = { buffer, offset: onset(buffer) };
        }, () => {});
      }
    }

    // Start just before the clip first hits half its peak loudness, skipping the soft lead-in.
    function onset(buffer) {
      const data = buffer.getChannelData(0);
      const step = Math.max(1, Math.round(buffer.sampleRate / 1000));
      const loudness = [];
      for (let i = 0; i + step <= data.length; i += step) {
        let sum = 0;
        for (let j = i; j < i + step; j++) sum += data[j] * data[j];
        loudness.push(Math.sqrt(sum / step));
      }
      const peak = Math.max(...loudness);
      const hit = loudness.findIndex((value) => value >= peak / 2);
      return Math.max(0, hit - 3) / 1000;
    }

    function unlockAudio() {
      if (!AudioCtx || !sounds.length) return;
      if (!audio) audio = new AudioCtx();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
    }

    function playSound(index) {
      if (!soundOn || !audio || !sounds[index] || audio.currentTime - lastPlayed[index] < SOUND_GAP) return;
      lastPlayed[index] = audio.currentTime;
      const { buffer, offset } = sounds[index];
      const now = audio.currentTime;
      const source = audio.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = 0.94 + Math.random() * 0.12;
      const gain = audio.createGain();
      // Short fade-in, since playback starts mid-waveform.
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(SOUND_VOLUME, now + 0.003);
      source.connect(gain).connect(audio.destination);
      source.start(now, offset);
    }

    if (AudioCtx && sea.sea_sound_len(SOUND_PLACE)) {
      const SPEAKER = '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/>';
      const ICON_ON = `${SPEAKER}<path d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>`;
      const ICON_OFF = `${SPEAKER}<path d="M16 9.5l5 5M21 9.5l-5 5"/>`;
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'sea-control';
      toggle.setAttribute('aria-label', 'Sound effects');
      const render = () => {
        toggle.setAttribute('aria-pressed', String(soundOn));
        toggle.title = soundOn ? 'Mute sound effects' : 'Unmute sound effects';
        toggle.innerHTML = icon(soundOn ? ICON_ON : ICON_OFF);
      };
      toggle.addEventListener('click', () => {
        soundOn = !soundOn;
        render();
      });
      render();
      controls.append(toggle);
    }

    // ---------------------------------------------------------------- input

    let edited = false;

    function tileAt(event) {
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * width;
      const y = ((event.clientY - rect.top) / rect.height) * height;
      return [Math.floor(x / TILE), Math.floor(y / TILE)];
    }

    // Bresenham, so fast drags leave no gaps. Changed tiles go into `changed`.
    function line(from, to, on, changed) {
      let [x0, y0] = from;
      const [x1, y1] = to;
      const dx = Math.abs(x1 - x0);
      const dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        if (sea.sea_set_tile(x0, y0, on ? 1 : 0)) changed.push([x0, y0]);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }

    function commit(changed, raised) {
      if (!changed.length) return;
      playSound(raised ? SOUND_PLACE : SOUND_WASH);
      sea.sea_rebuild();
      requestDraw();
      if (!edited) {
        edited = true;
        hint.classList.add('is-done');
      }
    }

    function paint(from, to, on) {
      const changed = [];
      line(from, to, on, changed);
      commit(changed, on);
      return changed;
    }

    // Mouse: the button picks build or wash.
    let mouseMode = 0; // 1 build, -1 wash
    let mouseLast = null;

    // Touch and pen: one finger builds. With a second finger down, all fingers wash until they lift.
    const fingers = new Map(); // pointerId -> { last: [tx, ty] }
    let touchErase = false;
    let firstDown = 0;
    let firstAdded = [];

    function onTouchDown(event, tile) {
      if (fingers.size === 0) {
        touchErase = false;
        firstDown = event.timeStamp;
        fingers.set(event.pointerId, { last: tile });
        firstAdded = paint(tile, tile, true);
        return;
      }
      fingers.set(event.pointerId, { last: tile });
      if (!touchErase) {
        touchErase = true;
        if (event.timeStamp - firstDown <= UNDO_MS) {
          for (const [tx, ty] of firstAdded) sea.sea_set_tile(tx, ty, 0);
          commit(firstAdded, false);
        }
        firstAdded = [];
        for (const finger of fingers.values()) paint(finger.last, finger.last, false);
      } else {
        paint(tile, tile, false);
      }
    }

    function onTouchMove(event, tile) {
      const finger = fingers.get(event.pointerId);
      if (!finger) return;
      const from = finger.last;
      finger.last = tile;
      // Once a finger lifts from a two-finger wash, the rest do nothing.
      if (finger.idle) return;
      const changed = paint(from, tile, !touchErase);
      if (!touchErase) firstAdded.push(...changed);
    }

    function onTouchUp(event) {
      if (!fingers.delete(event.pointerId)) return;
      if (touchErase) for (const finger of fingers.values()) finger.idle = true;
    }

    // Start audio on the first press anywhere, so it's ready by the first tile.
    addEventListener('pointerdown', unlockAudio, { capture: true, passive: true });
    addEventListener('keydown', unlockAudio, { capture: true, passive: true });

    host.addEventListener('pointerdown', (event) => {
      const tile = tileAt(event);
      if (event.pointerType === 'mouse') {
        if (event.button !== 0 && event.button !== 2) return;
        event.preventDefault();
        mouseMode = event.button === 0 ? 1 : -1;
        mouseLast = tile;
        host.setPointerCapture(event.pointerId);
        paint(tile, tile, mouseMode > 0);
        return;
      }
      event.preventDefault();
      host.setPointerCapture(event.pointerId);
      onTouchDown(event, tile);
    });

    host.addEventListener('pointermove', (event) => {
      const tile = tileAt(event);
      if (event.pointerType !== 'mouse') {
        onTouchMove(event, tile);
        return;
      }
      if (!hover || hover[0] !== tile[0] || hover[1] !== tile[1]) {
        hover = tile;
        sea.sea_set_hover(tile[0], tile[1], 1);
        requestDraw();
      }
      if (!mouseMode) return;
      paint(mouseLast, tile, mouseMode > 0);
      mouseLast = tile;
    });

    const endPointer = (event) => {
      if (event.pointerType === 'mouse') {
        mouseMode = 0;
        mouseLast = null;
      } else {
        onTouchUp(event);
      }
    };
    host.addEventListener('pointerup', endPointer);
    host.addEventListener('pointercancel', endPointer);
    host.addEventListener('pointerleave', (event) => {
      if (event.pointerType !== 'mouse' || !hover) return;
      hover = null;
      sea.sea_set_hover(0, 0, 0);
      requestDraw();
    });
    host.addEventListener('contextmenu', (event) => event.preventDefault());

    let resizeFrame = 0;
    addEventListener('resize', () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        layout();
        requestDraw();
      });
    });
    reducedMotion.addEventListener('change', () => {
      pause.hidden = reducedMotion.matches;
      requestDraw();
    });

    // ---------------------------------------------------------- islands

    // A few random islands on load, kept off the content and footer and apart from each other.
    function scatterIslands() {
      const cols = Math.ceil(width / TILE);
      const rows = Math.ceil(height / TILE);
      const at = (x, y) => y * cols + x;
      const inside = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows;
      const random = (n) => Math.floor(Math.random() * n);

      const blocked = new Uint8Array(cols * rows);
      const canvasRect = canvas.getBoundingClientRect();
      const perPx = width / canvasRect.width / TILE; // tiles per CSS px
      for (const [selector, pad] of [['main', 1], ['.site-footer', 1]]) {
        const el = document.querySelector(selector);
        const r = el && el.getBoundingClientRect();
        if (!r || !r.width) continue;
        const x0 = Math.floor((r.left - canvasRect.left) * perPx) - pad;
        const y0 = Math.floor((r.top - canvasRect.top) * perPx) - pad;
        const x1 = Math.floor((r.right - canvasRect.left) * perPx) + pad;
        const y1 = Math.floor((r.bottom - canvasRect.top) * perPx) + pad;
        for (let y = Math.max(0, y0); y <= Math.min(rows - 1, y1); y++) {
          for (let x = Math.max(0, x0); x <= Math.min(cols - 1, x1); x++) blocked[at(x, y)] = 1;
        }
      }

      const SPACING = 4; // open-water tiles kept between islands
      const owner = new Int16Array(cols * rows).fill(-1);
      const free = (x, y, id) => {
        if (!inside(x, y) || blocked[at(x, y)]) return false;
        for (let dy = -SPACING; dy <= SPACING; dy++) {
          for (let dx = -SPACING; dx <= SPACING; dx++) {
            const o = inside(x + dx, y + dy) ? owner[at(x + dx, y + dy)] : -1;
            if (o >= 0 && o !== id) return false;
          }
        }
        return true;
      };
      const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

      // Grow from a seed, preferring cells that touch more of the island.
      function grow(sx, sy, target, id) {
        const land = new Set([at(sx, sy)]);
        const touching = (x, y) => STEPS.filter(([dx, dy]) => land.has(at(x + dx, y + dy))).length;
        while (land.size < target) {
          const options = [];
          for (const cell of land) {
            const x = cell % cols;
            const y = (cell - x) / cols;
            for (const [dx, dy] of STEPS) {
              const nx = x + dx;
              const ny = y + dy;
              if (!land.has(at(nx, ny)) && free(nx, ny, id)) options.push([nx, ny, touching(nx, ny)]);
            }
          }
          if (!options.length) break;
          let total = 0;
          for (const o of options) total += (o[3] = 1 + 3 * o[2] * o[2]);
          let pick = Math.random() * total;
          const [x, y] = options.find((o) => (pick -= o[3]) < 0) || options[options.length - 1];
          land.add(at(x, y));
        }
        // Fill notches.
        for (const cell of [...land]) {
          const x = cell % cols;
          const y = (cell - x) / cols;
          for (const [dx, dy] of STEPS) {
            const nx = x + dx;
            const ny = y + dy;
            if (!land.has(at(nx, ny)) && free(nx, ny, id) && touching(nx, ny) >= 3) land.add(at(nx, ny));
          }
        }
        return land;
      }

      // Reject thin slivers.
      function chunky(land) {
        let x0 = cols;
        let y0 = rows;
        let x1 = -1;
        let y1 = -1;
        for (const cell of land) {
          const x = cell % cols;
          const y = (cell - x) / cols;
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
        const w = x1 - x0 + 1;
        const h = y1 - y0 + 1;
        return Math.min(w, h) >= 2 && Math.max(w, h) <= 3 * Math.min(w, h);
      }

      const budget = Math.max(10, Math.round(cols * rows * 0.05));
      const count = Math.min(4, Math.max(2, Math.round((cols * rows) / 170)));
      let used = 0;
      let made = 0;
      for (let attempt = 0; attempt < 80 && made < count; attempt++) {
        const target = Math.min(budget - used, 7 + random(12));
        if (target < 5) break;
        const sx = random(cols);
        const sy = random(rows);
        if (!free(sx, sy, made)) continue;
        const land = grow(sx, sy, target, made);
        if (land.size < 5 || !chunky(land)) continue;
        for (const cell of land) {
          owner[cell] = made;
          sea.sea_set_tile(cell % cols, Math.floor(cell / cols), 1);
        }
        used += land.size;
        made++;
      }
      sea.sea_rebuild();
    }

    layout();
    scatterIslands();
    requestDraw();
  }
})();
