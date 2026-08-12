# Grok Bot Original State Lab

对 [x.ai/bot](https://x.ai/bot) 中 `grok-bot-lazy` / `grok-bot-mark` 的二维 SVG 状态系统复刻与编辑器。项目只保留 2D 方案，并直接使用原版公开组件的精确几何数据和状态配置。

## 运行

```bash
npm run dev
```

打开 <http://127.0.0.1:4173>。

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

- 可为每个状态选择原版眼形池；全局形状库使用 18 个原版 path，并显示对应眼位预览
- 可调整表情/眨眼节奏、状态 morph、角色颜色和通知 badge
- 可在原始运动之上调整姿态、眼睛、视线及运动幅度
- “恢复本状态原版”和“恢复全部原版”可回到精确默认配置
- 支持自动保存、撤销/重做及完整 JSON 导入导出

项目配置格式为 v4：`shape` 是独立于 `state` 的全局参数，符合原组件的属性模型；旧 v3 本地配置会自动迁移。

原版几何数据集中在 `original-data.js`，可用 `scripts/extract-original-data.mjs` 从保存的公开脚本重新生成。完整分析见 [ANALYSIS.md](./ANALYSIS.md)。
