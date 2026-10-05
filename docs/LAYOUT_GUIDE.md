> Canonical copy: `boss-editor-guidelines/shared/LAYOUT_GUIDE.md` (version 2026-10-05). Edit that file, then sync. This copy is the RC-600 origin snapshot.

# Guia de layout e usabilidade da família de editores

Referência: RC-600 Editor, estado do código em 2026-10-05.
Destino: projeto central de diretrizes/MCP e agentes dos demais editores.

## 1. Escopo e prioridade

Padronizar a experiência de edição já aplicada no RC600: navegação, cards, controles de parâmetros, bibliotecas, modais, ajuda contextual e adaptação a telas pequenas. Adaptar essa experiência ao catálogo e às capacidades reais de cada equipamento.

Este documento descreve uma referência de implementação; não declara que todos os componentes antigos do RC600 já foram convertidos. Não transportar bancos, efeitos, trilhas, faixas de valores ou funções exclusivos da RC600 para um equipamento que não os oferece.

Prioridade: instruções explícitas do usuário; capacidades e dados reais do equipamento; padrões atuais descritos aqui; regras genéricas antigas. A regra legada `.cursor/rules/memory-editor.mdc` recomenda enum = select e int = slider. Isso continua sendo fallback, mas não deve desfazer os cards e controles especializados já implementados e registrados em `docs/FEATURES.md`.

## 2. Linguagem e identidade visual

- Interface inteiramente em inglês: títulos, ações, erros, estados vazios e ajuda. Documentação para agentes pode ser em português.
- Nomes de parâmetros legíveis e fiéis à documentação do equipamento. Letras de tags, índices internos e nomes técnicos de armazenamento ficam no código.
- Tema escuro confortável, painéis discretos, hierarquia clara, bordas suaves, espaçamento uniforme e valores fáceis de ler.
- Reutilizar tokens e componentes compartilhados. Referência RC600: fundo `#0e1218`, painel `#151c25`, superfície elevada `#1b2532`, borda `#2b394c`, texto `#e4ebf2`, texto secundário `#9aa9b8`, acento `#00c7fd`; raios 5/8/11 px; IBM Plex Sans para interface e IBM Plex Mono para leituras técnicas.
- Manter contraste, foco, hover, seleção e estado desabilitado coerentes. Off/bypass fica atenuado, com rótulo e ícone identificáveis. Cor acompanha texto/ícone, nunca é a única informação.
- Reutilizar ícones MDI do sistema existente. Não misturar estilos de ícones nem depender de recursos remotos para controles essenciais.

## 3. Navegação e estrutura das páginas

- Abas principais e secundárias sempre horizontais. Não substituir a navegação do editor por uma coluna vertical de abas.
- Breadcrumb acima do conteúdo representa a hierarquia atualmente visível, inclusive trilha, canal, EQ e routing quando aplicável. Não é histórico de cliques nem ordem dos elementos no DOM.
- Clicar em um nível anterior retorna o foco às abas desse nível; não reseta alterações nem altera o equipamento.
- Não repetir como cabeçalho um nome que já está claramente indicado pela aba selecionada, como MIDI, USB ou Preference.
- Agrupar controles por função, entrada, saída, canal ou unidade física. Rótulos acima dos controles; grids responsivos, alinhados e com espaçamento regular.
- Controles rápidos de volume e pan vêm primeiro. Quando coexistem, ficam lado a lado em duas colunas; demais cards vêm abaixo.
- Mostrar alterações não salvas de forma evidente. Navegação visual, escrita na memória, envio ao equipamento e gravação persistente são ações diferentes: preservar o fluxo real do projeto.

## 4. Escolha do controle pela função

### Cards de estado e opções curtas

- Clique alterna duas opções ou percorre uma sequência curta de estados, com ordem explícita e retorno ao início.
- Mostrar nome, estado atual e ícone significativo. Exemplos RC600: Forward/Reverse, Loop/1 Shot, Memory/System, On/Off, Immediate/Measure/Loop Length.
- Em slots FX, Switch combina ativação e modo quando o equipamento suporta: Off → Toggle → Moment → Off. Não inventar Moment em outro equipamento.
- Booleano genérico usa switch ON/OFF; não usar select para duas opções ON/OFF. Cards semânticos são preferidos nas páginas já convertidas.

