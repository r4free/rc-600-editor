# RC-600 Editor — Feature registry / Registro de funcionalidades

**Version:** pre-release · **Updated:** 2026-10-03

Shared ritual: https://github.com/r4free/boss-editor-guidelines (`shared/feature-registry.mdc`).

## EN

### Shipped

- **Navigation breadcrumb:** the path above the workspace content follows the currently visible tabs, including nested tracks, routing and EQ channels. Earlier levels return focus to that level's tabs without resetting edits or changing the pedal.
- **3D Model panel:** next to Chain, open a photo-textured RC-600 model with rotation, keyboard controls, zoom, panel and rear views. This first integration is visual only.

- **Paid activation:** on the hosted site, a welcoming first screen introduces the editor's memory, backup/MIDI, and performance tools; returning users can enter a license key, while new users can open Stripe Checkout or explore the user guide. The key is sent by email after payment. The editor pages and scripts stay on the server until that key is accepted. Local development still opens the editor without a key.
- **User guide:** the Guide link opens an English beginner walkthrough in a new tab, with real editor screenshots, all main tabs and sub-tabs, file/MIDI workflows, troubleshooting, light/dark themes and browser printing to PDF.
- Memory / looper oriented web editor for the Boss RC-600.
- Horizontal editor tabs and English-only UI (see Cursor rules).
- Links to sibling VG / GM / GT / TONEX editors.
- On iPhone/iPad browsers without Web MIDI, a dismissible warning recommends opening the site in **Web MIDI Browser** (App Store), and MIDI Connect is enabled when that API is present.
- **Setlists:** live charts, score guides, and setlist editing are part of the editor. On the hosted site they open with the same license key as the rest of the app. Setlists already saved in this browser stay in this browser.
- **Keep playing** on alphaTab scores (opt-in): audio keeps going after you close the live viewer or leave Setlists. A floating mini-player shows the song on any screen and restores the viewer; the toggle is remembered in this browser. Stop, turning Keep playing off, or the end of the piece clears the session (playback itself does not resume after a full page reload).
- **Comfortable dark interface:** clearer headings and parameter groups, roomier controls, softer panels, consistent keyboard focus and selection states, and a prominent unsaved-changes indicator make the existing editor easier to scan without changing its navigation or workflows.
- **Quick volume controls:** track, mixer, and effect volume parameters move to the top of their group and use a compact segmented slider. Active bars graduate through green up to 100, then orange, red, and dark red above 100.
- **Centered pan controls:** track and effect pan parameters use a compact segmented slider whose tall ends and low center make the stereo position immediately visible. When Volume and Pan share a group, they form a two-column quick-control header.
- **Drag-select All Start and All Stop tracks:** in Loop → Play, each group uses one responsive row of compact translucent track cards; the cards wrap onto more rows on narrow screens. The flat cards avoid decorative glow, the whole card toggles the track with a red **OFF** or green **ON** badge, and dragging across cards switches the crossed range.

### Partial

- Expand this registry as user-visible capabilities ship.

### Known limitations

- The 3D model uses approximate geometry and photographs; controls and sockets have no individual meshes, hotspots or editor navigation yet.

- Safari and Chrome on iOS do not expose Web MIDI; live pedal control needs Web MIDI Browser (or a desktop Chrome/Edge session).
- On the hosted site, a license key is required before the editor loads. The same gate is on locally when `RC600_REQUIRE_LICENSE=1` is set, so the activation page can be tried before a key is entered.

## PT

### Entregue

- **Breadcrumb de navegação:** o caminho acima do conteúdo acompanha as abas visíveis, incluindo pistas, roteamento e canais EQ aninhados. Níveis anteriores devolvem o foco às abas daquele nível sem reiniciar a edição nem alterar a pedaleira.
- **Painel 3D Model:** ao lado de Chain, abre um modelo da RC-600 com fotos como texturas, rotação, controles por teclado, zoom e vistas do painel e da traseira. Esta primeira integração é apenas visual.

