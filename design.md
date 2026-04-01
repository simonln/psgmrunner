# C++ CMake Runner 插件架构设计文档

## 1. 插件概述
本插件旨在为基于 CMake 的 C++ 项目提供无缝的“配置-构建-运行-调试”体验。通过解析 `CMakePresets.json` 和 `compile_commands.json`，插件能在侧边栏直观展示构建预设与目标可执行文件，并提供一键式、基于原生 Tasks API 的构建与调试工作流。

## 2. 核心功能特性
* **智能按需激活**：仅在包含 `CMakePresets.json` 的 C++ 工作区激活，零无用性能损耗。
* **预设解析与过滤**：一键展示 CMake Configure Presets，自动过滤 `hidden` 属性为 `true` 的模板配置。
* **精准源码映射**：基于 `compile_commands.json`，在内存中建立 `<C++ 源码 -> 可执行文件>` 的精准双向映射索引。
* **全局侧边栏视图**：提供沉浸式的 TreeView 侧边栏，支持通过源码快速定位 Target，支持与当前激活的编辑器窗口联动。
* **原生任务与调试集成**：利用 VS Code Tasks API 接管编译过程（支持 `$gcc` / `$msCompile` 错误捕获），构建成功后先提示用户（后续考虑构建成功后自动无缝拉起调试器）
* **高度自定义配置**：深度接入 VS Code 原生 Settings 体系，支持用户自定义带有动态变量（如 `${buildDir}`）的构建和运行命令。

---

## 3. 架构分层设计

为了保证高内聚和低耦合，插件采用标准的分层架构：

### 3.1 UI 交互层 (Presentation Layer)
负责处理所有 VS Code 侧的视图渲染与用户输入。
* **TreeView Provider**：提供侧边栏数据源。
  * **Presets 视图**：展示可用的 CMake 配置项。
  * **Targets 视图**：展示“可执行文件”为父节点、“源码文件”为子节点的树形结构。
* **Command Register**：注册供 UI 调用的命令（如 `psgmrunner.build`, `psgmrunner.debugTarget`）。
* **Editor Sync Listener**：监听 `onDidChangeActiveTextEditor` 事件，实现打开文件时 TreeView 的自动定位高亮。

### 3.2 核心服务层 (Core Services)
负责串联数据与执行逻辑。
* **PresetProvider**：轻量级解析 `CMakePresets.json`，提取 `name` 和 `binaryDir`，处理基础的变量替换（如 `${sourceDir}`）。
* **MappingEngine**：核心映射引擎。读取 `compile_commands.json`，建立基于内存的哈希表 `Map<SourcePath, TargetPath>`，支持极速反查。
* **WorkflowManager**：负责串联生命周期。监听 Task 退出码（Exit Code），并在构建成功（Exit Code == 0）时，提示用户（后续考虑通过 `vscode.debug.startDebugging` 动态注入配置并拉起调试）。

### 3.3 执行与集成层 (Execution & Integration Layer)
* **TaskExecutionEngine**：读取用户配置，动态构造并执行 `vscode.Task`，注入 Problem Matchers 以在“问题”面板中高亮编译错误。
* **Configuration Manager**：对接 VS Code 原生 `settings.json`，读取用户自定义的命令模板，并执行变量替换。

---

## 4. 核心工作流与数据流

### 4.1 源码到目标的查询与调试链路
1. **触发查找**：用户在主编辑区打开 `main.cpp`。
2. **查询引擎**：UI 层通知 `MappingEngine`，查表获取该源码归属的 Target（如 `MyApp.exe`）。
3. **UI 响应**：侧边栏 TreeView 自动展开并高亮 `MyApp.exe` 节点。
4. **触发构建**：用户点击 `MyApp.exe` 右侧的 `Build` 按钮。
5. **执行 Task**：`TaskExecutionEngine` 读取 `settings.json` 中的模板，替换变量生成命令（如 `cmake --build ...`），并作为原生 Task 运行。
6. **无缝调试**：`WorkflowManager` 监听到构建进程成功退出，动态构造 `cppdbg` 的 `launch` 配置对象，提示用户构建成功可以开始调试。（后续考虑直接启动调试。）

---

## 5. 配置与扩展性设计

插件通过 `package.json` 的 `contributes.configuration` 暴露以下原生设置项，供用户在 `settings.json` 中灵活定制：

| 设置项键名 (Key) | 类型 | 默认值 | 作用描述 |
| :--- | :--- | :--- | :--- |
| `psgmrunner.tasks.buildCommandTemplate` | String | `cmake --build ${buildDir} --config ${preset} --target ${target}` | 构建阶段执行的命令，支持动态变量替换。 |
| `psgmrunner.tasks.runCommandTemplate` | String | `${buildDir}/${target}` | 非调试模式下直接运行的目标路径或命令。 |
| `psgmrunner.tasks.clearTerminalBeforeRun`| Boolean | `true` | 在触发构建或运行任务前，是否清理终端输出。 |

**支持的内置变量：**
* `${buildDir}`：当前选中的 Preset 解析出的构建目录。
* `${preset}`：当前选中的 Preset 名称。
* `${target}`：当前映射到的可执行文件目标名称。
* `${sourceDir}`：当前工作区根目录。
