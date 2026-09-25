# Drippy Paint Studio

Abra `/paint/` no servidor de desenvolvimento (`npm run dev`). O Character Studio em `/` continua independente.

## Arquitetura

- `paint/index.html` e `paint/paint.css`: interface responsiva e controles.
- `paint/model.js`: desenho vetorial, replay de comandos e validação dos projetos importados.
- `paint/paint.js`: Pointer Events, histórico por ação, timeline, câmera e integração com o `GrokBotEngine` original.
- `paint/recorder.js`: `captureStream(60)` e `MediaRecorder` WebM, com VP9/VP8 conforme suporte do navegador.

O canvas guarda apenas o desenho. A Drippy é o SVG do runtime, sobreposto ao workspace. O compositor captura o desenho e uma imagem atualizada do SVG em outro canvas; esse canvas fornece os quadros do vídeo e do PNG combinado. O SVG é rasterizado periodicamente durante a gravação, independentemente da taxa de Pointer Events.

## Desenho e reações

Lápis, pincel, borracha e formas criam comandos concluídos. A ferramenta Seleção recorta pixels de um retângulo e os move dentro do canvas; cada movimento entra no histórico e pode ser desfeito/refeito. Limpar também cria um comando reversível. O zoom e a ferramenta Mover afetam a vista, não as coordenadas salvas. A Drippy pode ser arrastada ou movida com as setas quando tem foco. Ela pode passear automaticamente, seguir o pincel e reagir ao desenho ou ao áudio; são controles independentes. Travar posição desliga arraste e passeio. O engine existente recebe a posição do último ponteiro para o olhar. Reações usam estados reais do catálogo com prioridade e intervalo controlado.

## Projeto e exportação

`*.drippypaint.json` usa `version: 2`, canvas 1280x720, `actions` (`stroke`/`clear`/`move-region`/`erase-region`/`bitmap`), PNGs colados, ferramenta, pincel, fundo, zoom, material, estado, controles da Drippy, metadados de áudio e `timeline` (`version`, `duration`, `events`). Traços têm pontos e pressão normalizada. Projetos versão 1, inclusive o formato antigo com `strokes`, continuam aceitos. Arquivos importados têm limite de 8 MB, 5.000 ações e 150.000 pontos. O áudio não entra no JSON: reanexe o arquivo local após abrir um projeto.
As imagens PNG embutidas têm limite conjunto de 6 MB; uma imagem externa maior é reduzida ao tamanho do canvas antes de entrar no projeto. Se a gravação local do navegador ficar cheia, o projeto continua em memória e o indicador mostra "não salvo": exporte o JSON antes de fechar a página.

## Atalhos

- `Ctrl/Cmd+Z`: desfazer; `Ctrl/Cmd+Y` ou `Ctrl/Cmd+Shift+Z`: refazer.
- `Ctrl/Cmd+A`: selecionar tudo; `Esc`: tirar a seleção; `Del`/`Backspace`: apagar a seleção.
- `Ctrl/Cmd+C`: copiar a seleção ou todo o desenho; `Ctrl/Cmd+X`: recortar a seleção; `Ctrl/Cmd+V`: colar imagem do clipboard ou da cópia interna.
- `P`: lápis; `B`: pincel; `E`: borracha; `M`: seleção; `L`: linha; `R`: retângulo; `O`: elipse; `H`: mover vista.
- `Ctrl/Cmd+S`: exportar projeto; `Ctrl/Cmd+O`: abrir projeto. Atalhos não atuam enquanto um campo de texto ou controle está em edição.

O PNG pode conter só o desenho ou também a Drippy. Materiais sólidos, gradientes e vidro do Character Studio aparecem na prévia, no PNG e no vídeo. Fundo branco, transparente ou qualquer cor escolhida aparecem na prévia e na exportação; vídeo transparente usa fundo escuro. A gravação exporta WebM com início, pausa, continuação, parada e descarte. O player abaixo do canvas permite voltar no áudio local antes de gravar; durante a gravação, a busca fica bloqueada para preservar o sincronismo. O microfone é opcional, mediante permissão do navegador; áudio local e microfone são misturados em uma faixa.
A reprodução do áudio também anima a boca e expressões na prévia; pausar congela a reação e fecha a boca, continuar retoma a animação. A articulação acompanha a intensidade com variação visual em notas sustentadas, sem prometer sincronização fonética.
O menu Ações rápidas na barra esquerda reúne edição e centralização da vista. O botão lateral Voltar do mouse também tenta abri-lo quando o cursor está sobre o canvas; alguns navegadores reservam esse botão para navegação, então o botão visível permanece como alternativa.

## Limitações

MediaRecorder WebM não está disponível em todos os navegadores; neste caso a interface apresenta a indisponibilidade, sem prometer MP4. A rasterização SVG pode ter taxa efetiva inferior a 60 fps em aparelhos lentos. A câmera de zoom/pan é apenas de edição: PNG e vídeo exportam a composição completa em 1280x720. A seleção move pixels, não redimensiona objetos; a boca reage à intensidade, não a fonemas. Não há TTS, nuvem nem colisão física.

Execute `npm test` e `npm run build:static` antes de publicar. Não altere o pacote standalone para desenvolver o Paint.