- **Ativação paga:** no site hospedado, uma tela inicial mais acolhedora apresenta os recursos de memórias, backup/MIDI e performance do editor; quem já comprou informa a chave, enquanto novos usuários podem abrir o Stripe Checkout ou conhecer o guia. A chave é enviada por e-mail depois do pagamento. Páginas e scripts do editor ficam no servidor até a chave ser aceita. No desenvolvimento local, o editor ainda abre sem chave.
- **Guia de uso:** o link Guide abre em nova aba um passo a passo em inglês para iniciantes, com capturas reais do editor, abas e subabas, fluxos de arquivos/MIDI, solução de problemas, temas claro/escuro e impressão em PDF pelo navegador.
- Editor web orientado a memória / looper para o Boss RC-600.
- Abas horizontais e UI só em inglês (ver Cursor rules).
- Links para os editores irmãos VG / GM / GT / TONEX.
- Em iPhone/iPad sem Web MIDI, um aviso dispensável recomenda abrir o site no **Web MIDI Browser** (App Store), e o Connect MIDI é liberado quando essa API existe.
- **Setlists:** charts ao vivo, partituras e edição de setlist fazem parte do editor. No site hospedado eles abrem com a mesma chave de licença do restante do aplicativo. Setlists já salvos neste navegador continuam neste navegador.
- **Keep playing** nas partituras alphaTab (opcional): o áudio continua depois de fechar a view ao vivo ou sair de Setlists. Um mini-player flutuante mostra a música em qualquer tela e restaura o viewer; o toggle fica lembrado neste navegador. Stop, desligar Keep playing ou o fim da peça limpam a sessão (a reprodução em si não retoma após um reload completo).
- **Interface escura mais confortável:** títulos e grupos de parâmetros mais claros, controles mais espaçosos, painéis mais suaves, estados consistentes de foco e seleção por teclado e um indicador destacado de alterações não salvas facilitam explorar o editor sem mudar sua navegação ou seus fluxos.
- **Controles rápidos de volume:** parâmetros de volume de pistas, mixer e efeitos aparecem primeiro no grupo com slider segmentado compacto. As barras ativas passam em degradê por verde até 100 e depois por laranja, vermelho e vermelho escuro acima de 100.
- **Controles de pan centralizados:** parâmetros de pan de pistas e efeitos usam um slider segmentado compacto, com pontas altas e centro baixo para mostrar imediatamente a posição estéreo. Quando Volume e Pan estão no mesmo grupo, eles formam um cabeçalho de controles rápidos em duas colunas.
- **Seleção de pistas All Start e All Stop por arraste:** em Loop → Play, cada grupo usa uma linha responsiva de cards compactos e translúcidos, que se distribuem em mais linhas em telas estreitas. Os cards planos não têm glow decorativo; o card inteiro alterna a pista com indicador **OFF** vermelho ou **ON** verde, e o arraste muda todo o intervalo percorrido.

### Parcial

- Expandir este registro conforme capacidades visíveis forem lançadas.

### Limitações conhecidas

- O modelo 3D usa geometria aproximada e fotografias; controles e conectores ainda não possuem malhas individuais, hotspots ou navegação para o editor.

- Safari e Chrome no iOS não expõem Web MIDI; o controle ao vivo do pedal exige o Web MIDI Browser (ou Chrome/Edge no computador).
- No site hospedado, a chave de licença é exigida antes de o editor carregar. A mesma trava vale no local quando `RC600_REQUIRE_LICENSE=1` está ligado, para testar a tela de ativação antes de informar a chave.

## Changelog

### 2026-10-03

- **EN:** Volume meter colors now follow the actual parameter value: a green gradient through 100, then progressively orange, red, and dark red for boosted levels above 100.
- **PT:** As cores do medidor de volume agora acompanham o valor real: degradê verde até 100 e, acima disso, progressivamente laranja, vermelho e vermelho escuro.
- **EN:** Active bars in the compact Volume slider are now green, separating level feedback from the blue Pan position marker.
- **PT:** As barras ativas do slider compacto de Volume agora são verdes, diferenciando o nível do marcador azul de posição do Pan.
- **EN:** All Start and All Stop now use separate responsive rows of compact, translucent flat track cards without decorative glow or drop shadows. Green is limited to a subtle ON tint, border, and status badge.
- **PT:** All Start e All Stop agora usam linhas responsivas separadas de cards compactos, translúcidos e planos, sem glow decorativo nem sombras. O verde fica limitado a uma tonalidade sutil no ON, contorno e indicador de estado.
- **EN:** Volume and Pan sliders are now compact quick controls; when both are present, they sit side by side in a two-column header above the secondary settings.
- **PT:** Sliders de Volume e Pan agora são controles rápidos compactos; quando os dois estão presentes, ficam lado a lado em um cabeçalho de duas colunas acima dos ajustes secundários.
- **EN:** Track and effect pan settings now use a prominent centered slider with taller ends, a lower middle, and a clear current-position marker.
- **PT:** Ajustes de pan de pistas e efeitos agora usam um slider centralizado em destaque, com pontas maiores, meio menor e marcador claro da posição atual.
- **EN:** Track, mixer, and effect volume parameters now appear first in their group with a prominent numeric readout and segmented slider inspired by modern device volume controls.
- **PT:** Parâmetros de volume de pistas, mixer e efeitos agora aparecem primeiro no grupo, com leitura numérica destacada e slider segmentado inspirado em controles modernos de volume.
- **EN:** Added a breadcrumb that follows the actual active navigation hierarchy and a separate 3D Model panel reusing the existing RC-600 geometry and photographs, without parameter routing or hotspots.
- **PT:** Adicionados breadcrumb que acompanha a hierarquia real da navegação ativa e painel 3D Model separado, reutilizando a geometria e as fotografias existentes da RC-600, sem roteamento para parâmetros ou hotspots.

