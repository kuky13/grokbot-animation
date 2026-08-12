# `grok-bot-lazy` DOM 与动画分析

分析对象：[x.ai/bot](https://x.ai/bot)，检查时间为 2026-08-13。

## 1. DOM 分层

页面首屏中的角色不是图片，也不是 Canvas / WebGL。它的降级结构是：

```html
<span class="grok-bot-lazy">
  <svg class="grok-bot-mark" viewBox="-15 -15 259 259">
    <path class="grok-bot-mark__head" />
    <path class="grok-bot-mark__eye" />
    <path class="grok-bot-mark__eye" />
  </svg>
</span>
```

- `.grok-bot-lazy` 只负责尺寸、行高和进入视口后的懒加载。
- 未进入视口或动画 chunk 尚未完成加载时，内部是上面的静态三路径 SVG。
- 动画组件加载后，`data-state` 挂在内部 `.grok-bot-mark` SVG 上，而不是外层 `.grok-bot-lazy` 上。
- 动态 SVG 会新增 `defs / clipPath`、效果图层、可复用的圆环与 glyph 图层；两只眼睛被裁切在头部轮廓内。

基础 CSS 很克制：SVG 宽度 100%，头部 `fill: var(--fg)`，眼睛 `fill: var(--bg)`，颜色过渡为 600ms。

## 2. 39 个 `data-state`

| 分类 | 状态 |
|---|---|
| Lifecycle | `sleeping`, `waking`, `idle`, `listening`, `thinking`, `searching`, `working` |
| Reactions | `excited`, `surprised`, `suspicious`, `angry`, `drowsy`, `happy`, `curious`, `confused`, `bored`, `proud`, `shy`, `sad`, `laughing`, `scared`, `playful`, `celebrate` |
| Agent morphs | `orbit`, `radar`, `progress` |
| Product lifecycle | `spawning`, `humming`, `loading`, `dictating`, `writing`, `sending`, `receiving`, `uploading`, `notifying`, `alerting`, `dragging`, `bouncing`, `powering-down` |

## 3. 动画系统的关键机制

1. **不是逐帧素材**：头部轮廓与眼睛都是点阵路径，运行时在路径之间做线性插值。
2. **弹性求解**：位置、旋转、横纵缩放、眼睛开合、形变进度都用阻尼弹簧推进；主循环是 `requestAnimationFrame`，大帧会被拆成更小步长，避免卡顿后的跳变。
3. **表情池**：每个状态对应 2–5 组眼形索引，并有独立的表情切换区间与眨眼区间。例如 `searching`、`excited` 的切换更快，`bored`、`sad`、`sleeping` 更慢。
4. **视线跟随**：指针位置相对组件中心归一化并限幅，约映射到横向 22、纵向 14 个 SVG 单位；随后再做平滑追踪。
5. **头部不是静止底板**：状态会同时修改平移、旋转、整体 squash / stretch。`searching` 左右扫视，`working` 有轻微点头，`excited` 会跳动，`scared` 会高频抖动。
6. **Morph 状态**：`thinking → dots`、`orbit → orbit`、`radar → radar`、`progress → progress`；任务态还映射到 `gather / wave / send / receive / dock / ball / whirl / pencil / bang / standby` 等几何符号。
7. **一次性形变**：`spawning` 与 `progress` 会在一段展示后回到休止，再重新触发，而非无限匀速循环。
8. **低动态偏好**：检测到 `prefers-reduced-motion: reduce` 后，组件选择状态表情池的第一个表情并冻结大部分动态。
9. **形状是独立属性**：`shape` 不属于 `data-state`。原组件公开 18 种形状；切换时用频率 10 的弹簧插值 96 点轮廓、`face` 眼位参数、倾斜系数和 belt radius，并轮换触发转身、弹跳或粒子动作。

## 4. 为什么它显得“可爱”

- 头部不是标准圆，而是略微偏心、带手捏感的 blob；自然的不对称先提供了性格。
- 眼睛放在右上象限，留出大块黑色负空间，看起来像一个侧着身子观察人的小生物。
- 位移很小，但每次都同时影响眼睛、头部倾角与整体纵向形变，因此动作有重量。
- 状态不是单一姿态：低频呼吸、随机眨眼、偶发侧看与主表情叠加，避免了机械循环。
- 工作状态用非常简单的几何隐喻替代文字，信息清楚，同时保留玩具感。

## 5. 本项目如何保证造型对齐

项目已经移除 3D 方案。默认二维运行时不再依靠人工估计的姿态，而是使用目标组件公开脚本中的原始数据模型：

- `original-data.js` 保存完整 25 组双眼环；每只眼睛 48 点，运行时在环之间插值。
- 同一文件保存 18 种原始头部形状、96 点轮廓环、脸部安全区、缩放、倾角和 belt radius。
- 形状库直接预览这 18 条原始 path；`blob` 对应圆形观感，`hex` 对应六边形，`wedge` 对应三角楔形。中文名称只是识别标签，不改动原始 ID 或几何。
- 眼睛按每个形状独立的 `face {x,y,sx,sy,eye}` 参数适配，并根据轮廓横截面限制位置；形状切换过程中，脸部参数与轮廓同步插值。
- 39 个状态直接使用原始 `EXPRESSION_POOLS`、`EXPRESSION_CADENCE` 和 `BLINK_CADENCE`。
- `grok-bot-engine.js` 按原始频率实现固定步长阻尼弹簧、状态运动公式、随机视线、眨眼、wink、转身及弹跳。
- 任务状态使用原始 morph 映射和几何参数，而不是另外画一套近似图标。
- 默认 `viewBox`、颜色变量、裁切层级与动态扩张规则保持原组件结构。

编辑器中的所有数值均叠加在原始参数之上；形状作为全局属性跨状态保持，状态参数继续独立保存。状态显示“原版参数”时没有人为姿态覆盖。修改后会显示“已自定义”，并可单独或整体恢复原版。
