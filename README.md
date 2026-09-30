# TFM Revestimentos — site institucional

Novo site da **TFM Revestimentos** (substitui o WordPress em tfmrevestimentos.com.br).
Página única, estática, rápida e pronta para qualquer hospedagem.

## Posicionamento

O site antigo vendia uma lista de serviços. O novo vende **resultado**: a TFM como parceira de
*engenharia de superfícies* que evita parada de linha, reduz custo e prolonga a vida útil de ativos críticos.

- **Promessa:** "Superfícies que resistem. Indústria que não para."
- **Argumento central:** recuperar custa menos que substituir e pode durar mais que a peça original
  (com o ângulo de economia circular e sustentabilidade).
- **Provas:** 70 HRC, atendimento 24h, Six Sigma DFLSS, laboratório de metrologia certificado,
  fusão por indução, certificado de garantia, cases reais e clientes como Gerdau, CSN e Votorantim.
- **Conversão:** CTA de orçamento sempre visível, WhatsApp flutuante e formulário que já chega
  formatado no WhatsApp ou no e-mail.

## Destaques de design e animação

| Recurso | Onde |
|---|---|
| Simulação de **aspersão térmica** em canvas: eixo girando, desgaste, deposição da camada, retífica e HUD técnico. A pistola segue o cursor. | Hero (`src/spray.js`) |
| Tipografia variável (Archivo, com eixo de largura) + mono técnica (JetBrains Mono) | Global |
| Scroll suave (Lenis) e animações sincronizadas ao scroll (GSAP ScrollTrigger / SplitText) | Global |
| Texto que "acende" palavra por palavra | Manifesto |
| Lista de serviços com prévia de imagem que segue o cursor | Serviços |
| Seção horizontal fixada (pin) com barra de progresso | Processo |
| Guia interativo "qual revestimento o seu desgaste pede?" | Soluções |
| Painéis expansíveis por setor (acordeão no mobile) | Setores |
| Carrossel arrastável com revelação por clip-path | Cases |
| Linha do tempo que se preenche no scroll | Sobre |
| Bento grid com spotlight e tilt 3D | Diferenciais |
| Cursor customizado, botões magnéticos, marquee reativo à velocidade, grão de filme | Global |

Acessibilidade: HTML semântico, navegação por teclado, `prefers-reduced-motion` (desliga animações
e mostra um quadro estático do hero), contraste AA e textos alternativos.

SEO: meta tags, Open Graph, JSON-LD (Organization + 3 unidades LocalBusiness), `sitemap.xml`,
`robots.txt` e redirecionamentos 301 de todas as URLs do WordPress antigo (`public/.htaccess`).

## Rodando

```bash
npm install
npm run dev       # desenvolvimento em http://localhost:5173
npm run build     # gera a pasta dist/
npm run preview   # serve o build
```

## Publicação

Envie **o conteúdo da pasta `dist/`** (incluindo o `.htaccess`) para a raiz do domínio.
Funciona em Apache (HostGator, Locaweb, KingHost etc.), Netlify, Vercel ou Cloudflare Pages.
Em hospedagens que não usam Apache, recrie os redirecionamentos do `.htaccess` no painel da plataforma.

## Editando conteúdo

- Textos, serviços, setores, cases e unidades: `index.html`.
- Cores, fontes e espaçamentos: variáveis no topo de `src/styles.css`.
- Número de WhatsApp e e-mail do formulário: constantes no topo de `src/main.js`.
- Imagens: `public/img/`. Para converter novas fotos para WebP, use `scripts/optimize-images.mjs`.
- PDFs (institucional e portfólio): `public/docs/`.

## Próximos passos recomendados

1. **Fotos profissionais** das peças e da planta (as atuais vieram do site antigo e estão em 585×415).
2. **Formulário com backend** (Formspree, Getform ou RD Station) para registrar leads, mantendo o WhatsApp como alternativa.
3. **Páginas por setor e por processo** (ex.: "HVOF para mineração") para capturar buscas orgânicas.
4. **Números de impacto** dos cases (vida útil antes/depois, economia em R$), com autorização dos clientes.
5. Google Analytics 4 / Tag Manager e Google Business Profile para as três unidades.