- **EN:** Refined the editor’s existing dark interface with clearer hierarchy and grouping, larger click targets, softer corners and borders, visible focus and selection cues, subtle reduced-motion-aware transitions, and a clearer save/discard area for pending edits.
- **PT:** Refinada a interface escura existente do editor com hierarquia e agrupamento mais claros, áreas de clique maiores, cantos e contornos mais suaves, sinais visíveis de foco e seleção, transições sutis que respeitam movimento reduzido e uma área mais clara de salvar/descartar alterações pendentes.
- **EN:** The activation screen now introduces the editor's main workflows, clearly separates returning users from new buyers, and uses a responsive two-column layout with a direct user-guide link.
- **PT:** A tela de ativação agora apresenta os principais fluxos do editor, separa claramente quem já tem licença de quem vai comprar e usa um layout responsivo em duas colunas com acesso direto ao guia.
- **EN:** The activation page has a Buy license button that opens Stripe Checkout. The license key is sent by email after the payment, not shown on a return page.
- **PT:** A página de ativação tem o botão Buy license, que abre o Stripe Checkout. A chave de licença é enviada por e-mail depois do pagamento, e não aparece numa página de retorno.
- **EN:** The early-development banner at the top of the editor is gone.
- **PT:** O aviso de desenvolvimento inicial no topo do editor foi removido.
- **EN:** The whole editor is one paid product. Setlists, charts, and the other tools open with the same license key. There is no separate free plan or Full plan unlock.
- **PT:** O editor inteiro é um produto pago. Setlists, charts e as demais ferramentas abrem com a mesma chave de licença. Não há plano grátis nem desbloqueio separado de plano Full.
- **EN:** The GitHub Sponsors notice no longer appears when the editor opens, and sponsor links are gone from the guide and Setlists unlock text.
- **PT:** O aviso de GitHub Sponsors deixa de aparecer ao abrir o editor, e os links de patrocínio saem do guia e do texto de desbloqueio de Setlists.
- **EN:** The hosted editor now starts on an activation page. Entering a valid license key is what loads the editor; until then the server does not send the editor files. The activation page links to the user guide, which stays available before activation. Local development stays open unless the license flag is turned on.
- **PT:** O editor hospedado passa a abrir numa página de ativação. A chave de licença válida é o que carrega o editor; até lá o servidor não envia os arquivos do editor. A página de ativação tem o link do guia, que continua disponível antes da ativação. O desenvolvimento local continua aberto, salvo se a flag de licença for ligada.

### 2026-09-30

- **EN:** Added the RC-600 user guide and top-bar Guide link, following the GM-800 guide design with device-specific instructions and screenshots.
- **PT:** Adicionados o guia do RC-600 e o link Guide no topo, seguindo o visual do guia GM-800 com instruções e capturas específicas deste editor.

### 2026-09-21

- **EN:** Setlists are a Full plan feature (same unlock model as the GM-800): editor stays free; unlock with an access key bound to up to 3 browsers. Local development keeps Setlists on.
- **PT:** Setlists passam a ser recurso do plano Full (mesmo modelo de desbloqueio do GM-800): o editor continua grátis; desbloqueio com chave em até 3 navegadores. No desenvolvimento local, Setlists seguem liberados.

### 2026-09-18

- **EN:** Setlist Edit layout matches the GM-800 polish: side padding, compact header, songs before **Add song**, one song open at a time, expand control at row end, nested Music guide + Triggers panels, **Delete setlist** in the footer, AI chart row side-by-side on desktop.
- **PT:** Layout do Edit de setlist alinhado ao GM-800: padding lateral, cabeçalho compacto, músicas antes de **Add song**, uma música aberta por vez, expandir no fim da linha, painéis internos Music guide + Triggers, **Delete setlist** no footer, linha de AI chart lado a lado no desktop.
- **EN:** The **Keep playing** toggle is stored in this browser’s local storage so it stays on after a reload.
- **PT:** O toggle **Keep playing** fica guardado no local storage deste navegador e permanece ligado após um reload.
- **EN:** Opt-in **Keep playing** on alphaTab scores: audio survives closing the live viewer or leaving Setlists; floating mini-player restores the song. Stop / toggle off / end of piece clears the session.
- **PT:** **Keep playing** opcional nas partituras alphaTab: o áudio sobrevive ao fechar a view ao vivo ou sair de Setlists; mini-player flutuante restaura a música. Stop / desligar / fim da peça limpam a sessão.
- **EN:** Clicking a setlist card opens live view (same as the View icon); Edit still opens that setlist’s editor only.
- **PT:** Clicar no card da setlist abre a view ao vivo (igual ao ícone View); Edit continua abrindo só o editor daquela setlist.
- **EN:** Setlist cards use icon-only **Edit** / **View**; editing opens one setlist (no all-setlists manager sidebar). New / Import / Export moved to the Setlists panel header.
- **PT:** Cards de setlist com **Edit** / **View** só ícone; a edição abre uma setlist (sem sidebar de todas). New / Import / Export foram para o cabeçalho da aba Setlists.

### 2026-09-17

- **EN:** On iOS browsers without Web MIDI, show a dismissible warning with an App Store link to Web MIDI Browser; allow MIDI when the browser exposes the API.
- **PT:** Em navegadores iOS sem Web MIDI, mostrar aviso dispensável com link da App Store para o Web MIDI Browser; liberar MIDI quando o navegador expõe a API.
- **EN:** Added bilingual feature registry stub and linked shared family guidelines.
- **PT:** Adicionado stub bilingue do registro de funcionalidades e link às diretrizes da família.
