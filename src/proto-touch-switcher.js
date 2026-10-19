// PROTOTYPE (wayfinder ticket #1088): throwaway touch-control variant switcher. Never merge to develop.
(function () {
  const VARIANTS = [
    ['A', 'A dual-stick'],
    ['B', 'B one-thumb'],
    ['C', 'C point-aim'],
  ];
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;top:calc(env(safe-area-inset-top,0px) + 4px);left:50%;transform:translateX(-50%);z-index:20;display:flex;gap:4px;font:bold 11px monospace;opacity:.85';
  function paint() {
    for (const b of bar.children) {
      const on = b.dataset.v === protoVariant;
      b.style.background = on ? '#ffee00' : '#222';
      b.style.color = on ? '#000' : '#ffee00';
    }
  }
  for (const [key, label] of VARIANTS) {
    const b = document.createElement('button');
    b.dataset.v = key;
    b.textContent = label;
    b.style.cssText = 'border:1px solid #ffee00;border-radius:12px;padding:6px 8px;min-height:32px;white-space:nowrap';
    b.addEventListener('click', () => {
      protoVariant = key;
      const u = new URL(location.href);
      u.searchParams.set('controls', key);
      history.replaceState(null, '', u);
      if (typeof resetTouch === 'function') resetTouch();
      if (typeof updateBtns === 'function') updateBtns();
      paint();
    });
    bar.appendChild(b);
  }
  document.body.appendChild(bar);
  paint();
}());
