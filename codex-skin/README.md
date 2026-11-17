# Codex Neural Skin · DeepSeek Harness 版

把「Codex Neural Skin」的概念做成 DeepSeek Harness 的客户端插件：界面换成薄荷绿玻璃，
背后持续播放一条计算光流，两个场景轮播——**Transformer**（token → Q/K/V → 因果注意力 →
圆形 MLP 神经元 → 输出）和 **CNN 图像管线**（真实 3×3 卷积 + ReLU + 2×2 最大池化 + 展平 +
6→9→3 缩略分类）。

## 安装

1. 把这个目录（含 `package.json`）作为本地插件安装：
   Harness → **设置 → 插件 → 添加插件**，或 `plugin_manager` 的 `install_bundle`（目标＝本目录绝对路径）。
2. 启用后界面自动变深色玻璃；**入口**：
   - 输入框模型名左边的 ✦ 星形按钮
   - 侧边栏左下角的 ✦ 星形按钮

## 面板

| 控件 | 作用 |
| --- | --- |
| 动画场景 | 自动轮播 / Transformer 光流 / CNN 图像识别 |
| 专注 / 平衡 / 沉浸 | 一键预设（透明度、光效、模糊、速度） |
| 界面透明度 | 面板底色 alpha，0% 实色 ↔ 90% 通透；只作用于底色，文字不变淡 |
| 背景光效 | 画布图形强度 0–100% |
| 玻璃模糊 | 面板 backdrop-blur，0–28 px |
| 动画速度 | 0.2×–2× |
| 启用动态背景 | 关掉即移除画布与玻璃层、恢复你原来的主题；面板仍可再打开 |
| 暂停动画 | 冻结当前帧，停止动画帧调度 |
| 深色底座 | 启用期间把应用保持在深色主题（皮肤按深色设计），关闭皮肤时恢复原主题 |
| 恢复默认 | 回到默认参数（保留开关状态） |

设置保存在本机 `localStorage`（`codex-skin.settings.v1`）；存储不可用时只在当次会话生效。

## 说明与限制

- 画面里的 token、注意力权重、分类结果都是**演示数据**；卷积与池化由固定核真实计算。
- 这里的「透明」指应用内面板透出画布，**不是**操作系统窗口透明。
- 深色底座默认开启；不想要可在面板里关掉。
- 与 `dsh-neural-glass` 是两套独立皮肤，**同时启用会叠两层画布**，建议只开一个。

## 文件

```
client.js         # 画布引擎（内联）+ DSH 挂载、玻璃 token、浮动面板、触发器
index.js          # Host 半身（空实现）
cordis.patch.yml  # 插入 Loader 行 codex-skin
package.json      # dsh.bundle.patch + dsh.client
locale/           # 插件市场标题与描述
docs/             # 详情页 + 预览图
icon.svg
```

## License

MIT
