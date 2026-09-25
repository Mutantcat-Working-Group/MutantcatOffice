<div align=center>
<img src="icon.png" style="width:100px;" width="100"/>
<h2>MutantcatOffice</h2>
</div>

### 一、产品概述

- 自由、开源的 AI 原生办公套件，支持 macOS、Windows 和 Linux。
- 打开并保存原生 `.docx`、`.xlsx`、`.pptx` 文件，编辑 PDF、Markdown 与 HTML。
- 文件在本地打开、编辑、保存和转换；只有 AI 请求会按所选提供方离开设备。
- 内置 `genoffice` 命令行、Agent Skill 和 MCP 服务，使编码代理可以直接创建、转换、读取和编辑真实 Office 文件。
- **发行方** 由异猫工作群（mutantcat.org）发行，GitHub: https://github.com/Mutantcat-Working-Group

核心价值：

- 按字节保留原文件：只重写被编辑的部分，未触碰的内容逐字节保留，文档在 Word、Excel、PowerPoint 中继续正常工作。
- AI 编辑可审查：以修订和差异落地，支持一键回滚；表格生成实时公式，演示文稿直接绘制到画布。
- 本地转换：PDF 转 Word / Excel / PowerPoint、Markdown 转 Word、HTML 转 Word 全部在设备上运行。
- 自带模型与密钥：支持 Claude、OpenAI、Gemini、DeepSeek、Kimi、GLM、Qwen、Doubao、MiniMax、Grok、Mistral、OpenRouter、Requesty、Opper 及任意 OpenAI 兼容端点。

### 二、功能说明

#### 文档（Docs）

- 以接近 Word 的排版打开和编辑 `.docx`，支持双栏、通栏图片、底纹表格、页眉页脚与分页。
- 样式、批注、修订、公式和墨迹均可往返保存。
- AI 可直接改写和插入内容，开启跟踪修订后按 Word 修订样式落地。

#### 表格（Sheets）

- 打开并保存原生 `.xlsx`，支持透视表、切片器、条件格式与公式追踪。
- AI 可根据一句话新增汇总表、实时 SUMIF 公式与图表，并以单个可撤销批次应用变更。
- 内置 Rust `.xlsx` 引擎负责读取与计算。

#### 演示（Slides）

- 从一句话提示生成完整的 `.pptx` 演示文稿。
- 支持母版、版式、参考线、非破坏性裁剪，以及 AI 重排、改写和调整顺序。

#### PDF

- 编辑 PDF 文本：改写内容流并保留原字体，而非覆盖式批注。
- 在本地将 PDF 转换为 Word、Excel 或 PowerPoint，扫描页通过系统 OCR 识别。

#### Markdown 与 HTML

- Markdown：基于 Tiptap 的块编辑器，支持表格、图片、代码块和 Mermaid 图，写回纯 `.md`，并本地导出 Word。
- HTML：按设计简报生成自包含页面，支持实时预览、源代码视图与一键重设计，可导出 PDF 或原生 Word 文档。

#### 搜索

- 对工作目录中的 Word、Excel、PowerPoint、PDF、Markdown 与 HTML 建立本地 SQLite 全文索引，支持中文分词。
- 可选开启 TypeSafe Jev 重排序，让回答问题的文件排在最前。

#### 命令行与 MCP

- `genoffice` 提供检测、转换、创建、读取、编辑、渲染、搜索、图片与媒体命令，支持 `--json` 输出。
- 同一套命令可作为 MCP 工具（stdio 或 HTTP）供 Claude Code、Cursor、Claude Desktop 等客户端使用。

### 三、安装与下载