### Cards de ajuste por gesto (scrub)

- Números, canais, contagens e opções ordenadas extensas podem usar card com valor em destaque, roda do mouse, arraste horizontal por mouse/toque e setas.
- Respeitar mínimos, máximos, passos e unidades do catálogo. A apresentação pode ser musical ou física, mas mantém o valor armazenado correto.
- Exemplos: Hz/kHz, dB, graus, segundos, milissegundos, notas, notas pontuadas, tercinas e compassos. Não mostrar índices crus no lugar do significado.
- Estados especiais como Auto, Off, Flat e Thru devem aparecer por nome quando existirem.
- Não capturar gestos de modo que inviabilize a rolagem da página. Ajustes por teclado precisam ter foco e semântica acessível.

### Medidores, volume e pan

- Volume: slider compacto segmentado, valor destacado, escala e reset ao padrão do catálogo. Na RC600, Play Level volta a 100; esse valor não é universal.
- Referência de volume RC600: 32 segmentos; verde até 100, depois laranja, vermelho e vermelho escuro. Aplicar os limiares apenas a escalas equivalentes.
- Pan: 33 segmentos, centro baixo e extremidades altas; indicação L/Center/R e reset ao centro. Balance usa a mesma linguagem, com nomes como Direct/Effect.
- Comp, NS, Depth e controles de intensidade usam medidores com legenda que explique a função. Não chamar todo medidor de Volume: Attack pode ser Soft → Punchy; Waveform, Smooth → Abrupt.
- Mixer Input RC600 integra mute na extremidade esquerda: Mute / 0 / +100, sem switch separado. Reutilizar somente se o modelo de dados permitir.

### Listas e seletores pesquisáveis

- Catálogos extensos de funções, efeitos e destinos abrem seleção com busca e grupos compreensíveis. Estado atual fica marcado; Off fica atenuado.
- Select tradicional permanece válido para parâmetros ainda sem controle especializado ou listas que se beneficiem dele. Não converter tudo mecanicamente em cards.

## 5. Fluxo de edição de efeitos

- Setup e páginas de bancos compartilham componentes e linguagem visual. Input FX e Track FX usam o mesmo editor sempre que suas capacidades forem compatíveis.
- Contexto do destino permanece visível: seção, banco, slot, categoria e efeito carregado, conforme o equipamento.
- Referência RC600: bancos A/B/C/D em ciano/índigo/âmbar/rosa; slots FX A/B/C/D em verde/laranja/roxo/vermelho. Banco e slot são dimensões distintas.
- Cada slot apresenta Switch, Insert e Effect. Effect abre a biblioteca; Edit abre os parâmetros. Insert percorre apenas destinos válidos, respeitando stereo link e capacidades locais.
- Edit oferece Library junto de Close. Library oferece Edit junto de Close. A transição mantém o mesmo destino e as alterações realizadas.
- Dentro de Edit, o botão Effect abre Choose effect com o catálogo completo, inclusive tipos sem preset. Biblioteca de presets e catálogo de tipos são seletores diferentes.
- Escolher um tipo fecha Choose effect e atualiza o slot. Na RC600, alternar tipos preserva os ajustes de cada tipo; tipo ainda não configurado começa nos defaults. Reproduzir isso quando o armazenamento de destino suportar; documentar qualquer limitação.
- Famílias compatíveis podem ter seletor compacto junto do título, como Delay/Panning/Reverse/Mod ou Reverb/Gate/Reverse.
- Parâmetros organizados por significado. Controles do efeito em um grupo; Direct Level, Effect Level e Balance no grupo Mix. Em desktop, referência de proporção 3:2; até 900 px, empilhar.
- Ajuda da seção fica no ícone Info ao lado do título. Evitar parágrafos longos entre cards e acima de grupos, que quebram alinhamento.

## 6. Biblioteca de efeitos

- Modal amplo com destino e efeito carregado no topo; busca por nome/categoria; categorias com contagens; filtros All / Factory / My effects quando houver ambos os tipos de coleção.
- Sidebar de categorias é permitida dentro da biblioteca: a restrição de abas horizontais se refere à navegação das páginas do editor.
- Presets em tiles com cores de categoria, separados em My effects e Factory. Estado carregado destacado.
- Clicar em preset aplica ao destino e mantém a biblioteca aberta para experimentar outros presets. Não exigir fechar/reabrir a cada escolha.
- Área inferior salva o efeito atual em My effects quando a coleção local existir. Mostrar estados vazios e resultados sem correspondência em inglês.
- Capture from pedal só deve existir se o projeto realmente conseguir ler e capturar configurações. Não criar botão sem implementação.

