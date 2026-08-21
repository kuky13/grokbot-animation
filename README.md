# Grok Bot Original State Lab

对 [x.ai/bot](https://x.ai/bot) 中 `grok-bot-lazy` / `grok-bot-mark` 的二维 SVG 状态系统复刻与编辑器。项目只保留 2D 方案，并直接使用原版公开组件的精确几何数据和状态配置。

## 运行

```bash
npm run dev
```

打开 <http://127.0.0.1:4173>。

- 高级状态编辑器：<http://127.0.0.1:4173/>
- 独立组件工作台：<http://127.0.0.1:4173/component/>
- 完整 API 文档：<http://127.0.0.1:4173/component/docs/>

## 独立组件

`component/` 提供所见即所得的独立组件工作台，不依赖 React 或 Vue。打开页面后选择状态与形状，中间即时预览，右侧代码同步生成；第一次使用可直接下载 ZIP 并解压到项目：

```html
<script type="module" src="./morph-bot/morph-bot.js"></script>

<morph-bot
  state="loading"
  shape="blob"
  size="48"
  color="#0b0b0b"
  label="正在加载"
></morph-bot>
```

它支持 39 个 `state`、18 个 `shape`、实时属性更新、暂停/恢复、逐帧、状态重播、单次 morph、编辑器 v5 JSON preset、多实例 Shadow DOM、离屏暂停和生命周期清理。完整接入说明见 [component/README.md](./component/README.md)。

## 对齐内容

- 39 个原始 `data-state`
- 25 组双眼闭合环，每只眼睛 48 点
- 18 种原始头部轮廓，每个运行时轮廓环 96 点
- 独立的形状库：圆形、六边形、三角楔形等 18 种轮廓可视化选择，切换状态时保持当前造型
- 形状切换使用原组件的频率 10 弹簧，同时插值轮廓、眼位、倾角和 belt radius
- 各状态原始 `EXPRESSION_POOLS`、`EXPRESSION_CADENCE` 与 `BLINK_CADENCE`
- 原始阻尼弹簧频率、头部运动公式、随机视线、眨眼与单眼 wink
- 14 种任务 morph：`dots`、`orbit`、`radar`、`progress`、`gather`、`wave`、`send`、`receive`、`dock`、`ball`、`whirl`、`pencil`、`bang`、`standby`
- `spawning` / `progress` 一次性展示与休止循环
- 通知 badge、庆祝粒子、转身、弹跳与 reduced-motion 处理

## 编辑器

- 可为每个状态选择原版眼形池，并对眼形排序、设置播放权重或锁定单独预览
- A→B 状态切换台支持独立停留时间、循环、0.25×–2× 慢放、暂停、逐帧、停止和重播
- Morph 面板明确区分原版持续、原版循环和单次触发；单次触发按 `RESET → ENTER → HOLD → EXIT → DONE` 播放并停留于 bot
- 舞台实时显示当前眼形索引、眼睑开合、morph 类型/进度与状态内时间
- 全局形状库使用 18 个原版 path，并显示对应眼位预览
- 可调整表情/眨眼节奏、状态 morph、角色颜色和通知 badge；角色外观与状态参数分开保存
- 可在原始运动之上调整姿态、眼睛、视线及运动幅度
- “恢复本状态原版”“恢复角色外观”和“恢复全部原版”可回到精确默认配置
- 支持自动保存、撤销/重做及完整 JSON 导入导出

项目配置格式为 v5：`shape` 与 `character` 是独立于 `state` 的全局参数，状态只保存眼形、节奏、姿态和 morph；旧 v4 / v3 本地配置会自动迁移。

## 验证

```bash
npm test
```

回归覆盖 39 × 39 共 1,521 个有序状态切换、14 种 morph 的进出与直接互切、可恢复默认的单次 morph 状态机，以及 18 种形状 × 25 种眼形 × 4 档开合度共 1,800 个眼位组合。

原版几何数据集中在 `component/original-data.js`，可用 `scripts/extract-original-data.mjs` 从保存的公开脚本重新生成。根目录同名文件仅保留兼容导出。完整分析见 [ANALYSIS.md](./ANALYSIS.md)。
