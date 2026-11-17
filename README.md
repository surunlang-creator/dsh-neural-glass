# DeepSeek Harness 皮肤合集

两个独立的 DSH 插件（各自是一个 bundle，可单独安装、单独开关）：

| 目录 | 插件 | 说明 |
| --- | --- | --- |
| [`neural-glass/`](neural-glass/) | `@local/neural-glass` | 神经流光：深蓝玻璃 + 24 秒 Transformer 光流（token→QKV→注意力→残差→MLP→输出），设置页 + 浮动面板 + 输入框滑杆 |
| [`codex-skin/`](codex-skin/) | `@local/codex-skin` | Codex Neural Skin：薄荷绿玻璃 + Transformer / CNN 双场景光流，星形按钮打开浮动面板 |

## 安装

在 Harness 里 **设置 → 插件 → 添加插件**，选择对应子目录（含 `package.json` 的那一层）。

两个都是背景皮肤，**同时启用会叠两层画布**，建议只开一个。

## License

MIT