## 7. Modais e rolagem

- Cabeçalho com título à esquerda; ações contextuais e Close à direita. Corpo rolável; footer quando necessário. Ações de fechamento permanecem alcançáveis.
- Modal comum RC600: largura máxima 28 rem; wide: até 52 rem/96 vw. Edit e Library de FX: 80 vw × 95 dvh em desktop; até 720 px, ocupar 100 vw × 100 dvh, sem bordas ou raios externos.
- Respeitar a cascata CSS final: há regras antigas e sobrescritas em `styles.css`. Não copiar somente a primeira ocorrência de uma classe.
- Scrollbar junto à borda da janela, mantendo respiros laterais iguais no conteúdo. Em Edit/Choose effect, o corpo chega às bordas por margem negativa compensada com padding; na biblioteca, aplicar ao painel de resultados.
- Clique no backdrop fecha o modal; clique no conteúdo não fecha. Choose effect usa portal para ficar acima do editor aberto, sem recorte pelo container pai.
- Reutilizar uma base de modal. Rótulo acessível, `role=dialog` e `aria-modal`; controles com nomes acessíveis.
- O Modal base atual não implementa Escape nem contenção/restauração de foco. Se adicionados no destino, tratar como melhoria de acessibilidade, não como comportamento já confirmado da referência; em sobreposição, Escape fecha só a janela superior.

## 8. Controles visuais especializados

- EQ: oferecer EQ / Cards, com escolha lembrada no navegador. Preferências de Input e Output independentes.
- EQ visual: faders por banda ordenados de graves a agudos, switch no topo; ganhos crescem para cima/baixo de 0 dB; frequência e Q preenchem de baixo para cima. Arraste, roda e setas ajustam; duplo clique reseta; bypass atenua o conjunto.
- Filtros Lo Cut/High Cut: mini representações de EQ quando aplicável. Pitch/Key/Note: teclas ou seletor musical; manter equivalência com o valor real.
- Preamp RC600: Amp Type, Speaker Type e simulador de gabinete/mic lado a lado, empilhados no mobile. Imagens com swipe e faixas laterais clicáveis; lista de Mic Type; posição do mic por clique no falante; faders de Gain/T-Comp/EQ/Level em uma mesa. Aplicar apenas aos parâmetros disponíveis no outro editor.
- Áudio: cards por trilha, cores consistentes, waveform com seek por clique/arraste/setas, tempos e ações Play/Pause/Stop/Import/Export/Clear conforme suporte. Transporte coletivo acima. Waveform real depende da leitura do arquivo; representação provisória não deve fingir análise real.

## 9. Sequenciador e prévias

- Apenas efeitos que possuem sequência recebem sequenciador. Na RC600 são até 16 passos; não assumir esse limite para outros equipamentos.
- Sequenciador no topo, visualmente separado e escuro. Contém somente parâmetros da sequência; controles normais do efeito ficam abaixo.
- Barras ajustáveis verticalmente ou por pintura ao arrastar entre passos; setas para teclado. Botão sob cada passo zera e restaura o valor anterior; passos além de Step Max atenuados.
- Step Slicer suporta Level/Length/Both. Outros efeitos mostram apenas os controles válidos: Sequence, Step Sync, Retrigger, Target, Step Rate e Step Max quando disponíveis.
- Indicar o parâmetro afetado por Target e avisar se Sequence estiver Off. Target contém somente parâmetros realmente sequenciáveis.
- Random usa padrões quando implementados: Euclidean, Gate, Stutter, Accent, Chaos ou Any.
- Prévias com Play/Stop, BPM, fonte de referência e controles musicais pertinentes. RC600 usa Tap On/T e Tap Off/Shift+T durante reprodução; não reintroduzir o antigo seletor de modo Tap.
- Alterações refletem a configuração editada. Som sintetizado no navegador é aproximação: explicar isso na ajuda contextual, sem prometer o algoritmo exato do equipamento.

