# RC-600 Web Editor

Editor web para o Boss RC-600: abre a pasta `ROLAND` (USB Storage ou backup), edita memórias/system nos arquivos `.RC0`, e controla o pedal ao vivo via Web MIDI (Program Change + CC).

Gravar `.RC0` (Save / Copy) passa por uma API no servidor que monta o XML. Sem o servidor online, a tela ainda edita; o arquivo da pedaleira não é materializado.

**Guidelines:** [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) · [docs/FEATURES.md](./docs/FEATURES.md) · shared: [boss-editor-guidelines](https://github.com/r4free/boss-editor-guidelines)

**User guide:** click **Guide** in the editor or open `/guia.html`. Includes current screenshots of the visual editors, cards/faders, EQ curves, effect audio previews and step sequences, plus tab descriptions, file/MIDI workflows, image enlargement, light/dark themes and Print / Save PDF.

## Rodar (dev)

```bash
npm install
npm run dev
```

Sobe a API em **http://127.0.0.1:5191** e o Vite em **http://127.0.0.1:5190** (proxy `/api`). Abra o Vite no Chrome/Edge.

O select da barra superior abre o VG-800, GM-800 ou TONEX Pedal (`https://vg.test` / `https://gm.test` / `https://tonex-pedal-editor.test` no local; `https://vg-800-editor.onrender.com` / `https://gm-800-editor.onrender.com` / `https://tonex-pedal-editor.onrender.com` em produção).

**Desenvolvimento local:** com `RC600_REQUIRE_LICENSE=1` no `.env`, o Vite e a API pedem a mesma chave do site hospedado. Sem cookie de sessão, a tela de ativação aparece. Com a chave, o editor abre.

## License keys (editor pago)

```bash
# gera uma key vitalícia (sem data de expiração)
npm run license:create -- --note "email@exemplo.com-Nome"

# opcional: key de teste que expira em 14 dias
npm run license:create -- --days 14 --note "beta alice"
```

As keys vão hasheadas em `data/licenses.json` (gitignored). Formato: `RC600-XXXX-XXXX-XXXX`. No Render, esse arquivo precisa existir no serviço — ele não entra no git.

No servidor que entrega o site (`npm start` com a flag), a primeira tela é só a ativação. HTML, JavaScript, guia e o restante do editor só saem depois que a chave cria a sessão.

```bash
RC600_REQUIRE_LICENSE=1 RC600_SESSION_SECRET=… npm start
```

No `.env` local, `RC600_REQUIRE_LICENSE=1` faz o Vite e a API usarem essa tela. Gere a chave na mesma pasta do projeto, porque a validação lê `data/licenses.json` daqui.

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
# RC600_REQUIRE_LICENSE=1  (ligado no render.yaml)
```

O processo escuta `0.0.0.0:$PORT` e serve `dist/web` + `/api`. Web MIDI precisa de HTTPS (ou localhost).

Copiar só a pasta estática **não** basta: Save/Copy exigem a API.

## Fluxo

1. No site hospedado, informar a license key na tela de ativação. No desenvolvimento local, abrir o editor direto.
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
