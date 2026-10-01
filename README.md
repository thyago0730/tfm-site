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
| Jornada real de uma peça (5 etapas com fotos da planta) e comparativos antes/depois arrastáveis | Antes & depois (`src/journey.js`) |
| Matriz interativa processo × material (Chama Pó, Arc Spray, PTA, HVOF) | Tecnologias (`src/matrix.js`) |
| Simulador "recuperar × substituir": economia, dias de parada, aço e CO₂ evitados | Simulador (`src/simulator.js`) |
| Orçamento em 4 etapas, com resumo e simulação anexada, enviado por WhatsApp ou e-mail | Orçamento (`src/wizard.js`) |
| Link do guia de soluções para o case relacionado, cópia de contatos, barra de leitura | Global |
| Widget de WhatsApp com atalhos (foto da peça, emergência, orçamento, serviço de campo) e convite após engajamento | Global (`src/whatsapp.js`) |
| Escolha do processo na animação do hero (HVOF, Plasma, Arc Spray, PTA) | Hero |
| Menu Soluções com páginas de processo e setor | Global |
| Barra fixa no mobile (WhatsApp + Orçamento) | Mobile |
| Cursor customizado, botões magnéticos, marquee reativo à velocidade, grão de filme | Global |

Acessibilidade: HTML semântico, navegação por teclado, `prefers-reduced-motion` (desliga animações
e mostra um quadro estático do hero), contraste AA e textos alternativos.

SEO: meta tags, Open Graph, JSON-LD (Organization, 3 unidades LocalBusiness e FAQPage), `sitemap.xml`,
`robots.txt`, página 404 e redirecionamentos 301 de todas as URLs do WordPress antigo
(`firebase.json` para Firebase Hosting e `public/.htaccess` para Apache).

Qualidade medida (Lighthouse, build de produção):

| | Performance | Acessibilidade | Boas práticas | SEO |
|---|---|---|---|---|
| Mobile | 93 | 100 | 100 | 100 |
| Desktop | 100 | 100 | 100 | 100 |

Auditoria axe-core (WCAG 2.1 AA + boas práticas): sem violações em todas as páginas.
Fontes hospedadas no próprio site (sem Google Fonts) e animação do hero com qualidade adaptativa.

## Rodando

```bash
npm install
npm run dev       # desenvolvimento em http://localhost:5173
npm run build     # gera a pasta dist/
npm run preview   # serve o build
```

## Publicação no Firebase Hosting (projeto `tfm-siteweb`)

Configuração pronta em `firebase.json` (redirecionamentos 301, cache e cabeçalhos de segurança) e `.firebaserc`.

**Deploy manual**, no seu computador:

```bash
npm install -g firebase-tools
firebase login
npm run build
firebase deploy --only hosting
```

**Deploy automático pelo GitHub** (recomendado): os workflows em `.github/workflows/` publicam o site
a cada push na `main` e geram um **link de prévia em cada pull request**. Para ativar, crie o segredo
`FIREBASE_SERVICE_ACCOUNT_TFM_SITEWEB` no repositório:

1. Firebase Console → Configurações do projeto → Contas de serviço → **Gerar nova chave privada**.
2. GitHub → Settings → Secrets and variables → Actions → **New repository secret**, cole o conteúdo do JSON.

Alternativa: `firebase init hosting:github` configura o segredo automaticamente (mantenha os workflows existentes quando perguntado).

Para usar o domínio `tfmrevestimentos.com.br`: Firebase Console → Hosting → **Adicionar domínio personalizado** e ajuste o DNS conforme indicado.

### Outras hospedagens

Envie o conteúdo de `dist/` (incluindo o `.htaccess`) para a raiz do domínio. Funciona em Apache
(HostGator, Locaweb, KingHost etc.), Netlify, Vercel ou Cloudflare Pages.

## Medição (Google Analytics 4 via Firebase)

O Analytics só é carregado **depois do consentimento** no banner de cookies (LGPD); a escolha pode ser
alterada no link "Preferências de cookies" do rodapé. Eventos enviados (também disponíveis em `window.dataLayer`
para o Google Tag Manager):

| Evento | Quando |
|---|---|
| `whatsapp_click` | qualquer clique que abre o WhatsApp, com `origem` (hero, cabecalho, processo, simulador, faq, contato, lp_<página>, widget_foto, widget_emergencia, widget_orcamento, widget_campo, widget_texto) |
| `whatsapp_widget_aberto` | abertura do widget de WhatsApp |
| `cta_click` | clique em telefone, e-mail, PDFs e botões de orçamento (`cta`, `secao`) |
| `simulacao_enviada` | simulação levada para o orçamento (`economia`) |
| `orcamento_etapa` | avanço no orçamento em etapas (`etapa`) |
| `orcamento_enviado` + `generate_lead` | envio do orçamento (`canal`: whatsapp ou email) |

Marque `generate_lead` e `whatsapp_click` como **eventos-chave** no GA4 e crie um relatório por `origem`
para descobrir quais seções mais geram conversas no WhatsApp.
Recomendado: no Google Cloud Console, restrinja a chave de API do Firebase aos domínios do site.

## Editando conteúdo

- Textos, serviços, setores, cases e unidades: `index.html`.
- Cores, fontes e espaçamentos: variáveis no topo de `src/styles.css`.
- Número de WhatsApp e atalhos do widget: topo de `src/whatsapp.js`. E-mail do formulário: topo de `src/main.js`.
- Premissas do simulador (valores iniciais e fator de CO₂): topo de `src/simulator.js`.
- Configuração do Firebase: `src/analytics.js`.
- Imagens: `public/img/`. Para converter novas fotos para WebP, use `scripts/optimize-images.mjs`.
- PDFs (institucional e portfólio): `public/docs/`.

## Próximos passos recomendados

1. **Fotos profissionais** das peças e da planta (as atuais vieram do site antigo e estão em 585×415).
2. **Registrar leads no Firestore ou em um CRM** (RD Station, HubSpot), mantendo o WhatsApp como canal de envio.
3. Mais conteúdo técnico (artigos e glossário) ligado às páginas de processo.
4. **Números de impacto** dos cases (vida útil antes/depois, economia em R$), com autorização dos clientes.
5. Google Business Profile para as três unidades e CNPJ na política de privacidade.
6. Confirmar se há certificação ISO 9001 (aparece na apresentação institucional) para destacá-la no site.

## Páginas de processo e setor (SEO)

Geradas por `scripts/build-pages.mjs` a partir de `scripts/pages-data.mjs` (roda no `npm run build`). Para criar uma nova página, adicione um item em `pages-data.mjs`.
