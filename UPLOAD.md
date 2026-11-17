# 上传到 GitHub（中文步骤）

本地仓库已经初始化并提交好了，位置：

```
~/Documents/deepseek-harness/default-workspace/plugins/neural-glass
```

里面是 1 个 commit（`main` 分支），只差一个 GitHub 远程地址。下面三种方式任选一种。

> 为什么我不能直接替你上传：这台机器上没有 `gh` 命令行、没有 `~/.ssh` 公钥、也没有 `GH_TOKEN`，而 GitHub 现在不接受账号密码推送。所有登录都要用你自己的凭据，我不会去读你浏览器里的 GitHub 登录状态。
> 如果你想让我直接推，先按"方式 B"准备好凭据（或装好 GitHub Desktop 并登录），把仓库地址发我，我来执行推送。

---

## 方式 A：网页上传（不装任何工具，最快）

1. 浏览器打开 <https://github.com/new>
2. **Repository name** 填 `dsh-neural-glass`（或你喜欢的名字）
3. 选 **Public** 或 **Private**
4. **不要**勾选 "Add a README file"、"Add .gitignore"、"Choose a license"（仓库里已经有了，勾了会冲突）
5. 点 **Create repository**
6. 在新页面点 **uploading an existing file**（或右上 **Add file → Upload files**）
7. 在 Finder 里打开 `plugins/neural-glass` 文件夹：
   - 全选里面的**内容**（`client.js`、`package.json`、`README.md`、`LICENSE`、`locale/`、`docs/`、`screenshots/` 等）
   - 拖进 GitHub 的上传框（GitHub 支持直接拖文件夹）
   - Finder 默认隐藏以 `.` 开头的文件：按 **⌘⇧.** 显示隐藏文件，把 `.gitignore` 也一起拖进去
8. 下方 **Commit changes** 填 `Neural Glass: initial release` → 点 **Commit changes**

完成。以后改文件可以在网页里 Edit，或改用下面两种方式。

---

## 方式 B：命令行（推荐，之后更新最方便）

先在网页上按方式 A 的第 1–5 步**建一个空仓库**（同样不要勾选 README/license），然后在终端执行：

```bash
cd ~/Documents/deepseek-harness/default-workspace/plugins/neural-glass
git remote add origin https://github.com/<你的用户名>/dsh-neural-glass.git
git branch -M main
git push -u origin main
```

推送时会要求登录：

- **用户名**：你的 GitHub 用户名
- **密码**：不能用账号密码，要用 **Personal Access Token**
  1. 打开 <https://github.com/settings/tokens>
  2. Generate new token（Classic）→ 勾选 `repo` → Generate
  3. 复制 token 当作密码粘贴（终端不会显示，粘贴后直接回车）

之后每次更新：

```bash
git add -A
git commit -m "调整背景参数"
git push
```

---

## 方式 C：GitHub Desktop（图形化，不想碰命令就用这个）

1. 下载安装 <https://desktop.github.com>
2. 打开后 **Sign in to GitHub.com** 登录
3. 菜单 **File → Add local repository** → 选择
   `~/Documents/deepseek-harness/default-workspace/plugins/neural-glass`
4. 右上角 **Publish repository**
   - Name 填 `dsh-neural-glass`
   - 不想公开就勾 **Keep this code private**
   - 点 **Publish repository**

以后改动会出现在左侧 Changes 里，填一句说明点 **Commit to main**，再点 **Push origin** 即可。

---

## 提交者身份

仓库里已设置**仅本仓库**的身份：

```
Surunlang <surunlang@users.noreply.github.com>
```

想改成你自己的 GitHub 账号（这样提交头像/贡献统计才对得上）：

```bash
cd ~/Documents/deepseek-harness/default-workspace/plugins/neural-glass
git config user.name "你的名字"
git config user.email "你的GitHub邮箱"
git commit --amend --reset-author --no-edit
```

（如果已经推送过，改完需要 `git push --force-with-lease`。）

---

## 常见问题

| 问题 | 解决 |
| --- | --- |
| `remote origin already exists` | `git remote set-url origin <新地址>` |
| 推送 403 / 要求密码 | GitHub 已停用密码推送，改用 token（方式 B）或 GitHub Desktop |
| 页面里看不到 `.gitignore` | Finder 按 ⌘⇧. 显示隐藏文件；网页上传时它也必须一起传 |
| 仓库太大 | 本项目约 1.8 MB（截图占大部分），正常 |
| 想让别人直接用 | 对方 `git clone` 后，在 DSH 里 **设置 → 插件 → 添加插件** 选择该文件夹 |
| 改名/改描述 | 仓库页右上 **Settings**，可改名称、描述、可见性（私有 ↔ 公开） |
