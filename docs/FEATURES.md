# RC-600 Editor — Feature registry / Registro de funcionalidades

**Version:** pre-release · **Updated:** 2026-09-18

Shared ritual: https://github.com/r4free/boss-editor-guidelines (`shared/feature-registry.mdc`).

## EN

### Shipped

- Memory / looper oriented web editor for the Boss RC-600.
- Horizontal editor tabs and English-only UI (see Cursor rules).
- Links to sibling VG / GM / GT / TONEX editors.
- On iPhone/iPad browsers without Web MIDI, a dismissible warning recommends opening the site in **Web MIDI Browser** (App Store), and MIDI Connect is enabled when that API is present.
- **Setlists:** each setlist card has icon-only **Edit** and **View**. Clicking the card (or View) opens live view; Edit opens that setlist alone. New / Import / Export sit in the panel header.

### Partial

- Expand this registry as user-visible capabilities ship.

### Known limitations

- Safari and Chrome on iOS do not expose Web MIDI; live pedal control needs Web MIDI Browser (or a desktop Chrome/Edge session).

## PT

### Entregue

- Editor web orientado a memória / looper para o Boss RC-600.
- Abas horizontais e UI só em inglês (ver Cursor rules).
- Links para os editores irmãos VG / GM / GT / TONEX.
- Em iPhone/iPad sem Web MIDI, um aviso dispensável recomenda abrir o site no **Web MIDI Browser** (App Store), e o Connect MIDI é liberado quando essa API existe.
- **Setlists:** cada card tem **Edit** e **View** só com ícone. Clicar no card (ou em View) abre a view ao vivo; Edit abre só aquela setlist. New / Import / Export ficam no cabeçalho.

### Parcial

- Expandir este registro conforme capacidades visíveis forem lançadas.

### Limitações conhecidas

- Safari e Chrome no iOS não expõem Web MIDI; o controle ao vivo do pedal exige o Web MIDI Browser (ou Chrome/Edge no computador).

## Changelog

### 2026-09-18

- **EN:** Clicking a setlist card opens live view (same as the View icon); Edit still opens that setlist’s editor only.
- **PT:** Clicar no card da setlist abre a view ao vivo (igual ao ícone View); Edit continua abrindo só o editor daquela setlist.
- **EN:** Setlist cards use icon-only **Edit** / **View**; editing opens one setlist (no all-setlists manager sidebar). New / Import / Export moved to the Setlists panel header.
- **PT:** Cards de setlist com **Edit** / **View** só ícone; a edição abre uma setlist (sem sidebar de todas). New / Import / Export foram para o cabeçalho da aba Setlists.

### 2026-09-17

- **EN:** On iOS browsers without Web MIDI, show a dismissible warning with an App Store link to Web MIDI Browser; allow MIDI when the browser exposes the API.
- **PT:** Em navegadores iOS sem Web MIDI, mostrar aviso dispensável com link da App Store para o Web MIDI Browser; liberar MIDI quando o navegador expõe a API.
- **EN:** Added bilingual feature registry stub and linked shared family guidelines.
- **PT:** Adicionado stub bilingue do registro de funcionalidades e link às diretrizes da família.
