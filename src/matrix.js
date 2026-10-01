// Matriz processo × material: destaque em cruz e painel de detalhes.
export function initMatrix(root) {
  const table = root.querySelector('[data-matrix]');
  if (!table) return;
  const rows = [...table.tBodies[0].rows];
  const heads = [...table.tHead.querySelectorAll('th[data-col]')];
  const name = root.querySelector('[data-tech-name]');
  const desc = root.querySelector('[data-tech-desc]');
  const eyebrow = root.querySelector('.tech__eyebrow');
  const page = root.querySelector('[data-tech-page]');
  const PAGES = { arc: 'arc-spray', pta: 'pta', hvof: 'hvof', laser: 'laser-cladding', saw: 'arco-submerso' };
  let locked = rows.find((r) => r.dataset.proc === 'hvof') || rows[0];

  const setCol = (col) => {
    table.querySelectorAll('.is-col').forEach((c) => c.classList.remove('is-col'));
    if (col == null) return;
    table.querySelectorAll(`[data-col="${col}"]`).forEach((c) => c.classList.add('is-col'));
  };

  const showRow = (tr) => {
    rows.forEach((r) => {
      r.classList.toggle('is-hl', r === tr);
      r.classList.remove('is-dim');
    });
    eyebrow.textContent = tr === locked ? 'Processo selecionado' : 'Processo';
    name.innerHTML = `${tr.dataset.name} <small>${tr.dataset.mode}</small>`;
    desc.textContent = tr.dataset.desc;
    const slug = PAGES[tr.dataset.proc];
    page.hidden = !slug;
    if (slug) page.href = `/processos/${slug}.html`;
  };

  const showMaterial = (col) => {
    const material = heads[col].textContent.trim();
    const using = rows.filter((r) => r.cells[col + 1]?.classList.contains('is-on'));
    rows.forEach((r) => {
      r.classList.remove('is-hl');
      r.classList.toggle('is-dim', !using.includes(r));
    });
    eyebrow.textContent = 'Liga';
    name.textContent = material;
    page.hidden = true;
    const info = heads[col].dataset.info ? `${heads[col].dataset.info} ` : '';
    desc.textContent = info + (using.length
      ? `Aplicado por ${using.map((r) => `${r.dataset.name} (${r.dataset.mode})`).join(', ')}.`
      : 'Consulte a engenharia para esta liga.');
  };

  table.addEventListener('pointerover', (e) => {
    const cell = e.target.closest('td, th');
    if (!cell) return;
    const tr = cell.closest('tr');
    if (tr.parentElement === table.tHead) {
      if (cell.dataset.col != null) {
        setCol(cell.dataset.col);
        showMaterial(+cell.dataset.col);
      }
      return;
    }
    setCol(cell.dataset.col ?? null);
    showRow(tr);
  });
  table.addEventListener('pointerleave', () => {
    setCol(null);
    showRow(locked);
  });
  rows.forEach((tr) => {
    const btn = tr.querySelector('button');
    btn.setAttribute('aria-pressed', String(tr === locked));
    btn.addEventListener('click', () => {
      locked = tr;
      rows.forEach((r) => r.querySelector('button').setAttribute('aria-pressed', String(r === tr)));
      showRow(tr);
    });
    btn.addEventListener('focus', () => showRow(tr));
  });

  showRow(locked);
}
