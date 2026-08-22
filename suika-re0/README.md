# 🍉 RE:0 合成大西瓜

基于 [Matter.js](https://brm.io/matter-js/) 物理引擎的「合成大西瓜」同人小游戏，RE:Zero 主题。

## 怎么玩

直接用浏览器打开 `index.html` 即可（首次需联网加载一次 Matter.js CDN）。

- 移动鼠标 / 手指选左右位置
- 点击 或 空格 投放
- 键盘 `←` `→` 微调瞄准
- 手机触屏也能玩

## 进化链

昴 → 艾米 → 蕾姆 → 拉姆 → 贝蒂 → 帕克 → 菲鲁特 → 库珥修 → 罗兹瓦尔 → 莱傲天 → 强欲魔女

- 两个**相同**角色相撞 → 合成更高一级并加分
- 两个**强欲魔女**相撞 → 触发「终极大爆炸」（震屏 + 冲击波 + 500 分）
- 顶部红色**危险线**被堆过并停留约 1 秒 → 游戏结束
- 连击、合成粒子、Web Audio 音效、最高分本地存档一应俱全

## 离线运行（可选）

若想断网也能玩，把 `matter.min.js` 下载到本目录，并把 `index.html` 里的 CDN `<script>` 改为本地引用即可：

```bash
curl -L https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js -o matter.min.js
```

然后编辑 `index.html`，将：

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js"></script>
```

改为：

```html
<script src="matter.min.js"></script>
```

© 2026 Stan · 保持好奇，保持折腾
