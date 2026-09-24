# Drippy Paint Studio

Abra `/paint/` no servidor de desenvolvimento (`npm run dev`). O Character Studio em `/` continua independente.

## Arquitetura

- `paint/index.html` e `paint/paint.css`: interface responsiva e controles.
- `paint/model.js`: desenho vetorial, replay de comandos e validação dos projetos importados.
- `paint/paint.js`: Pointer Events, histórico por ação, timeline, câmera e integração com o `GrokBotEngine` original.
- `paint/recorder.js`: `captureStream(60)` e `MediaRecorder` WebM, com VP9/VP8 conforme suporte do navegador.

O canvas guarda apenas o desenho. A Drippy é o SVG do runtime, sobreposto ao workspace. O compositor captura o desenho e uma imagem atualizada do SVG em outro canvas; esse canvas fornece os quadros do vídeo e do PNG combinado. O SVG é rasterizado periodicamente durante a gravação, independentemente da taxa de Pointer Events.

## Desenho e reações

Lápis, pincel, borracha e formas criam comandos concluídos. Desfazer/refazer move comandos entre dois históricos; limpar cria um comando reversível. O zoom e a ferramenta Mover afetam a vista, não as coordenadas salvas. A Drippy pode ser arrastada ou movida com as setas quando tem foco. O engine existente recebe a posição do último ponteiro para o olhar. Reações usam estados reais do catálogo (`working`, `excited`, `surprised`, `curious`, `playful`, `happy`) com prioridade e cooldown; o olhar atualiza sem mudar estado a cada movimento.

## Projeto e exportação

`*.drippypaint.json` usa `version: 1`, canvas 1280x720, `actions` (`stroke`/`clear`), ferramenta, pincel, fundo, zoom, estado e controles da Drippy e `timeline` (`version`, `duration`, `events`). Traços têm pontos e pressão normalizada. Projetos antigos da primeira versão com `strokes` são aceitos. Arquivos importados têm limite de 8 MB, 5.000 ações e 150.000 pontos.

O PNG pode conter só o desenho ou também a Drippy. Fundo branco ou transparente é configurável. A gravação exporta WebM com início, pausa, continuação, parada e descarte. Microfone é opcional, mediante permissão do navegador.

## Limitações

MediaRecorder WebM não está disponível em todos os navegadores; neste caso a interface apresenta a indisponibilidade, sem prometer MP4. A rasterização SVG pode ter taxa efetiva inferior a 60 fps em aparelhos lentos. A câmera de zoom/pan é apenas de edição: PNG e vídeo exportam a composição completa em 1280x720. Não há TTS, nuvem, colisão física ou edição não destrutiva de cada ponto após concluir um traço. A futura física pode consumir os comandos do modelo sem modificar o runtime SVG.

Execute `npm test` e `npm run build:static` antes de publicar. Não altere o pacote standalone para desenvolver o Paint.
