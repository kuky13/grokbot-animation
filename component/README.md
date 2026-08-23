# Morph Bot Element

一个无框架依赖的 SVG 动画 Web Component。组件只负责展示和运行；完整状态、眼形、节奏及姿态配置由上层编辑器生成。

项目运行后，可在 `/component/docs/` 阅读带目录、完整参考表和 Live API 测试器的网页文档；本 README 保留为下载包内的离线速查。

> 这是非官方的动画研究项目，与 xAI 没有隶属或背书关系。公开分发精确参考几何或用于商业项目之前，请自行确认相关授权。

## 1. 最快使用

打开组件工作台，先点“下载组件包”。解压后把完整的 `morph-bot/` 文件夹放到项目的公开资源目录：

```text
morph-bot/
├── morph-bot.js
├── grok-bot-engine.js
├── original-data.js
├── catalog.js
├── materials.js
├── runtime/
├── morph-bot.d.ts
└── README.md
```

然后复制工作台右侧生成的代码。最小用法如下：

```html
<script type="module" src="./morph-bot/morph-bot.js"></script>

<morph-bot state="loading" shape="blob" size="48"></morph-bot>
```

工作台里的状态、形状、尺寸和材质都是所见即所得的；右侧代码会与中间预览保持同步。材质包含 8 个纯色、8 个渐变和 4 个彩虹玻璃预设。

## 2. 完整声明

```html
<morph-bot
  state="loading"
  shape="blob"
  size="48"
  color="#0b0b0b"
  label="正在加载"
></morph-bot>
```

用于纯装饰时添加 `decorative`，组件会从无障碍树中隐藏：

```html
<button disabled>
  <morph-bot state="loading" size="18" decorative></morph-bot>
  正在生成
</button>
```

## 3. 常用属性

| 属性 | 默认值 | 说明 |
|---|---:|---|
| `state` | `idle` | 39 种运行状态之一 |
| `shape` | `blob` | 18 种基础轮廓之一 |
| `size` | `96` | CSS 像素尺寸，范围 12–1024 |
| `color` | `#0b0b0b` | 身体与形变颜色 |
| `material` | `solid` | `solid`、`gradient` 或 `rainbow-glass` |
| `gradient-preset` | `electric-dusk` | 内置渐变预设 |
| `gradient-start` / `gradient-end` | — | 自定义双色渐变 |
| `gradient-angle` | `135` | 自定义渐变角度 |
| `glass-preset` | `prism` | 彩虹玻璃预设 |
| `eye-color` | `#ffffff` | 眼睛颜色 |
| `speed` | `1` | 播放倍率，范围 0.1–4 |
| `follow-pointer` | 关闭 | 跟随页面指针 |
| `flip` | 关闭 | 水平翻转 |
| `paused` | 关闭 | 暂停仿真时钟 |
| `decorative` | 关闭 | 标记为纯装饰 |
| `label` | 自动生成 | 无障碍名称 |

## 4. JavaScript API

从状态 A 切换到状态 B，不需要重新创建组件，只需调用 `setState()`：

```html
<button id="change-state">开始思考</button>
<morph-bot id="status-bot" state="idle" shape="blob"></morph-bot>

<script type="module">
  const bot = document.querySelector("#status-bot");
  document.querySelector("#change-state").addEventListener("click", () => {
    bot.setState("thinking");
  });
</script>
```

工作台中间的时间线可以添加任意数量的步骤。选中一步后，点击左侧状态给它赋值，再设置“状态停留”“停留后播放的 Morph”和“Morph 保持”；右侧切到“时间线”即可复制一致的完整代码。

```js
const bot = document.querySelector("morph-bot");

bot.setState("thinking");
bot.setShape("hex");
bot.setMaterial("gradient", { preset: "ocean-signal" });
bot.setMaterial("gradient", { start: "#315cf5", end: "#34d399", angle: 130 });
bot.setMaterial("rainbow-glass", { preset: "prism" });
bot.replay();
bot.pause();
bot.play();
bot.step();

await bot.playMorph("send", {
  hold: 1200,
  restore: "idle",
});
```

需要精确控制多个状态时，使用时间线 API。时间单位都是毫秒；每一步依次执行“进入状态 → 停留 → Morph → 下一步”：

```js
const sequence = [
  { state: "idle", hold: 1000, morph: "gather", morphHold: 700 },
  { state: "thinking", hold: 2400, morph: "send", morphHold: 700 },
  { state: "celebrate", hold: 1600 },
];

bot.playSequence(sequence, { loop: false });
bot.stopSequence();
```

调用 `pause()` 时，状态动画、Morph 和时间线等待会一起暂停；调用 `play()` 后从剩余时间继续。

通过 `configure()` 使用编辑器导出的 v6 JSON：

```js
const preset = await fetch("./my-bot.json").then(response => response.json());
document.querySelector("morph-bot").configure(preset);
```

HTML 属性优先于 preset，因此可以保留完整设计，同时在使用处覆盖状态、形状、尺寸或材质。

## 5. 事件

```js
bot.addEventListener("ready", () => {});
bot.addEventListener("statechange", event => console.log(event.detail.state));
bot.addEventListener("shapechange", event => console.log(event.detail.shape));
bot.addEventListener("morphstart", event => console.log(event.detail.effect));
bot.addEventListener("morphend", event => console.log(event.detail.effect));
bot.addEventListener("sequencestep", event => console.log(event.detail.index, event.detail.state));
bot.addEventListener("sequenceend", event => console.log(event.detail.cycles));
```

## 6. Loading 使用建议

- `loading`：持续旋转的未知进度加载。
- `progress`：循环的任务进度隐喻，不代表真实百分比。
- `spawning`：适合创建、生成、初始化。
- `thinking`：适合 AI 推理或等待回答。
- `searching`：适合检索、扫描和查找。

如果业务有确定进度，请在组件旁明确显示真实百分比；不要把循环的 `progress` 状态当成 0–100% 进度条。

## 7. 生命周期与性能

- 多个组件实例使用独立 Shadow DOM 和 SVG clip ID。
- 组件离开视口后会暂停，重新可见时恢复。
- 从 DOM 移除时会清理动画帧、IntersectionObserver 和指针事件。
- 遵循 `prefers-reduced-motion`。
