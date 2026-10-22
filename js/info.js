// Modale Info (dal basso): schede Metodologia, Guida, Credits e "torna in cima".

(function initInfo() {
  const modal = document.getElementById('info-modal');
  const btn = document.getElementById('tb-info');
  const tabsInfo = [...document.querySelectorAll('#info-nav .itab')];
  const panes = [...document.querySelectorAll('.info-pane')];
  const top = document.getElementById('info-back-top');
  const attivo = () => panes.find((p) => !p.hidden);
  let ultimoFocus = null;

  function mostra(nome) {
    tabsInfo.forEach((t) => {
      const on = t.dataset.tab === nome;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    panes.forEach((p) => {
      const on = p.dataset.tab === nome;
      p.hidden = !on;
      p.classList.toggle('active', on);
    });
    aggiornaTop();
  }

  function aggiornaTop() {
    top.classList.toggle('visible', (attivo()?.scrollTop || 0) > 200);
  }

  function apri(nome) {
    ultimoFocus = document.activeElement;
    if (nome) mostra(nome);
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    btn.classList.add('active');
    document.getElementById('info-nav').querySelector('.itab.active').focus({ preventScroll: true });
  }

  function chiudi() {
    if (!modal.classList.contains('open')) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    btn.classList.remove('active');
    ultimoFocus?.focus?.({ preventScroll: true });
  }

  window.apriInfo = apri;
  btn.addEventListener('click', () => (modal.classList.contains('open') ? chiudi() : apri()));
  document.getElementById('info-close').addEventListener('click', chiudi);
  document.getElementById('info-handle').addEventListener('click', chiudi);
  document.getElementById('info-backdrop').addEventListener('click', chiudi);

  document.getElementById('info-nav').addEventListener('click', (e) => {
    const t = e.target.closest('.itab');
    if (t) mostra(t.dataset.tab);
  });
  document.getElementById('info-nav').addEventListener('keydown', (e) => {
    const i = tabsInfo.findIndex((t) => t.classList.contains('active'));
    const n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabsInfo.length - 1 : null;
    if (n === null) return;
    e.preventDefault();
    const t = tabsInfo[(n + tabsInfo.length) % tabsInfo.length];
    mostra(t.dataset.tab);
    t.focus();
  });

  panes.forEach((p) => p.addEventListener('scroll', aggiornaTop, { passive: true }));
  top.addEventListener('click', () => attivo()?.scrollTo({ top: 0, behavior: 'smooth' }));

  // Capture: Esc chiude il modale prima degli altri handler (tabella, pannello)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) { e.stopImmediatePropagation(); chiudi(); }
  }, true);
})();
