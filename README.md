# RC-600 Web Editor

Editor web para o Boss RC-600: abre a pasta `ROLAND` (USB Storage ou backup), edita memórias/system nos arquivos `.RC0`, e controla o pedal ao vivo via Web MIDI (Program Change + CC).

Gravar `.RC0` (Save / Copy) passa por uma API no servidor que monta o XML. Sem o servidor online, a tela ainda edita; o arquivo da pedaleira não é materializado.

**Guidelines:** [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) · [docs/FEATURES.md](./docs/FEATURES.md) · shared: [boss-editor-guidelines](https://github.com/r4free/boss-editor-guidelines)

## Rodar (dev)

```bash
npm install
npm run dev
```

Sobe a API em **http://127.0.0.1:5191** e o Vite em **http://127.0.0.1:5190** (proxy `/api`). Abra o Vite no Chrome/Edge.

O select da barra superior abre o VG-800, GM-800 ou TONEX Pedal (`https://vg.test` / `https://gm.test` / `https://tonex-pedal-editor.test` no local; `https://vg-800-editor.onrender.com` / `https://gm-800-editor.onrender.com` / `https://tonex-pedal-editor.onrender.com` em produção).

**Modo público (padrão):** assemble aberto, sem tela de unlock. Ideal enquanto divulga o beta.

## License keys (quando quiser fechar)

```bash
# gera uma key de teste (14 dias)
npm run license:create -- --days 14 --note "beta alice"
```

As keys vão hasheadas em `data/licenses.json` (gitignored). Formato: `RC600-XXXX-XXXX-XXXX`.

Para **exigir** license no Save:

```bash
RC600_REQUIRE_LICENSE=1 RC600_SESSION_SECRET=… npm start
```

Com a flag ligada, a UI pede a key e a sessão respeita a data de expiração.

## Produção (Render)

No dashboard do Web Service:

- **Root Directory:** (vazio — raiz do repo)
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`  
  (= `tsx server/index.ts` — **não** use `src/server/...`)

Ou use o [`render.yaml`](render.yaml) do repo.

```bash
npm run build
RC600_SESSION_SECRET=… npm start
# opcional: RC600_REQUIRE_LICENSE=1
```

O processo escuta `0.0.0.0:$PORT` e serve `dist/web` + `/api`. Web MIDI precisa de HTTPS (ou localhost).

Copiar só a pasta estática **não** basta: Save/Copy exigem a API.

## Fluxo

1. Abrir o editor (público) ou ativar license (se `RC600_REQUIRE_LICENSE=1`)
2. Backup da pasta `ROLAND` do looper
3. **Abrir pasta** (ou ZIP) no editor
4. Edite tracks / FX / ASSIGN / system (local, instantâneo)
5. **Salvar** chama `/api/assemble` e grava o par A/B com `<count>` incrementado
6. Opcional: MIDI USB para memória / transporte / CC

## Testes

```bash
npm test
```

## Notas

- Não regenera XML do zero — patch in-place **no servidor**
- WAVE/ e EDITOR.RCE não sobem na API
- Sem SysEx de parâmetros (o RC-600 não expõe mapa público)