从 [Releases](https://github.com/Mutantcat-Working-Group/MutantcatOffice/releases) 下载对应平台安装包。

| 平台                              | 要求                        | 安装包                |
| --------------------------------- | --------------------------- | --------------------- |
| macOS（Apple Silicon）            | macOS 11+                   | `.dmg` (arm64)        |
| macOS（Intel）                    | macOS 11+                   | `.dmg` (x64)          |
| Windows（x64）                    | Windows 10+                 | `-x64.exe` 安装程序   |
| Windows（ARM64）                  | Windows 11 on Arm           | `-arm64.exe` 安装程序 |
| Linux（Debian / Ubuntu）          | x86_64，glibc 2.34+         | `.deb`                |
| Linux（Fedora / RHEL / openSUSE） | x86_64，glibc 2.34+         | `.rpm`                |
| Linux（其他发行版）               | x86_64，glibc 2.34+，FUSE 2 | `.AppImage`           |
| Linux（ARM64）                    | glibc 2.34+，FUSE 2         | `.AppImage` (arm64)   |

macOS 安装包为 ad-hoc 签名（未公证），Gatekeeper 可能显示开发者未验证提示。

```bash
# Debian / Ubuntu
sudo apt install ./genoffice_<version>_amd64.deb

# Fedora / RHEL
sudo dnf install ./genoffice-<version>.x86_64.rpm

# AppImage
chmod +x MutantcatOffice-<version>.AppImage
./MutantcatOffice-<version>.AppImage
```

### 四、快速上手

1. 安装应用并打开文档或工作目录。
2. 在设置中填写任一受支持 AI 提供方的密钥。
3. 在编辑器中通过 AI 面板提出操作请求，编辑以可回滚的差异或修订呈现。
4. 需要自动化时使用命令行：

```bash
genoffice --version
genoffice info report.docx --json
genoffice convert report.md --to pdf
genoffice create --type docx --from notes.md --out notes.docx
genoffice docs read report.docx --range 0-9 --json
genoffice render report.docx --out shots/
genoffice open sales.xlsx
```

### 五、接口说明

#### 命令行 `genoffice`

- 说明：以无头方式执行与桌面应用相同的文件引擎，提供检测、转换、创建、读取、编辑和渲染。
- 请求方式：终端命令，支持 `--json` 输出。
- 完整命令列表见 `genoffice help`，详细参考见 `packages/cli/README.md`。

#### MCP 服务

- 说明：将同一套命令暴露为 Model Context Protocol 工具，供编码代理直接调用。
- 启用方式：

```bash
claude mcp add --transport stdio genoffice -- genoffice mcp
```

```jsonc
{
  "mcpServers": {
    "genoffice": { "command": "genoffice", "args": ["mcp"] },
  },
}
```

- 应用内设置页也可开启本地 HTTP 服务（`http://127.0.0.1:3093/mcp`），使代理在可见的 Word 编辑器中构建文档。

#### Agent Skill

- 说明：随应用分发，安装到 Claude Code、Codex、Cursor、Gemini CLI、GitHub Copilot、OpenCode、Windsurf 等技能兼容代理。
- 安装方式：应用内 Settings → Integrations，或 `npx skills add Mutantcat-Working-Group/MutantcatOffice`。

### 六、开发进度

- [x] 文档（Docs）：`.docx` 读取、编辑、修订与格式化
- [x] 表格（Sheets）：`.xlsx` 编辑、公式、图表与透视表
- [x] 演示（Slides）：`.pptx` 生成、编辑与设计检查
- [x] PDF：本地编辑与转换
- [x] Markdown 与 HTML：编辑、预览与导出 Word
- [x] 本地全文搜索与可选 Jev 重排序
- [x] `genoffice` 命令行、Agent Skill 与 MCP 服务
- [x] 三平台安装包发布流水线
- [ ] Android 与 iOS 移动端
- [ ] 多人实时协作

### 七、开发与构建

```bash
npm install
npm run fixtures    # 生成测试文档
npm test            # 单元测试
npm run typecheck   # 类型检查
npm run dev         # 启动全部编辑器与桌面壳
npm run dist:mac    # macOS dmg
npm run dist:win    # Windows nsis 安装包
npm run dist:linux  # Linux deb / rpm / AppImage
```

本项目以 [Apache License 2.0](LICENSE) 开源，安全说明见 [SECURITY.md](SECURITY.md)，隐私说明见 [PRIVACY.md](PRIVACY.md)。

---

## 致谢

本项目是 [genspark-ai/genoffice](https://github.com/genspark-ai/genoffice) 的 Fork，感谢原仓库及其作者的优秀开源工作，本仓库在其基础上继续维护与改进。
