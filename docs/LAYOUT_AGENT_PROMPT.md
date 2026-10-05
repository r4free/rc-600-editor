# Comando reutilizável para o agente de layout

Copie o texto abaixo para o agente do editor de destino. Disponibilize junto `LAYOUT_GUIDE.md`, por arquivo ou recurso do MCP.

---

Padronize o layout e a usabilidade deste editor seguindo a experiência atual do RC600. Leia primeiro o guia compartilhado `LAYOUT_GUIDE.md` (anexo ou recurso central do MCP), as instruções deste projeto e o catálogo real do equipamento. Se o guia não estiver acessível, peça sua localização antes de assumir padrões.

Implemente a mudança no projeto: navegação principal e secundária horizontal, breadcrumb da hierarquia ativa, cards de estado para opções curtas, cards de ajuste por roda/arraste/setas quando apropriado, volume segmentado com reset, pan centralizado, grupos funcionais e ajuda no ícone Info ao lado do título. Preserve a interface em inglês e não repita cabeçalhos já identificados pela aba.

Padronize especialmente a edição de efeitos: contexto do destino sempre visível; cards Switch/Insert/Effect conforme suporte do equipamento; Effect abre Library e Edit abre parâmetros; Edit e Library oferecem acesso recíproco junto de Close; Choose effect separado da biblioteca de presets, com busca, categorias e seleção atual. Aplicar um preset mantém Library aberta e destaca o preset carregado. Preserve slot, banco e alterações nas transições. Use controles do efeito separados de Mix; em desktop lado a lado, no mobile empilhados. Sequenciador, EQ, Preamp e outros controles visuais só entram quando correspondem às funções reais do equipamento.

Use a base compartilhada de modais: cabeçalho e ações alcançáveis, corpo rolável, scrollbar junto à borda e padding lateral equilibrado. Para Library/Edit, siga a referência de janela ampla no desktop e tela inteira no mobile. Sobreposições não podem ser recortadas nem fechar a janela inferior por engano. Reutilize tokens, cores semânticas, ícones e componentes; preserve foco e acessibilidade.

O guia atual prevalece sobre orientações genéricas antigas de converter todo enum em select ou todo número em slider. Adapte quantidades de bancos/slots/trilhas, parâmetros, faixas, defaults e destinos ao equipamento deste projeto. Não copie recursos exclusivos da RC600. Preserve arquivos, persistência, MIDI, presets e fluxos existentes de salvar/exportar; a mudança é de apresentação e interação.

Confira as páginas afetadas em desktop, tablet e telefone e os fluxos Edit ↔ Library → Choose effect. Verifique seleção, bypass, busca, ajuda, resets, limites, navegação e alterações não salvas. Execute as verificações adequadas disponíveis e atualize o registro de funcionalidades para mudanças efetivamente entregues. Ao terminar, informe o que mudou, o que foi validado e qualquer adaptação ou limitação pendente.

Se este trabalho estiver sendo executado no projeto central de diretrizes/MCP, incorpore o guia como fonte compartilhada versionada e acrescente às instruções de entrada dos editores a obrigação de consultá-lo antes de alterar layout. Preserve as diretrizes existentes e registre exceções por equipamento. Se também tiver acesso ao editor de destino, aplique o padrão nele. Não declare a publicação no MCP concluída sem verificar que o recurso está disponível para leitura.
