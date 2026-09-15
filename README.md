# Mechanism Studio · 机构工坊

浏览器里的机械与角色动画工作台，**两个模式**：

- **机构**：搭机械（连杆、齿轮、齿条、滑块、行星轮系），让它动起来（拖曳 / 匀速 / 变速 / 外力悬浮），描运动轨迹。
- **L2D**：骨骼绑图。画/用现成骨架 → 每根骨骼绑一张切片图 → 拖骨骼摆姿势 → 调整体动作参数 → 得到角色动画。类似骨骼绑定，用来做机械版 Live2D 演示。

两个模式共用同一套约束引擎（骨骼就是连杆），切模式互不影响。首次打开会弹出**新手引导**，按模式给 6 步聚光灯提示；之后点顶栏 `?` 可重看。

- 界面：**蓝藻色亮色主题**（白底 + 青绿强调色）
- 技术栈：React 18 + Vite，无后端

## 界面

**左栏负责"造"，右栏负责"调"**：

- 左栏：工具 + 模板（随模式变化）+ 当前工具提示
- 中间：画布
- 右栏：属性滑条、图像绑定、图层/显示（L2D 模式多一块"动作参数"）

顶栏：模式切换、播放/复位、速度、时间、撤销/重做、显示模式（全部 / 仅构件 / 仅图像）、`?` 引导、网格、导入导出。

## 快速开始

- 双击 `start.cmd` — 启动并自动开浏览器（服务器隐藏后台运行，无控制台窗口）
- 停止：双击 `stop.cmd`

手动：`npm install` → `npm run dev`（http://localhost:5173）。

生产构建与本地预览：`npm run build` → `serve.cmd`（默认 http://127.0.0.1:4173/）。

URL 参数：`?mode=l2d`、`?template=planetary`、`?tour=0`（跳过引导）、`?script=1`（直接开积木面板）。

## 线上部署（已上线）

- 站点：**https://anshonesoo.github.io/Mechanism-Studio/**
- 仓库：https://github.com/Anshonesoo/Mechanism-Studio

Pages 的源设为 **`gh-pages` 分支**。更新站点：

- 双击 `deploy.cmd` —— 自动 `npm run build` 并把 `dist/` 推到 `gh-pages`，约 1 分钟后生效
- 或命令行：`powershell -NoProfile -File scripts\deploy-gh-pages.ps1 -Message "更新说明"`

`vite.config.js` 里 `base: './'` 保证在 `用户名.github.io/仓库名/` 子路径下资源能正确加载。

**可选：改成 push 自动部署**。仓库里已备好 `.github/workflows/deploy.yml`（本地未提交，因为当前推送凭据没有 `workflow` 权限）。想启用就在 GitHub 网页端新建 `.github/workflows/deploy.yml` 并粘贴该文件内容，之后 push 到 `main` 会自动跑测试、构建并发布到 `gh-pages`。

## 机构模式

**搭**：左栏选工具在画布上点/拖。齿轮按住拖出大小，靠近别的齿轮自动啮合；滑块、齿条先选导轨再点。

**动**：
- 拖曳——"选择"工具直接拖铰点或部件，杆长严格守恒，不会甩飞
- 驱动——选中连杆/齿轮，右侧点"让它转起来"或"用它做驱动…"，匀速 / 变速（正弦）+ 转速滑条
- 外力——选中部件点"施加外力"，用**大小/方向两个进度条**调
- 悬浮——选"悬浮机构"模板：无重力 + 外力往复，整机悬浮漂移

**轨迹**：选中铰点勾"记录运动轨迹"。

**图像绑定**：右栏"图像绑定"→ 选部件 → 上传图片（自动按部件尺寸缩放）→ 滑条调大小/位置/旋转/不透明度/图层 → 顶栏切"仅图像"。

## L2D 模式

1. 左栏选骨架模板（**人形骨架** / 链式 / 空白）
2. 用「摆姿势」拖关节试手感；缺骨头用「画骨骼」补
3. 用「绑图片」点骨骼上传切片图（或直接在骨头上**右键**）。图片跟随该骨骼运动、旋转
4. 用「设根节点」指定整机旋转中心（默认取固定关节）
5. 右栏「动作参数」：整体旋转 / 大小 / 左右 / 上下 全用滑条；再调「自动摇摆」的幅度与速度
6. 按播放看摇摆效果；顶栏切「仅图像」就只剩角色在动
7. 「图层 / 显示」调整每张切片的前后顺序

图片跟随是按**骨骼局部坐标系**做的：以骨骼起点为原点、骨骼方向为基准角，所以子骨骼摆动时切片会正确跟随旋转。

## 快捷键

| 键 | 作用 |
| --- | --- |
| 空格 | 播放 / 暂停 |
| Delete | 删除选中 |
| Esc | 取消选择 |
| Ctrl+Z / Ctrl+Shift+Z | 撤销 / 重做 |
| F | 适应视图 |
| 滚轮 | 缩放 |
| 中键拖动 / Alt+拖动 | 平移画布 |

## 引擎（内部固定参数）

迭代式位置约束投影（PBD），每帧 4 子步 × 12 次迭代。约束类型：

- 刚性杆 / 骨骼 → 距离约束（同一对铰点只保留一条）
- 滑块 / 套筒 / 齿条 → 点在线约束
- 齿轮副 → 角度耦合 `r_a·θ_a + s·r_b·θ_b = ratio·φ`，`φ` 是两轮中心连线转角。行星轮系必须含 φ 项，行星架才会公转
- 齿条副 → `x = r·θ`，并让导轨与节圆相切
- 驱动 → 主动件按 ω(t) 积分角位移
- L2D 整体变换 → 绕根节点对所有关节做增量旋转 / 缩放 / 平移，因此可以和手动摆姿势叠加

角度会解缠（unwrap）避免 `atan2` 跨 ±π 跳变；另有速度上限与越界自动复位兜底。

## 目录

```
（仓库根）
  index.html  package.json  vite.config.js  README.md
  start.cmd  stop.cmd  serve.cmd  deploy.cmd
  .github/workflows/deploy.yml（可选，需网页端添加）
  scripts/   start-dev.ps1  stop-dev.ps1  serve-dist.mjs  deploy-gh-pages.ps1
  src/
    engine/  math.js world.js constraints.js profile.js templates.js rig.js script.js
    render/  camera.js renderer.js sprites.js
    store/   editorStore.js
    io/      serialize.js
    ui/      Toolbar Viewport LeftPanel RightPanel Inspector RigPanel
             SpritePanel LayerPanel LogBar Range TourGuide ScriptDock
    styles/  app.css
  tests/     engine.test.mjs  script.test.mjs
```

## 测试

```
npm test
```

47 项断言：

- **engine（30）** 杆长守恒、滑块贴轨、齿轮传动比、内啮合同向、齿条 `x=rθ`、行星架转速解析解、悬浮 20 秒不飘走、运行中拖拽不发散、越界自动复位、暂停拖曳收敛等
- **script（17）** 顺序执行、等待不越过、重复/嵌套重复次数、一直重复不自己结束、停止后不再执行、旋转/移动补间正确并与解析值一致、旋转不改变杆长、所有积木默认参数齐全
