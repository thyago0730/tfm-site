// Gera páginas estáticas por processo e por setor (SEO local) a partir de pages-data.mjs.
// Uso: node scripts/build-pages.mjs  (rodado automaticamente antes do build)
import { mkdirSync, writeFileSync } from 'node:fs';
import { processos, setores } from './pages-data.mjs';

const SITE = 'https://tfmrevestimentos.com.br';
const WA = (m) => `https://wa.me/5511950427669?text=${encodeURIComponent(m)}`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const byslug = Object.fromEntries(processos.map((p) => [p.slug, p]));
const li = (arr) => arr.map((x) => `<li>${esc(x)}</li>`).join('');

function layout({ path, title, desc, h1, kicker, lead, body, crumbs, schema }) {
  const ld = [
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map(([n, u], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: SITE + u })) },
    schema,
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
  <a class="skip-link" href="#conteudo">Pular para o conteúdo</a>
  <header class="page-header">
    <div class="container page-header__bar">
      <a href="/" aria-label="TFM Revestimentos — início"><img src="/img/logo-tfm.webp" alt="TFM Revestimentos" width="112" height="36" /></a>
      <nav class="lp-nav" aria-label="Principal"><a href="/#servicos">Serviços</a><a href="/#setores">Setores</a><a href="/#cases">Cases</a><a class="btn btn--flame btn--sm" href="/#contato"><span>Orçamento</span></a></nav>
    </div>
  </header>
  <main id="conteudo" class="container lp-main">
    <nav class="crumbs" aria-label="Você está em">${crumbs.map(([n, u], i) => (i < crumbs.length - 1 ? `<a href="${u}">${esc(n)}</a><span aria-hidden="true">/</span>` : `<span aria-current="page">${esc(n)}</span>`)).join('')}</nav>
    <p class="kicker"><span>TFM</span> ${esc(kicker)}</p>
    <h1 class="section-title">${esc(h1)}</h1>
    <p class="lp-lead">${esc(lead)}</p>
    <div class="lp-ctas">
      <a class="btn btn--flame" href="${WA(`Olá, TFM! Vim pela página "${h1}" e quero enviar fotos de uma peça para avaliação.`)}" target="_blank" rel="noopener" data-wa-origin="lp_${path.split('/').pop().replace('.html', '')}"><span>Enviar foto da peça no WhatsApp</span></a>
      <a class="btn btn--ghost" href="/#contato"><span>Solicitar orçamento</span></a>
    </div>
    ${body}
    <section class="lp-band">
      <h2>Tem uma peça para avaliar?</h2>
      <p>Envie fotos e medidas. A engenharia TFM responde com o diagnóstico e a solução recomendada. Unidades em Alumínio (SP), Rio das Ostras (RJ) e Nova Friburgo (RJ). Atendimento 24h.</p>
      <a class="btn btn--flame" href="${WA('Olá, TFM! Quero enviar fotos de uma peça para avaliação.')}" target="_blank" rel="noopener"><span>Falar com a engenharia</span></a>
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

for (const p of processos) {
  const path = `/processos/${p.slug}.html`;
  const usados = setores.filter((s) => s.processos.includes(p.slug));
  const body = `
    <div class="lp-grid">
      <section><h2>Como funciona</h2><p>${esc(p.como)}</p></section>
      <section><h2>Benefícios</h2><ul class="lp-list">${li(p.beneficios)}</ul></section>
      <section><h2>Materiais aplicados</h2><ul class="chips chips--lg">${li(p.materiais)}</ul></section>
      <section><h2>Aplicações típicas</h2><ul class="lp-list">${li(p.aplicacoes)}</ul></section>
    </div>
    ${p.caso ? `<section class="lp-case"><p class="kicker"><span>Case</span> Resultado real</p><p>${esc(p.caso)}</p></section>` : ''}
    <section class="lp-related"><h2>Setores que usam ${esc(p.nome)}</h2><div class="lp-links">${usados.map((s) => `<a href="/setores/${s.slug}.html">${esc(s.nome)} →</a>`).join('')}</div></section>`;
  writeFileSync(`.${path}`, layout({
    path, kicker: 'Processo', h1: p.titulo, lead: p.resumo, body,
    title: `${p.titulo} | TFM Revestimentos — SP e RJ`,
    desc: `${p.resumo} Recuperação e revestimento de peças industriais com garantia. Unidades em SP e RJ.`,
    crumbs: [['Início', '/'], ['Processos', '/#tecnologias'], [p.nome, path]],
    schema: { '@context': 'https://schema.org', '@type': 'Service', name: p.titulo, serviceType: p.nome, description: p.resumo, areaServed: 'BR', provider: { '@type': 'Organization', name: 'Grupo TFM Revestimentos', url: SITE } },
  }));
  urls.push(path);
}

for (const s of setores) {
  const path = `/setores/${s.slug}.html`;
  const body = `
    <div class="lp-grid">
      <section><h2>Peças que recuperamos</h2><ul class="lp-list">${li(s.pecas)}</ul></section>
      <section><h2>Processos indicados</h2><div class="lp-links">${s.processos.map((k) => `<a href="/processos/${k}.html"><strong>${esc(byslug[k].nome)}</strong> — ${esc(byslug[k].resumo)}</a>`).join('')}</div></section>
    </div>
    <section class="lp-related"><h2>Por que a TFM</h2><ul class="lp-list">${li(['Todos os processos certificados e com garantia', 'Laboratório de metrologia certificado', 'Projetos com metodologia Six Sigma (DFLSS)', 'Atendimento 24h e serviço de campo na sua planta'])}</ul></section>`;
  writeFileSync(`.${path}`, layout({
    path, kicker: 'Setor', h1: `Revestimentos e recuperação de peças para ${s.nome}`, lead: s.texto, body,
    title: `Recuperação de peças para ${s.nome} | TFM Revestimentos`,
    desc: `${s.texto} HVOF, plasma, PTA, cromo duro e usinagem de precisão.`,
    crumbs: [['Início', '/'], ['Setores', '/#setores'], [s.nome, path]],
    schema: { '@context': 'https://schema.org', '@type': 'Service', name: `Revestimentos industriais para ${s.nome}`, audience: { '@type': 'BusinessAudience', name: s.nome }, areaServed: 'BR', provider: { '@type': 'Organization', name: 'Grupo TFM Revestimentos', url: SITE } },
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
