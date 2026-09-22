# Drippy Complete Component Bundle

Este ZIP contém a Drippy nova completa e foi feito para ser copiado para outro projeto sem depender do Studio.

## Entrada principal

- `morph-bot.js` — Web Component público `<morph-bot>`.
- `morph-bot.d.ts` — tipos TypeScript e APIs públicas.
- `grok-bot-engine.js` — runtime central de estado, física, renderização e relógio.

## Componentes da Drippy

- `runtime/drippy-character.js` — olhos, piscadelas, orelhas, boca, halo e adornos por estado.
- `runtime/character-interaction.js` — pressionar, arrastar, inclinar e retorno por mola.
- `runtime/speech-meter.js` — leitura de energia de áudio para animação real da boca.
- `runtime/state-behavior-system.js` — gestos, alternância de piscadelas e comportamento dos estados.
- `runtime/svg-renderer.js` — renderização de corpo, rosto e 14 morphs.
- `runtime/material-system.js` — materiais sólido, gradiente e rainbow glass.
- `runtime/particle-system.js` — partículas e efeitos auxiliares.
- `runtime/physics-system.js`, `simulation-clock.js` e `math.js` — física e temporização.
- `runtime/dialogue-director.js` — diálogo, voz, fonemas e sincronização visual.
- `runtime/chinese-animalese.js`, `speech-unit-analyzer.js` e `dialogue-audio-timeline.js` — áudio local e análise de fala.
- `runtime/vendor/` — dependências vendorizadas e respectivas licenças.

## Dados e configuração

- `catalog.js` — 39 estados, 18 formas e 14 morphs.
- `original-data.js` — geometrias e parâmetros fonte.
- `materials.js` / `materials.d.ts` — presets e tipos de materiais.

## Uso mínimo

```html
<script type="module" src="./morph-bot/morph-bot.js"></script>
<morph-bot
  state="idle"
  shape="blob"
  halo="soft"
  interactive
  size="160"
></morph-bot>
```
```js
const drippy = document.querySelector("morph-bot");

drippy.setState("thinking");
drippy.setSpeechLevel(0.6);

// Para áudio real:
// await drippy.connectAudio(document.querySelector("audio"));
// drippy.disconnectAudio();
```

`connectAudio()` não inicia a reprodução. O navegador ainda pode exigir gesto do usuário para liberar Web Audio.

## Importações opcionais

Quando usado por um bundler compatível com `package.json#exports`:

```js
import "morph-bot-element";
import { renderDrippyCharacter } from "morph-bot-element/drippy-character";
import { createSpeechMeter } from "morph-bot-element/speech-meter";
```

Para uso direto no navegador, preserve a estrutura de pastas do ZIP.
