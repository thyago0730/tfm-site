// Gera páginas estáticas por processo e por setor (SEO local) a partir de pages-data.mjs.
// Uso: node scripts/build-pages.mjs  (rodado automaticamente antes do build)
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { processos, setores, glossario } from './pages-data.mjs';

const SITE = 'https://tfmrevestimentos.com.br';
const WA = (m) => `https://wa.me/5511950427669?text=${encodeURIComponent(m)}`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const byslug = Object.fromEntries(processos.map((p) => [p.slug, p]));
const li = (arr) => arr.map((x) => `<li>${esc(x)}</li>`).join('');

function layout({ path, title, desc, h1, kicker, lead, body, crumbs, schema, extraSchema, waMsg }) {
  const ld = [
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map(([n, u], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: SITE + u })) },
    schema,
    ...(extraSchema ? [extraSchema] : []),
  ];
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <meta name="theme-color" content="#0b0b0c" />
  <link rel="canonical" href="${SITE}${path}" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="pt_BR" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:image" content="${SITE}/og-image.jpg" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <script type="application/ld+json">${JSON.stringify(ld)}</script>
  <script type="module" src="/src/page.js"></script>
</head>
<body class="page lp">
  <header class="page-header">
    <div class="container page-header__bar">
      <a href="/" aria-label="TFM Revestimentos — início"><img src="/img/logo-tfm.webp" alt="TFM Revestimentos" width="112" height="36" /></a>
      <nav class="lp-nav nav" aria-label="Principal"><ul><li><a href="/">Início</a></li><li class="dd" data-dd><button type="button" class="dd__btn" aria-expanded="false" aria-controls="dd-solucoes">Soluções<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3"/></svg></button><div class="dd__panel" id="dd-solucoes"><div class="dd__col"><p class="dd__title">Processos</p><a href="/processos/hvof.html"><strong>HVOF</strong><span>Carbetos de alta dureza</span></a><a href="/processos/arc-spray.html"><strong>Arc Spray</strong><span>Recuperação dimensional</span></a><a href="/processos/laser-cladding.html"><strong>Laser Cladding <em class="badge-new">novo</em></strong><span>Robô industrial móvel</span></a><a href="/processos/pta.html"><strong>PTA</strong><span>Camada soldada</span></a><a href="/processos/arco-submerso.html"><strong>Arco Submerso</strong><span>Reconstrução de grandes volumes</span></a><a href="/processos/cromo-duro.html"><strong>Cromo duro</strong><span>Baixo atrito e espelhamento</span></a></div><div class="dd__col"><p class="dd__title">Setores</p><a href="/setores/mineracao.html">Mineração</a><a href="/setores/oleo-e-gas.html">Óleo &amp; Gás</a><a href="/setores/siderurgia.html">Siderurgia</a><a href="/setores/naval.html">Naval</a><a href="/setores/papel-e-celulose.html">Papel e Celulose</a><a href="/setores/metal-mecanica.html">Metal Mecânica</a><a href="/setores/textil.html">Têxtil</a><a href="/setores/eolica.html">Energia Eólica</a></div><div class="dd__cta"><p>Não sabe qual processo usar?</p><a href="/#solucoes" class="link-arrow">Guia de desgaste</a></div></div></li><li><a href="/#cases">Cases</a></li></ul><a class="btn btn--flame btn--sm" href="/#contato"><span>Orçamento</span></a></nav>
    </div>
  </header>
  <main id="conteudo" class="container lp-main">
    <nav class="crumbs" aria-label="Você está em">${crumbs.map(([n, u], i) => (i < crumbs.length - 1 ? `<a href="${u}">${esc(n)}</a><span aria-hidden="true">/</span>` : `<span aria-current="page">${esc(n)}</span>`)).join('')}</nav>
    <p class="kicker"><span>TFM</span> ${esc(kicker)}</p>
    <h1 class="section-title">${esc(h1)}</h1>
    <p class="lp-lead">${esc(lead)}</p>
    <div class="lp-ctas">
      <a class="btn btn--flame" href="${WA(waMsg || 'Olá, tudo bem? Queria mandar umas fotos de uma peça para vocês avaliarem.')}" target="_blank" rel="noopener" data-wa-origin="lp_${path.split('/').pop().replace('.html', '')}"><span>Enviar foto da peça no WhatsApp</span></a>
      <a class="btn btn--ghost" href="/#contato"><span>Solicitar orçamento</span></a>
    </div>
    ${body}
    <section class="lp-band">
      <h2>Tem uma peça para avaliar?</h2>
      <p>Envie fotos e medidas. A engenharia TFM responde com o diagnóstico e a solução recomendada. Unidades em Alumínio (SP), Rio das Ostras (RJ) e Nova Friburgo (RJ). Atendimento 24h.</p>
      <a class="btn btn--flame" href="${WA(waMsg || 'Olá, tudo bem? Queria falar com a engenharia de vocês sobre uma peça.')}" target="_blank" rel="noopener"><span>Falar com a engenharia</span></a>
    </section>
  </main>
  <footer class="page-footer">
    <div class="container lp-foot">
      <div><strong>Processos</strong>${processos.map((p) => `<a href="/processos/${p.slug}.html">${esc(p.nome)}</a>`).join('')}</div>
      <div><strong>Setores</strong>${setores.map((s) => `<a href="/setores/${s.slug}.html">${esc(s.nome)}</a>`).join('')}</div>
      <p>© <span data-year>2026</span> Grupo TFM Revestimentos · <a href="/privacidade.html">Privacidade</a> · <a href="#" data-consent-open>Preferências de cookies</a></p>
    </div>
  </footer>
