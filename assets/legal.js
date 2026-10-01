// Privacy and accessibility notices as modal dialogs. Footer links (#privacy, #accessibility,
// or /#... from other pages) and those URL hashes open them; the close button, Escape or a
// click on the backdrop closes them. Without this script the CSS :target fallback shows them.
(() => {
  const root = document.documentElement;
  const dialogs = new Map([...document.querySelectorAll('dialog.legal')].map((d) => [d.id, d]));
  if (!dialogs.size || typeof HTMLDialogElement !== 'function') return;
  root.classList.add('legal-js');

  function open(id) {
    const dialog = dialogs.get(id);
    if (!dialog || dialog.open) return;
    for (const other of dialogs.values()) if (other.open) other.close();
    dialog.showModal();
    dialog.querySelector('.legal-body').scrollTop = 0;
    if (location.hash !== `#${id}`) history.replaceState(null, '', `#${id}`);
  }

  for (const [id, dialog] of dialogs) {
    dialog.querySelector('.legal-close').addEventListener('click', () => dialog.close());
    // The dialog element itself is only hit outside .legal-body, i.e. on the backdrop.
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => {
      if (location.hash === `#${id}`) history.replaceState(null, '', location.pathname + location.search);
    });
  }

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href*="#"]');
    if (!link || link.origin !== location.origin || link.pathname !== location.pathname) return;
    const id = link.hash.slice(1);
    if (!dialogs.has(id)) return;
    event.preventDefault();
    open(id);
  });

  const fromHash = () => open(location.hash.slice(1));
  addEventListener('hashchange', fromHash);
  fromHash();
})();
