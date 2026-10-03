# 3D 复古 Game Boy

一台可以真正玩的 3D Game Boy（DMG-01）。机身按实物尺寸建模（90 × 148 × 32 mm），
屏幕上跑的是初代俄罗斯方块，四色绿屏、点阵、刷新残影都做了。

## 运行

用了 ES modules，浏览器不允许从 `file://` 加载，所以需要起一个本地服务：

```bash
python3 -m http.server 8777
```

然后打开 <http://127.0.0.1:8777/index.html>。

Three.js 已经放在 `vendor/`，**不需要联网**。

## 操作

| 按键 | 功能 |
| --- | --- |
| 十字键 ← → | 左右移动 |
| 十字键 ↓ | 加速下落 |
| 十字键 ↑ / A | 顺时针旋转 |
| B | 逆时针旋转 |
| SELECT | 暂存方块（hold） |
| START | 开始 / 暂停 |
| 空格 | 硬降 |
| P | 电源开关 |

机身可以直接用鼠标点：按键会真的陷下去，十字键会绕支点倾斜，顶部的电源拨片
是真的滑动的。拖拽空白处旋转视角，滚轮缩放。

## 代码结构

```
index.html          页面与 UI
src/main.js         场景、灯光、相机、输入、按键动画
src/gameboy.js      机身建模（外壳、屏幕凹槽、按键、丝印贴图）
src/tetris.js       游戏逻辑 + 160×144 帧缓冲渲染
src/chip.js         WebAudio 方波/噪声合成音效
vendor/             three.js 及其 addons
```

几个实现上的选择：

- **外壳**用带倒角的 `ExtrudeGeometry` 挤出圆角轮廓，并保留 DMG 底部两个切角，
  这样侧光下边缘高光是连续的。
- **屏幕**不是一块贴图平面，而是四根边框条围起来的真实凹槽，玻璃比边框低
  约 1 mm，斜看时能看到景深。
- **丝印**（GAME BOY、DOT MATRIX WITH STEREO SOUND、Nintendo、POWER 等）
  画在一张与机身同分辨率的透明 canvas 上作为贴花，缩放到任何距离都不会糊。
- **点阵遮罩**用 `createPattern` 平铺，一次 fill 覆盖 23040 个像素，
  而不是每帧画两万多个 `fillRect`。
- **按键手感**复刻了当年的 DAS/ARR：左右首延迟 170 ms、之后每 55 ms 一步。
- **音频**全部实时合成，没有任何素材文件。

## 调试

页面暴露了 `window.__gb`（scene / camera / renderer / gb / tetris / chip），
可以直接在控制台里检查状态，也可以在无头环境里手动步进游戏逻辑。
运行时报错会在底部红色条里显示，而不是留下一个黑屏。