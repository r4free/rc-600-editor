# RC-600 Editor — Feature registry / Registro de funcionalidades

**Version:** pre-release · **Updated:** 2026-09-21

Shared ritual: https://github.com/r4free/boss-editor-guidelines (`shared/feature-registry.mdc`).

## EN

### Shipped

- Memory / looper oriented web editor for the Boss RC-600.
- Horizontal editor tabs and English-only UI (see Cursor rules).
- Links to sibling VG / GM / GT / TONEX editors.
- On iPhone/iPad browsers without Web MIDI, a dismissible warning recommends opening the site in **Web MIDI Browser** (App Store), and MIDI Connect is enabled when that API is present.
- **Setlists (Full plan):** live charts, score guides, and setlist editing unlock with a Full plan access key (up to 3 browsers per key). The rest of the editor stays free. Local development unlocks Setlists without a key. Setlists already saved in this browser are kept and return when unlocked.
- **Keep playing** on alphaTab scores (opt-in): audio keeps going after you close the live viewer or leave Setlists. A floating mini-player shows the song on any screen and restores the viewer; the toggle is remembered in this browser. Stop, turning Keep playing off, or the end of the piece clears the session (playback itself does not resume after a full page reload).

### Partial

- Expand this registry as user-visible capabilities ship.

### Known limitations

- Safari and Chrome on iOS do not expose Web MIDI; live pedal control needs Web MIDI Browser (or a desktop Chrome/Edge session).
- On the public hosted site, Setlists need a Full plan key; without it the Setlists tab shows the unlock panel.

## PT

### Entregue

- Editor web orientado a memória / looper para o Boss RC-600.
- Abas horizontais e UI só em inglês (ver Cursor rules).
- Links para os editores irmãos VG / GM / GT / TONEX.
- Em iPhone/iPad sem Web MIDI, um aviso dispensável recomenda abrir o site no **Web MIDI Browser** (App Store), e o Connect MIDI é liberado quando essa API existe.
- **Setlists (plano Full):** charts ao vivo, partituras e edição de setlist desbloqueiam com uma chave do plano Full (até 3 navegadores por chave). O restante do editor continua grátis. No desenvolvimento local, Setlists ficam liberados sem chave. Setlists já salvos neste navegador são mantidos e voltam ao desbloquear.
- **Keep playing** nas partituras alphaTab (opcional): o áudio continua depois de fechar a view ao vivo ou sair de Setlists. Um mini-player flutuante mostra a música em qualquer tela e restaura o viewer; o toggle fica lembrado neste navegador. Stop, desligar Keep playing ou o fim da peça limpam a sessão (a reprodução em si não retoma após um reload completo).

### Parcial

- Expandir este registro conforme capacidades visíveis forem lançadas.

### Limitações conhecidas

- Safari e Chrome no iOS não expõem Web MIDI; o controle ao vivo do pedal exige o Web MIDI Browser (ou Chrome/Edge no computador).
- No site público hospedado, Setlists pedem chave do plano Full; sem ela a aba mostra o painel de desbloqueio.

## Changelog

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
