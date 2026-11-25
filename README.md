# 划词翻译（Highlight Translator）

Windows 桌面划词翻译工具。选中其他应用中的文字，即可在光标附近查看流式译文。支持 OpenAI 兼容 API，也可连接本地 Ollama。

## 安装与使用

1. 从 [GitHub Releases](https://github.com/Haha-li/highlight-translator/releases) 下载 Windows x64 安装版（`HighlightTranslator-Setup-*.exe`），或下载便携版 ZIP，解压后运行 `highlight-translator.exe`。
2. 双击系统托盘中的应用图标打开设置，选择 OpenAI、DeepSeek 或 Ollama 预设，也可以手动填写 API Base URL 和模型 ID。远程服务需要 API Key，本地 Ollama 可留空。填入 API 根地址（如 `https://api.openai.com/v1`），不用加 `/chat/completions`；使用 Ollama 时，请先启动服务并下载要使用的模型。
3. 保存后选中文字，点击浮出的翻译图标。也可以在设置中改为划词后直接翻译，或仅在按住 `Ctrl` 划词时显示图标。

- 默认全局快捷键是 `Alt+Q`：优先翻译当前选区，取不到时翻译剪贴板文本。托盘右键菜单也可手动触发。
- 翻译窗口支持切换目标语言、复制译文和置顶；设置支持浅色／深色主题和应用黑名单。
- 安装版会自动检查更新，也可以从托盘菜单手动检查。

**隐私提示：** 翻译时，原文会发送到你配置的模型接口。API Key 以明文保存在本机应用数据目录的 `config.json` 中，请勿分享该文件。

## 本地开发

项目使用 Electron、React 和 TypeScript；发布工作流使用 Node.js 22。

```sh
npm ci
npm run dev
```

运行 `npm test` 执行单元测试，运行 `npm run typecheck` 检查类型。运行 `npm run build` 后，可用 `npm run smoke` 检查桌面应用能否启动。

## 开源协议

本项目采用 [MIT 协议](LICENSE)。
