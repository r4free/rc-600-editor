# RC-600 Web Editor

Editor web para o Boss RC-600: abre a pasta `ROLAND` (USB Storage ou backup), edita memórias/system nos arquivos `.RC0`, e controla o pedal ao vivo via Web MIDI (Program Change + CC).

## Rodar

```bash
npm install
npm run ui
```

Abra **http://127.0.0.1:5190** (Chrome/Edge). Para Web MIDI em produção use HTTPS.

## Fluxo

1. Faça backup da pasta `ROLAND` do looper
2. **Abrir pasta** (ou ZIP) no editor
3. Edite tracks / FX / ASSIGN / system
4. **Salvar** grava o par A/B com `<count>` incrementado
5. Opcional: conectar MIDI USB para trocar memória / transporte / CC

## Testes

```bash
npm test
```

## Notas

- Não regenera XML do zero — patch in-place
- Não apaga `EDITOR.RCE` nem `WAVE/`
- Sem SysEx de parâmetros (o RC-600 não expõe mapa público)