## 10. Responsividade e preservação funcional

- Desktop aproveita colunas; mobile empilha na mesma ordem lógica. Nenhum card, valor, ação de modal ou seletor essencial pode ficar inacessível.
- Grids de parâmetros usam referência `minmax(11.5rem, 1fr)`, com adaptações locais para controles largos e teclado visual. Não forçar largura que cause overflow no telefone.
- Layouts que representam controles físicos seguem a ordem do equipamento. Exemplo RC600: três switches superiores e seis inferiores; empilhamento mantém essa sequência.
- Preservar formatos de arquivos, tags, limites, defaults, presets, persistência, MIDI, licenciamento e fluxos de salvar/exportar. Refazer apresentação não autoriza remapear parâmetros.
- Reutilizar convenções de mudanças não salvas e proteção de saída. O guard atual da RC600 intercepta voltar/recarregar/sair; não afirmar que ele é condicionado apenas a alterações não salvas.
- Setlists, quando presentes: cabeçalho compacto; músicas antes de Add song; uma música expandida por vez; expandir no fim da linha; Music guide e Triggers internos; Delete setlist no footer; New/Import/Export no cabeçalho do painel.

## 11. Entrega e critérios de aceitação para o agente

1. Ler as diretrizes centrais e o catálogo do editor de destino; levantar páginas e controles afetados.
2. Implementar componentes reutilizáveis e aplicar às páginas pertinentes, preservando funções e dados.
3. Conferir desktop, tablet e telefone; abrir Edit, Library e Choose effect; testar ida/volta, aplicação de preset sem fechamento e manutenção do destino.
4. Conferir clique, arraste, roda, toque e teclado nos controles que os oferecem; verificar limites, unidades, defaults e resets.
5. Conferir bypass, destaque de seleção, ajuda contextual, estados vazios, breadcrumb e indicação de alterações não salvas.
6. Rodar verificações disponíveis apropriadas às mudanças e revisar visualmente. Informar o que foi verificado e o que ficou pendente.
7. Atualizar o registro de funcionalidades do projeto para mudanças reais de UX; na RC600, catálogo e changelog em inglês e português.
8. Relatar adaptações específicas do equipamento e limitações, sem declarar recursos não implementados.

## 12. Fontes locais para consulta

- `docs/FEATURES.md`: comportamento entregue e histórico; entradas mais recentes prevalecem quando descrevem substituição de um controle.
- `web/src/styles.css`: tokens, grids, dimensões, cores, breakpoints e sobrescritas finais.
- `web/src/components/Modal.tsx`: estrutura e fechamento de modais.
- `web/src/components/InputFxTab.tsx`, `TrackFxTab.tsx`: Setup, bancos e abertura de Library/Edit.
- `web/src/components/InputFxEditModal.tsx`: editor compartilhado, grupos, Mix, variantes, sequências e prévias.
- `web/src/components/InputFxLibraryModal.tsx`, `TrackFxLibraryModal.tsx`, `InputFxTypePickerModal.tsx`: biblioteca e catálogo de tipos.
- `web/src/components/ParamControl.tsx`, `LoopTab.tsx`: medidores, pan e cards.
- `web/src/components/EqPanel.tsx`, `EqFaders.tsx`, `PreampEditor.tsx`, `StepSequencer.tsx`: editores especializados.
- `web/src/components/NavigationBreadcrumb.tsx`, `navigationTrail.ts`, `LeaveEditorGuard.tsx`: navegação e proteção de saída.
- `.cursor/rules/ui-language.mdc`, `memory-editor.mdc`, `feature-registry.mdc`: convenções locais; aplicar a ressalva de prioridade da seção 1.

## 13. Publicação no projeto central/MCP

Publicar este guia como recurso central versionado, com título, data e origem RC600. Acrescentar uma referência ao guia nas instruções compartilhadas que os agentes realmente leem. A existência do arquivo em um servidor MCP, sozinha, não garante que os agentes o consultem: a instrução de entrada deve exigir a leitura do recurso antes de trabalhos de layout.

Manter o núcleo comum neste guia e exceções por equipamento em documentos próprios. Alterações futuras devem atualizar a fonte central e sua versão, evitando cópias divergentes. Este arquivo está preparado para incorporação; não representa uma publicação já realizada no MCP.