</body>
</html>
`;
}

mkdirSync('processos', { recursive: true });
mkdirSync('setores', { recursive: true });
const urls = [];

// vitrine animada do laser (mesmo desenho da home)
const home = readFileSync('index.html', 'utf8');
const laserStage = (() => { const a = home.indexOf('<figure class="laser__stage"'); const z = home.indexOf('</figure>', a) + 9; return a > 0 ? home.slice(a, z) : ''; })();

for (const p of processos) {
  const path = `/processos/${p.slug}.html`;
  const usados = setores.filter((s) => s.processos.includes(p.slug));
  const vitrine = p.slug === 'laser-cladding' && laserStage ? `<section class="lp-laser laser" data-laser>${laserStage}</section>` : '';
  const body = `${vitrine}
    <div class="lp-grid">
      <section><h2>Como funciona</h2><p>${esc(p.como)}</p></section>
      <section><h2>Benefícios</h2><ul class="lp-list">${li(p.beneficios)}</ul></section>
      <section><h2>Materiais aplicados</h2><ul class="chips chips--lg">${li(p.materiais)}</ul></section>
      <section><h2>Aplicações típicas</h2><ul class="lp-list">${li(p.aplicacoes)}</ul></section>
    </div>
    ${p.caso ? `<section class="lp-case"><p class="kicker"><span>Case</span> Resultado real</p><p>${esc(p.caso)}</p></section>` : ''}
    ${p.faq ? `<section class="lp-related lp-faq"><h2>Perguntas frequentes</h2>${p.faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}</section>` : ''}
    <section class="lp-related"><h2>Setores que usam ${esc(p.nome)}</h2><div class="lp-links">${usados.map((s) => `<a href="/setores/${s.slug}.html">${esc(s.nome)} →</a>`).join('')}</div></section>`;
  writeFileSync(`.${path}`, layout({
    path, kicker: 'Processo', waMsg: `Olá, tudo bem? Vi no site sobre ${p.nome === 'Cromo duro' ? 'o cromo duro' : p.nome} e queria saber se serve para uma peça minha. Posso mandar umas fotos?`, h1: p.titulo, lead: p.resumo, body,
    title: `${p.titulo} | TFM Revestimentos — SP e RJ`,
    desc: `${p.resumo} Recuperação e revestimento de peças industriais com garantia. Unidades em SP e RJ.`,
    crumbs: [['Início', '/'], ['Processos', '/#tecnologias'], [p.nome, path]],
    extraSchema: p.faq ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: p.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) } : null,
    schema: { '@context': 'https://schema.org', '@type': 'Service', name: p.titulo, serviceType: p.nome, description: p.resumo, areaServed: 'BR', provider: { '@type': 'Organization', name: 'Grupo TFM Revestimentos', url: SITE } },
  }));
  urls.push(path);
}

for (const s of setores) {
  const path = `/setores/${s.slug}.html`;
  const extra = s.slug === 'eolica' ? readFileSync('scripts/partials/eolica-explode.html', 'utf8') : '';
  const body = `${extra}
    <div class="lp-grid">
      <section><h2>Peças que recuperamos</h2><ul class="lp-list">${li(s.pecas)}</ul></section>
      <section><h2>Processos indicados</h2><div class="lp-links">${s.processos.map((k) => `<a href="/processos/${k}.html"><strong>${esc(byslug[k].nome)}</strong> — ${esc(byslug[k].resumo)}</a>`).join('')}</div></section>
    </div>
    <section class="lp-related"><h2>Por que a TFM</h2><ul class="lp-list">${li(['Todos os processos certificados e com garantia', 'Laboratório de metrologia certificado', 'Laser cladding robotizado e móvel', 'Atendimento 24h e serviço de campo na sua planta'])}</ul></section>`;
  writeFileSync(`.${path}`, layout({
    path, kicker: 'Setor', waMsg: `Olá, tudo bem? Vi no site que vocês atendem o setor de ${s.nome.toLowerCase().replace('&', 'e')}. Queria mandar fotos de uma peça para vocês avaliarem.`, h1: `Revestimentos e recuperação de peças para ${s.nome}`, lead: s.texto, body,
    title: `Recuperação de peças para ${s.nome} | TFM Revestimentos`,
    desc: `${s.texto} HVOF, laser cladding, PTA, cromo duro e usinagem de precisão.`,
    crumbs: [['Início', '/'], ['Setores', '/#setores'], [s.nome, path]],
    schema: { '@context': 'https://schema.org', '@type': 'Service', name: `Revestimentos industriais para ${s.nome}`, audience: { '@type': 'BusinessAudience', name: s.nome }, areaServed: 'BR', provider: { '@type': 'Organization', name: 'Grupo TFM Revestimentos', url: SITE } },
  }));
  urls.push(path);
}

// glossário técnico
{
  const path = '/glossario.html';
  const slug = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const body = `
    <nav class="gl-index" aria-label="Termos">${glossario.map(([t]) => `<a href="#${slug(t)}">${esc(t)}</a>`).join('')}</nav>
    <dl class="gl-list">${glossario.map(([t, d]) => `<div id="${slug(t)}"><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join('')}</dl>`;
  writeFileSync(`.${path}`, layout({
    path, kicker: 'Conhecimento', h1: 'Glossário de revestimentos e recuperação de peças', lead: 'Os principais termos de aspersão térmica, soldagem de revestimento e engenharia de superfícies, explicados de forma direta.', body,
    title: 'Glossário técnico de revestimentos | TFM Revestimentos', desc: 'Glossário de aspersão térmica, HVOF, laser cladding, PTA, cromo duro, diluição, porosidade e outros termos de engenharia de superfícies.',
    crumbs: [['Início', '/'], ['Glossário', path]],
    schema: { '@context': 'https://schema.org', '@type': 'DefinedTermSet', name: 'Glossário TFM', hasDefinedTerm: glossario.map(([t, d]) => ({ '@type': 'DefinedTerm', name: t, description: d })) },
  }));
  urls.push(path);
}

const all = ['/', '/privacidade.html', ...urls];
writeFileSync('public/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all.map((u) => `  <url><loc>${SITE}${u}</loc><changefreq>${u === '/' ? 'monthly' : 'yearly'}</changefreq><priority>${u === '/' ? '1.0' : u.includes('privacidade') ? '0.2' : '0.8'}</priority></url>`).join('\n')}
</urlset>
`);
console.log(`${urls.length} páginas geradas`);
