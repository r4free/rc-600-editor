# RC-600 Editor — Feature registry / Registro de funcionalidades

**Version:** pre-release · **Updated:** 2026-10-03

Shared ritual: https://github.com/r4free/boss-editor-guidelines (`shared/feature-registry.mdc`).

## EN

### Shipped

- **Paid activation:** on the hosted site, the first screen asks for a license key, links to Stripe Checkout to buy one, and links to the user guide. The key is sent by email after the payment. The editor pages and scripts stay on the server until that key is accepted. The guide itself can be opened from that screen. Local development still opens the editor without a key.
- **User guide:** the Guide link opens an English beginner walkthrough in a new tab, with real editor screenshots, all main tabs and sub-tabs, file/MIDI workflows, troubleshooting, light/dark themes and browser printing to PDF.
- Memory / looper oriented web editor for the Boss RC-600.
- Horizontal editor tabs and English-only UI (see Cursor rules).
- Links to sibling VG / GM / GT / TONEX editors.
- On iPhone/iPad browsers without Web MIDI, a dismissible warning recommends opening the site in **Web MIDI Browser** (App Store), and MIDI Connect is enabled when that API is present.
- **Setlists:** live charts, score guides, and setlist editing are part of the editor. On the hosted site they open with the same license key as the rest of the app. Setlists already saved in this browser stay in this browser.
- **Keep playing** on alphaTab scores (opt-in): audio keeps going after you close the live viewer or leave Setlists. A floating mini-player shows the song on any screen and restores the viewer; the toggle is remembered in this browser. Stop, turning Keep playing off, or the end of the piece clears the session (playback itself does not resume after a full page reload).

### Partial

- Expand this registry as user-visible capabilities ship.

### Known limitations

- Safari and Chrome on iOS do not expose Web MIDI; live pedal control needs Web MIDI Browser (or a desktop Chrome/Edge session).
- On the hosted site, a license key is required before the editor loads. The same gate is on locally when `RC600_REQUIRE_LICENSE=1` is set, so the activation page can be tried before a key is entered.

## PT

### Entregue

- **Ativação paga:** no site hospedado, a primeira tela pede a chave de licença, leva ao Stripe Checkout para comprar uma, e tem o link do guia. A chave é enviada por e-mail depois do pagamento. Páginas e scripts do editor ficam no servidor até a chave ser aceita. O guia em si abre a partir dessa tela. No desenvolvimento local, o editor ainda abre sem chave.
- **Guia de uso:** o link Guide abre em nova aba um passo a passo em inglês para iniciantes, com capturas reais do editor, abas e subabas, fluxos de arquivos/MIDI, solução de problemas, temas claro/escuro e impressão em PDF pelo navegador.
- Editor web orientado a memória / looper para o Boss RC-600.
- Abas horizontais e UI só em inglês (ver Cursor rules).
- Links para os editores irmãos VG / GM / GT / TONEX.
- Em iPhone/iPad sem Web MIDI, um aviso dispensável recomenda abrir o site no **Web MIDI Browser** (App Store), e o Connect MIDI é liberado quando essa API existe.
- **Setlists:** charts ao vivo, partituras e edição de setlist fazem parte do editor. No site hospedado eles abrem com a mesma chave de licença do restante do aplicativo. Setlists já salvos neste navegador continuam neste navegador.
- **Keep playing** nas partituras alphaTab (opcional): o áudio continua depois de fechar a view ao vivo ou sair de Setlists. Um mini-player flutuante mostra a música em qualquer tela e restaura o viewer; o toggle fica lembrado neste navegador. Stop, desligar Keep playing ou o fim da peça limpam a sessão (a reprodução em si não retoma após um reload completo).

### Parcial

- Expandir este registro conforme capacidades visíveis forem lançadas.

### Limitações conhecidas

- Safari e Chrome no iOS não expõem Web MIDI; o controle ao vivo do pedal exige o Web MIDI Browser (ou Chrome/Edge no computador).
- No site hospedado, a chave de licença é exigida antes de o editor carregar. A mesma trava vale no local quando `RC600_REQUIRE_LICENSE=1` está ligado, para testar a tela de ativação antes de informar a chave.

## Changelog

### 2026-10-03

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
