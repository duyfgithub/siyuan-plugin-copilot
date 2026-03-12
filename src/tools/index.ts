/**
 * Agent 模式工具定义
 * 实现各种工具的调用接口
 */

import {
    sql,
    updateBlock,
    getBlockKramdown,
    exportMdContent,
    createDocWithMd,
    getBlockByID,
    getBlockDOM,
    refreshSql,
    openBlock,
    lsNotebooks,
    createNotebook,
    renameDocByID,
    moveDocsByID,
    appendBlock,
    getBlockAttrs,
    setBlockAttrs,
    getNotebookConf,
    listDocsByPath,
    searchAttributeView,
    getAttributeViewKeysByAvID,
    renderAttributeView,
    appendAttributeViewDetachedBlocksWithValues,
    addAttributeViewBlocks,
    setAttributeViewBlockAttr,
    batchSetAttributeViewBlockAttrs,
    getAttributeViewKeys,
    getAttributeViewBoundBlockIDsByItemIDs,
    getAttributeViewItemIDsByBoundIDs,
    addAttributeViewKey,
    removeAttributeViewKey,
    removeAttributeViewBlocks,
    deleteBlock,
    request,
    sendNotification,
} from '../api';
import { getActiveEditor } from 'siyuan';
import { parseWebPageToMarkdown, fetchWithWebView } from '../utils/webParser';

/**
 * 获取当前激活的编辑器 Protyle 实例
 */
function getProtyle() {
    return getActiveEditor(false)?.protyle;
}

// ==================== 工具类型定义 ====================

export interface Tool {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: {
            type: 'object';
            properties: Record<string, ToolParameter>;
            required: string[];
        };
    };
}

/**
 * 工具详细描述接口
 */
export interface ToolDetails {
    name: string;
    shortDescription: string;
    fullDescription: string;
}

export interface ToolParameter {
    type: string;
    description: string;
    enum?: string[];
    items?: {
        type: string;
    };
    default?: any;
}

export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}

export interface ToolResult {
    role: 'tool';
    tool_call_id: string;
    name: string;
    content: string;
}

// ==================== 工具定义 ====================

/**
 * 工具的完整详细描述映射
 * 键为工具名称，值为工具的完整描述（包含使用说明、示例、注意事项等）
 */
export const TOOL_FULL_DESCRIPTIONS: Record<string, string> = {};

/**
 * 获取工具的简短描述（用于工具列表展示）
 * 从完整描述中提取第一行非空内容
 */
function extractShortDescription(fullDescription: string): string {
    const lines = fullDescription.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('`')) {
            return trimmed;
        }
    }
    return fullDescription.substring(0, 100) + '...';
}

/**
 * 创建工具定义，同时注册完整描述
 */
function createTool(
    name: string,
    description: string,
    parameters: Tool['function']['parameters']
): Tool {
    // 注册完整描述
    TOOL_FULL_DESCRIPTIONS[name] = description;

    return {
        type: 'function',
        function: {
            name,
            description: extractShortDescription(description),
            parameters,
        },
    };
}

/**
 * 获取工具的完整描述
 */
export function getToolFullDescription(toolName: string): string | undefined {
    return TOOL_FULL_DESCRIPTIONS[toolName];
}

/**
 * 构建包含工具详细描述的系统提示词追加内容
 * @param toolNames 需要添加详细描述的工具名称列表
 * @param existingDescriptions 已存在的描述（用于避免重复）
 * @returns 追加的系统提示词内容，以及更新后的已存在描述集合
 */
export function buildToolDescriptionsPrompt(
    toolNames: string[],
    existingDescriptions: Set<string> = new Set()
): { prompt: string; newDescriptions: Set<string> } {
    const newToolDescriptions: string[] = [];
    const newDescriptions = new Set(existingDescriptions);

    for (const toolName of toolNames) {
        // 避免重复添加同一个工具的详细描述
        if (newDescriptions.has(toolName)) {
            continue;
        }

        const fullDesc = TOOL_FULL_DESCRIPTIONS[toolName];
        if (fullDesc) {
            newToolDescriptions.push(`## ${toolName}\n\n${fullDesc}`);
            newDescriptions.add(toolName);
        }
    }

    if (newToolDescriptions.length === 0) {
        return { prompt: '', newDescriptions };
    }

    const prompt = `\n\n=== 工具详细使用说明 ===\n\n${newToolDescriptions.join('\n\n---\n\n')}`;
    return { prompt, newDescriptions };
}

/**
 * 获取工具的详细描述文档
 * AI 应该先调用此工具获取目标工具的详细使用说明，然后再调用实际工具
 */
export function getSiyuanSkills(toolName: string): string {
    const description = TOOL_FULL_DESCRIPTIONS[toolName];
    if (!description) {
        return `未找到工具 "${toolName}" 的详细描述。可用工具: ${Object.keys(TOOL_FULL_DESCRIPTIONS).join(', ')}`;
    }
    return description;
}

export const AVAILABLE_TOOLS: Tool[] = [
    // 工具详细描述查询工具 - 隐藏工具，不在 UI 中显示
    {
        type: 'function',
        function: {
            name: 'get_siyuan_skills',
            description: `了解思源笔记AI使用规范，获取指定工具的详细使用说明文档。

**重要规则**
- 在使用任何工具之前，必须先调用此工具获取该工具的详细说明。
## 使用流程
1. 确定需要使用的工具名称
2. 调用 get_siyuan_skills 获取该工具的详细文档
3. 阅读文档了解参数要求、使用示例、注意事项
4. 根据文档正确调用目标工具

## 参数
- toolName: 要查询的工具名称，如 "siyuan_sql_query", "siyuan_update_block" 等`,
            parameters: {
                type: 'object',
                properties: {
                    toolName: {
                        type: 'string',
                        description: '要获取详细描述的工具名称',
                        enum: [
                            'siyuan_sql_query',
                            'siyuan_update_block',
                            'siyuan_insert_block',
                            'siyuan_get_block_content',
                            'siyuan_create_document',
                            'siyuan_list_notebooks',
                            'siyuan_get_doc_tree',
                            'siyuan_create_notebook',
                            'siyuan_rename_document',
                            'siyuan_move_documents',
                            'siyuan_get_block_attrs',
                            'siyuan_set_block_attrs',
                            'siyuan_database',
                            'web_fetch',
                            'siyuan_delete_block',
                            'siyuan_fetch_sync_post',
                            'siyuan_send_notification',
                            'siyuan_get_current_time',
                        ],
                    },
                },
                required: ['toolName'],
            },
        },
    },

    // SQL查询工具
    createTool(
        'siyuan_sql_query',
        `执行思源笔记SQL查询的工具。

## 何时使用
- 需要搜索、统计或分析笔记内容
- 查找特定条件的块、文档
- 获取笔记的元数据信息

## 数据库表结构

### blocks表：存储所有块信息
| 字段名 | 说明     | 字段值示例 |
| -------- | ---------------------------------------------------- | ------------ |
| id       | 内容块 ID| 20210104091228-d0rzbmm  |
| parent_id       | 上级块的 ID，文档块该字段为空      | 20200825162036-4dx365o   |
| root_id       | 顶层块的 ID，即文档块 ID   | 20200825162036-4dx365o   |
| hash       | content 字段的 SHA256 校验和      | a75d25c   |
| box       | 笔记本 ID| 20210808180117-czj9bvb   |
| path       | 内容块所在文档路径| /20200812220555-lj3enxa/20210808180320-abz7w6k/20200825162036-4dx365o.sy   |
| hpath       | 人类可读的内容块所在文档路径       | /0 请从这里开始/编辑器/排版元素   |
| name       | 内容块名称| 一级标题命名   |
| alias       | 内容块别名| 一级标题别名   |
| memo       | 内容块备注| 一级标题备注   |
| tag       | 非文档块为块内包含的标签，文档块为文档的标签       | #标签1# #标签2# #标签3#   |
| content       | 去除了 Markdown 标记符的文本       | 一级标题   |
| fcontent       | 第一个子块去除了 Markdown 标记符的文本(1.9.9 添加) | 第一个子块   |
| markdown       | 包含完整 Markdown 标记符的文本     | # 一级标题   |
| length       | fcontent 字段文本长度     | 6   |
| type       | 内容块主类型，参考 [blocks.type](#blocks-type)| h   |
| subtype       | 内容块次类型，参考 [blocks.subtype](#blocks-type)| h1   |
| ial       | 内联属性列表，形如 {: name="value"}| {: id="20210104091228-d0rzbmm" updated="20210604222535"}   |
| sort       | 排序权重，数值越小排序越靠前       | 5   |
| created       | 创建时间 | 20210104091228   |
| updated       | 更新时间 | 20210604222535   |

### refs表：存储所有引用双链结构

| 字段名 | 说明 | 字段值示例 |
| --- | --- | --- |
| id | 引用 ID | 20211127144458-idb32wk |
| def_block_id | 被引用块的块 ID | 20200925095848-aon4lem |
| def_block_parent_id | 被引用块的双亲节点的块 ID | 20200905090211-2vixtlf |
| def_block_root_id | 被引用块所在文档的 ID | 20200905090211-2vixtlf |
| def_block_path | 被引用块所在文档的路径 | /20200812220555-lj3enxa/20210808180320-fqgskfj/20200905090211-2vixtlf.sy |
| block_id | 引用所在内容块 ID | 20210104090624-c5bu25o |
| root_id | 引用所在文档块 ID | 20200905090211-2vixtlf |
| box | 引用所在笔记本 ID | 20210808180117-czj9bvb |
| path | 引用所在文档块路径 | /20200812220555-lj3enxa/20210808180320-fqgskfj/20200905090211-2vixtlf.sy |
| content | 引用锚文本 | 元类型 |
| markdown | 包含完整 Markdown 标记符的文本 | (()) |
| type | 引用类型 | ref_id |

### attributes表：查询特定块属性

| 字段名 | 说明 | 字段值示例 |
| --- | --- | --- |
| id | 属性 ID | 20211127144458-h7y55zu |
| name | 属性名称 | bookmark |
| value | 属性值 | ✨ |
| type | 类型 | b |
| block_id | 块 ID | 20210428212840-859h45j |
| root_id | 文档 ID | 20200812220555-lj3enxa |
| box | 笔记本 ID | 20210808180117-czj9bvb |
| path | 文档文件路径 | /20200812220555-lj3enxa.sy |

## 查询示例

\`\`\`sql
-- 搜索包含关键词的文档，为了查找更相关的结果，需要思考不同词，一起查询
-- 假设用户要搜索“时间管理”相关文档，需要想到“任务管理”或“GTD”等相关词。
SELECT * FROM blocks
WHERE (content LIKE '%时间管理%' OR content LIKE '%任务管理%' OR content LIKE '%GTD%')
AND type='d'
LIMIT 50;

-- 获取最近更新的文档
SELECT * FROM blocks WHERE type='d' ORDER BY updated DESC LIMIT 50;

-- 查找带有特定标签的块
SELECT * FROM blocks WHERE tag LIKE '%标签名%';
\`\`\`

## 注意事项
- 避免查询过多数据，使用LIMIT限制结果数量，默认50，除非用户有要求指定数量
- 查询之后的结果总结，使用思源笔记块链接的格式包裹，如\`[脑机接口](siyuan://blocks/20240519195512-ccrifu0)\`
`,
        {
            type: 'object',
            properties: {
                sql: {
                    type: 'string',
                    description: 'SQL查询语句，必须是有效的SQLite语法',
                },
            },
            required: ['sql'],
        }
    ),
    // 更新块工具
    createTool(
        'siyuan_update_block',
        `更新思源笔记中已存在块的工具。

## 何时使用
- 需要修改现有笔记内容
- 用户要求更新某个特定的块
- 修正或改进已有信息

## 使用方法
1. 获取要更新的块ID（上下文提供、SQL查询等方式）
2. 准备新的内容（Markdown格式）
3. 调用工具更新块内容

## 更新策略
- 保留结构：尽量保持原有的块结构和子块
- 属性保留：块属性（如别名、标签）会被保留

## 注意事项
- 必须提供准确的块ID
- 思源笔记kramdown格式可以添加文字颜色：格式为<span data-type="text" style="background-color: var(--b3-card-error-background); color: var(--b3-card-error-color);">文本</span>，优先使用以下颜色变量：
  - 红色文字：--b3-font-color1
  - 橙色文字：--b3-font-color2
  - 蓝色文字：--b3-font-color3
  - 绿色文字：--b3-font-color4
  - 灰色文字：--b3-font-color5
  - 红色卡片：color: var(--b3-card-error-color); background-color: var(--b3-card-error-background);
  - 绿色卡片：color: var(--b3-card-success-color); background-color: var(--b3-card-success-background);
  - 蓝色卡片：color: var(--b3-card-info-color); background-color: var(--b3-card-info-background);
  - 橙色卡片：color: var(--b3-card-warning-color); background-color: var(--b3-card-warning-background);
- 不建议频繁更新大型文档块，考虑只更新特定段落

## 调用工具后
- 更新块后以思源块链接格式返回，方便用户点击跳转查看`,
        {
            type: 'object',
            properties: {
                dataType: {
                    type: 'string',
                    description: '数据类型，通常使用 "markdown"',
                    enum: ['markdown', 'dom'],
                },
                data: {
                    type: 'string',
                    description: '新的块内容，使用Markdown格式',
                },
                id: {
                    type: 'string',
                    description: '要更新的块ID',
                },
            },
            required: ['dataType', 'data', 'id'],
        }
    ),
    // 插入块工具
    createTool(
        'siyuan_insert_block',
        `在思源笔记中插入新块的工具。

## 何时使用
- 用户要求添加新内容到笔记
- 需要在特定位置插入信息
- 创建新的笔记内容

## 使用方法
1. 使用markdown格式准备要插入的内容
2. 确定插入位置（在某个块之前、之后，或作为子块）
3. 调用工具插入内容，插入

## 位置参数说明
- parentID: 将新块作为指定块的子块插入（前置子块）
- appendParentID: 将新块作为指定块的后置子块插入（追加到父块最后）
- previousID: 在指定块之后插入新块
- nextID: 在指定块之前插入新块

## 使用示例

\`\`\`javascript
// 在块前插入新块
siyuan_insert_block({
  dataType: "markdown",
  data: "# 新标题\\n\\n这是新插入的内容。",
  nextID: "20210104091228-d0rzbmm"  // 在此块之前插入
})

// 在块后插入新块
siyuan_insert_block({
  dataType: "markdown",
  data: "- 新列表项",
  previousID: "20210104091228-d0rzbmm"  // 在此块之后插入
})

// 作为前置子块插入
siyuan_insert_block({
  dataType: "markdown",
  data: "这是前置子块内容",
  parentID: "20210104091228-d0rzbmm"  // 作为此块的前置子块
})

// 作为后置子块插入（追加到父块最后）
siyuan_insert_block({
  dataType: "markdown",
  data: "这是后置子块内容",
  appendParentID: "20210104091228-d0rzbmm"  // 作为此块的后置子块
})
\`\`\`

## 注意事项
- 插入块可以通过markdown换行符一次性插入多个块，可以一次性插入长文本
- 至少需要指定一个位置参数（parentID、appendParentID、previousID或nextID）
- 如果指定parentID，会作为子块追加到父块的最前面
- 如果指定appendParentID，会作为子块追加到父块的最后面
- previousID和nextID用于在同级块中定位

## 调用工具后
- 插入块后以思源块链接格式返回，方便用户点击跳转查看`,
        {
            type: 'object',
            properties: {
                dataType: {
                    type: 'string',
                    description: '数据类型，通常使用 "markdown"',
                    enum: ['markdown', 'dom'],
                },
                data: {
                    type: 'string',
                    description: '要插入的内容，使用Markdown格式，可以一次性插入多个块，无需一个个插入',
                },
                parentID: {
                    type: 'string',
                    description: '父块ID，将新块作为前置子块插入（可选）',
                },
                appendParentID: {
                    type: 'string',
                    description: '父块ID，将新块作为后置子块追加到父块最后（可选）',
                },
                previousID: {
                    type: 'string',
                    description: '前一个块的ID，将新块插入到该块之后（可选）',
                },
                nextID: {
                    type: 'string',
                    description: '后一个块的ID，将新块插入到该指定块之前（可选）',
                },
            },
            required: ['dataType', 'data'],
        }
    ),



    // 获取块内容工具
    createTool(
        'siyuan_get_block_content',
        `获取思源笔记块的详细内容的工具。

## 何时使用
- 需要查看特定块的完整内容
- 获取块的Markdown或Kramdown源码
- 分析块的结构和格式

## 返回格式
支持两种格式：
1. markdown: 标准Markdown格式，适合阅读
2. kramdown: 包含块ID信息的格式，适合编程处理

## 使用场景
- 读取文档内容用于分析或摘要
- 获取代码块的源代码
- 提取表格、列表等结构化数据
- 检查块的引用和链接

## 长文档处理
- 对于大型文档，会分块返回内容
- 每次最多返回1000个块的信息
- 可以通过多次调用处理完整文档
- 优先返回最相关的内容部分

## 注意事项
- 块ID必须存在且有效
- Kramdown格式包含额外的元数据`,
        {
            type: 'object',
            properties: {
                id: {
                    type: 'string',
                    description: '要获取内容的块ID',
                },
                format: {
                    type: 'string',
                    description: '返回格式：markdown（纯文本）或 kramdown（包含ID信息）',
                    enum: ['markdown', 'kramdown'],
                },
            },
            required: ['id', 'format'],
        }
    ),

    // 创建文档工具
    createTool(
        'siyuan_create_document',
        `在思源笔记中创建新文档的工具。

## 何时使用
- 用户要求创建新笔记
- 需要基于对话内容生成文档
- 整理信息并保存为新文档

## 文档创建功能
1. 自动创建层级目录
2. 支持完整的Markdown格式
3. 自动处理块引用
4. 可以在内容中使用关键词自动创建引用

## 路径格式
- 使用 / 分隔的路径，如 /日记/2024/01
- 不需要包含笔记本ID
- 会自动创建不存在的父目录
- 文件名会自动从路径中提取

## 使用示例

\`\`\`javascript
// 创建日记
siyuan_create_document({
  notebook: "20210808180117-6v0mkxr",
  path: "/日记/2024-01-01",
  markdown: "# 今日总结\\n\\n学习了AI知识..."
})

// 创建带引用的文档
siyuan_create_document({
  notebook: "20210808180117-6v0mkxr",
  path: "/笔记/机器学习/概述",
  markdown: "# 机器学习概述\\n\\n机器学习是人工智能的一个分支..."
})
\`\`\`

## 注意事项
- 必须提供有效的笔记本ID
- 路径中的文档如果已存在会报错
- Markdown内容会被解析并转换为块
- 自动块引用功能会增加处理时间
- 建议合理组织文档结构，避免过深的层级`,
        {
            type: 'object',
            properties: {
                notebook: {
                    type: 'string',
                    description: '笔记本ID，可以通过SQL查询 "SELECT * FROM blocks WHERE type=\'d\' LIMIT 1" 获取box字段',
                },
                path: {
                    type: 'string',
                    description: '文档路径，如 /日记/2024-01-01，会自动创建父目录',
                },
                markdown: {
                    type: 'string',
                    description: '文档内容，使用Markdown格式。支持自动块引用功能。',
                },
            },
            required: ['notebook', 'path', 'markdown'],
        }
    ),

    // 列出笔记本工具
    createTool(
        'siyuan_list_notebooks',
        `获取所有笔记本列表的工具。

## 何时使用
- 需要查看系统中有哪些笔记本
- 获取笔记本ID用于创建或查询文档
- 检查笔记本是否存在或已打开

## 返回信息
- 笔记本ID (id)
- 笔记本名称 (name)
- 笔记本图标 (icon)
- 排序权重 (sort)
- 是否已关闭 (closed)

## 使用场景
- 在创建文档前选择目标笔记本
- 列出可用的笔记本供用户选择
- 检查笔记本状态

## 注意事项
- 返回包括已打开和已关闭的笔记本
- 可以通过 closed 字段判断笔记本是否已关闭
- 笔记本ID是创建文档等操作的必要参数`,
        {
            type: 'object',
            properties: {},
            required: [],
        }
    ),

    // 获取文档树工具
    createTool(
        'siyuan_get_doc_tree',
        `获取指定路径下的子文档结构（文档树结构）

## 何时使用
- 需要列出某个笔记本下的文档树
- 需要以树形结构展示文档层级
- 需要获取父文档的子文档列表

## 使用方法
1. 提供笔记本ID，如果没提供，需要通过sql查询获取box值（select box from blocks where id = 'notebook_id'）
2. 指定起始文档路径，根路径为'/', 文档路径举例，"/20241210222249-ovvy2kp/20241210222305-00azub2.sy"，如果没提供，需要通过sql查询获取path值（select path from blocks where id = 'block_id'）
3. 可选排序模式（若不指定，将使用笔记本或全局配置决定）

## 返回格式示例
[
  {
    name: "文档名",
    id: "文档ID",
    children: [ ... ]
  }
]

## 注意事项
- 如果笔记本的 sortMode 为 15（文档树排序），函数会读取全局文件树排序设置：window.siyuan.config.fileTree.sort
- 返回结果为 JSON 数组，节点包含 name、id 和 children 字段，children 为数组（可能为空）`,
        {
            type: 'object',
            properties: {
                notebook: {
                    type: 'string',
                    description: '笔记本ID',
                },
                path: {
                    type: 'string',
                    description: "起始路径，默认 '/'",
                },
                sortMode: {
                    type: 'number',
                    description: '可选的排序模式，若不提供将由笔记本或全局配置决定',
                },
            },
            required: ['notebook'],
        }
    ),

    // 创建笔记本工具
    createTool(
        'siyuan_create_notebook',
        `创建新笔记本的工具。

## 何时使用
- 用户要求创建新的笔记本
- 需要为特定项目或主题创建独立的笔记本
- 组织和管理笔记结构

## 创建功能
- 创建指定名称的新笔记本
- 自动生成笔记本ID
- 新笔记本会自动打开

## 使用示例

\`\`\`javascript
// 创建项目笔记本
siyuan_create_notebook({
  name: "项目管理"
})

// 创建学习笔记本
siyuan_create_notebook({
  name: "机器学习笔记"
})
\`\`\`

## 注意事项
- 笔记本名称不能为空
- 如果同名笔记本已存在，可能会报错
- 创建成功后会返回笔记本对象，包含ID等信息
- 新笔记本默认会自动打开`,
        {
            type: 'object',
            properties: {
                name: {
                    type: 'string',
                    description: '笔记本名称',
                },
            },
            required: ['name'],
        }
    ),

    // 重命名文档工具
    createTool(
        'siyuan_rename_document',
        `重命名思源笔记文档的工具。

## 何时使用
- 用户要求修改文档标题
- 需要更新文档名称以反映内容变化
- 整理和优化文档命名

## 使用方法
1. 通过SQL查询或其他方式获取要重命名的文档ID
2. 提供新的文档标题
3. 调用工具完成重命名

## 参数说明
- id: 文档的块ID
- title: 新的文档标题

## 使用示例

\`\`\`javascript
// 重命名文档
siyuan_rename_document({
  id: "20210917220056-yxtyl7i",
  title: "新标题"
})
\`\`\`

## 注意事项
- 必须提供准确的文档ID,如果上下文没有提供ID，需要自己使用sql获取ID
- 新标题不能为空
- 重命名不会改变文档ID
- 不会影响文档的内容和结构
- 文件系统中的文件名也会相应更新`,
        {
            type: 'object',
            properties: {
                id: {
                    type: 'string',
                    description: '文档ID',
                },
                title: {
                    type: 'string',
                    description: '新的文档标题',
                },
            },
            required: ['id', 'title'],
        }
    ),

    // 移动文档工具
    createTool(
        'siyuan_move_documents',
        `移动思源笔记文档到指定位置的工具。

## 何时使用
- 用户要求移动文档到其他文档下或其他笔记本
- 需要重新组织文档结构
- 整理笔记层级关系

## 使用方法
1. 确定要移动的文档ID列表（可以是一个或多个）
2. 确定目标位置（目标父文档ID或笔记本ID）
3. 调用工具完成移动

## 参数说明
- fromIDs: 源文档ID数组，可以移动多个文档
- toID: 目标父文档ID或笔记本ID
  - 如果是文档ID，源文档会成为该文档的子文档
  - 如果是笔记本ID，源文档会移动到笔记本根目录

## 使用示例

\`\`\`javascript
// 移动单个文档到另一个文档下
siyuan_move_documents({
  fromIDs: ["20210917220056-yxtyl7i"],
  toID: "20210817205410-2kvfpfn"
})

// 移动多个文档到笔记本根目录
siyuan_move_documents({
  fromIDs: ["20210917220056-yxtyl7i", "20210918120056-abcdefg"],
  toID: "20210808180117-6v0mkxr"
})
\`\`\`

## 注意事项
- fromIDs 必须是有效的文档ID数组
- toID 可以是文档ID或笔记本ID，如果上下文没有提供ID，需要自己使用sql获取ID
- 移动后文档ID不会改变
- 移动会改变文档的路径和层级关系
- 可以批量移动多个文档
- 不能将文档移动到其自身或其子文档下`,
        {
            type: 'object',
            properties: {
                fromIDs: {
                    type: 'array',
                    description: '源文档ID数组，可以是一个或多个文档ID',
                    items: {
                        type: 'string',
                    },
                },
                toID: {
                    type: 'string',
                    description: '目标父文档ID或笔记本ID',
                },
            },
            required: ['fromIDs', 'toID'],
        }
    ),
    // 获取块属性工具
    createTool(
        'siyuan_get_block_attrs',
        `获取指定块的属性。

## 使用场景
- 读取某个块的自定义属性（如 tags、bookmark、alias 等）

## 参数
- id: 要查询的块ID

## 返回
- 返回一个对象，键为属性名，值为属性值。

## 对文档块返回的所有属性
- icon: 文档图标
- id: 文档 id
- tags: 文档标签，多个标签使用逗号分隔
- type: 文档类型（'d' 表示文档）
- update: 更新时间戳或时间字符串
- bookmark: 书签标识（如存在）
- alias: 文档别名
- name: 文档命名，可与title不同
- title: 文档标题
- memo: 备注

## 普通块不包含的属性
- icon
- tags
- title

## 注意
- 不包含文档路径、归属笔记本等信息，需要通过sql查询
`,
        {
            type: 'object',
            properties: {
                id: {
                    type: 'string',
                    description: '要获取属性的块ID',
                },
            },
            required: ['id'],
        }
    ),

    // 设置块属性工具
    createTool(
        'siyuan_set_block_attrs',
        `设置指定块的属性。

## 使用场景
- 修改或添加块属性（如 tags、bookmark、alias 等）

## 参数
- id: 要设置属性的块ID
- attrs: 属性对象，键为属性名，值为属性值（字符串）

## 示例
\`\`\`js
{
  id: '20251217195359-2kjwv0x',
  attrs: { tags: '1,3', bookmark: '✨' }
}
\`\`\`

## 注意事项
- 如果要设置标签需要先获取已有标签，然后根据用户需求是增加新标签还是直接覆盖标签，如果标签为空则直接覆盖
`,
        {
            type: 'object',
            properties: {
                id: {
                    type: 'string',
                    description: '要设置属性的块ID',
                },
                attrs: {
                    type: 'object',
                    description: '属性对象，键为属性名，值为字符串',
                },
            },
            required: ['id', 'attrs'],
        }
    ),
    // 数据库工具
    createTool(
        'siyuan_database',
        `思源笔记数据库(AttributeView)操作工具。数据库由多个API组合使用，此工具整合了所有数据库相关操作。

## 何时使用
- 需要搜索、查询或操作数据库
- 向数据库添加行或设置属性
- 获取数据库结构和内容信息

## 主要操作类型

### 1. searchDatabase - 搜索数据库
搜索数据库，可以通过关键词查找数据库。

**参数:**
- keyword: 搜索关键词
- avID: (可选)数据库ID，用于精确搜索

**返回:** 包含数据库ID、名称、视图信息等

**示例:**
\`\`\`json
{
  "operation": "searchDatabase",
  "keyword": "示例数据库",
  "avID": "20230804163730-1olpfp2"
}
\`\`\`

### 2. getColumns - 获取数据库列信息
获取数据库有几列，每列的id和类型是什么。

**参数:**
- avID: 数据库ID

**返回:** 列信息数组，包含id、name、type等

**示例:**
\`\`\`json
{
  "operation": "getColumns",
  "avID": "20241207205647-baw0ri8"
}
\`\`\`

### 3. renderDatabase - 获取数据库内容/创建数据库
渲染并获取数据库的完整内容，包括所有行和列的数据。也可以用于在指定块中创建新的数据库。

**参数:**
- avID: 数据库ID（已存在的数据库）或块ID（要在其中创建新数据库的块）
- viewID: 视图ID
- pageSize: (可选)每页数量，默认9999999
- page: (可选)页码，默认1
- createIfNotExist: (可选)如果不存在是否创建，默认true

**返回:** 完整的数据库视图数据

**获取已有数据库内容示例:**
\`\`\`json
{
  "operation": "renderDatabase",
  "avID": "20241017094451-2urncs9",
  "viewID": "20241017094451-91wdu3a",
  "pageSize": 9999999,
  "page": 1
}
\`\`\`

**在块中创建新数据库:**
要在指定块中创建新数据库，需要先调用 renderDatabase 获取数据库视图，然后使用 siyuan_update_block 在块内容中插入以下 HTML：

\`\`\`html
<div data-type="NodeAttributeView" data-av-id="数据库ID" data-av-type="table"></div>
\`\`\`

其中：
- data-av-id: 数据库ID（可以从其他数据库操作中获取，或生成新的 ID）
- data-av-type: 数据库类型，目前支持 "table"（表格视图）

**创建新数据库完整示例:**
1. 先调用 renderDatabase 确认数据库存在
2. 在目标块中插入数据库引用：
\`\`\`javascript
siyuan_update_block({
  dataType: "dom",
  data: '<div data-type="NodeAttributeView" data-av-id="20260312111052-1n50yv2" data-av-type="table"></div>',
  id: "目标块ID"
})
\`\`\`

这样就会在指定块中渲染显示数据库视图。

### 4. addDetachedRows - 添加非绑定行
向数据库添加非绑定的块和属性值。

**参数:**
- avID: 数据库ID
- blocksValues: 二维数组，每个元素是一行的数据
  - keyID: 列ID
  - block/text/mSelect/number: 根据列类型设置值

**示例:**
\`\`\`json
{
  "operation": "addDetachedRows",
  "avID": "20241017094451-2urncs9",
  "blocksValues": [
    [
      {
        "keyID": "20241017094451-jwfegvp",
        "block": { "content": "Test block" }
      },
      {
        "keyID": "20241017094451-fu1pv7s",
        "mSelect": [{"content": "Fiction5", "color": "3"}]
      },
      {
        "keyID": "20241017095436-2wlgb7o",
        "number": { "content": 1234 }
      }
    ]
  ]
}
\`\`\`

### 5. addBoundBlocks - 添加绑定块
向数据库添加绑定的文档块。

**参数:**
- avID: 数据库ID
- blockIDs: 要绑定的块ID数组
- itemIDs: (可选)指定itemID数组，与blockIDs一一对应

**示例:**
\`\`\`json
{
  "operation": "addBoundBlocks",
  "avID": "20241017094451-2urncs9",
  "blockIDs": ["20240107212802-727hsjv"],
  "itemIDs": ["20240107212802-727hsjv"]
}
\`\`\`

### 6. setAttribute - 设置单个属性
设置数据库中某个单元格的属性值。

**参数:**
- avID: 数据库ID
- keyID: 列ID
- itemID: 行ID (v3.3.1+使用itemID)
- valueType: 值类型 (text/number/select/mSelect等)
- value: 属性值对象
**返回值**

为null
**示例:**
\`\`\`json
{
  "operation": "setAttribute",
  "avID": "20241017094451-2urncs9",
  "keyID": "20241102151935-gypad0k",
  "itemID": "20251217205758-el6y4i3",
  "valueType": "text",
  "value": {
    "text": { "content": "示例文本" }
  }
}
\`\`\`

### 7. batchSetAttributes - 批量设置属性
批量设置多个单元格的属性值。

**参数:**
- avID: 数据库ID
- values: 属性值数组
  - keyID: 列ID
  - rowID: 行ID
  - value: 属性值对象

**返回值**

为null

**示例:**
\`\`\`json
{
  "operation": "batchSetAttributes",
  "avID": "20250716235026-51p7441",
  "values": [
    {
      "keyID": "20250716235026-njmx362",
      "rowID": "20250716235124-6qqlnpw",
      "value": { "block": { "content": "Test" } }
    },
    {
      "keyID": "20250716235026-a0v1j35",
      "rowID": "20250716235124-6qqlnpw",
      "value": { "number": { "content": 111 } }
    }
  ]
}
\`\`\`

### 8. getDatabasesForBlock - 查询块所在的数据库
查询哪些数据库包含了指定的块。

**参数:**
- blockID: 块ID

**返回:** 包含该块的所有数据库信息

**示例:**
\`\`\`json
{
  "operation": "getDatabasesForBlock",
  "blockID": "20220719202005-e3bn8ks"
}
\`\`\`

### 9. getItemIDsByBlockIDs - 根据块ID获取ItemID
根据绑定块ID获取对应的ItemID (v3.3.1+)。

**参数:**
- avID: 数据库ID
- blockIDs: 块ID数组

**示例:**
\`\`\`json
{
  "operation": "getItemIDsByBlockIDs",
  "avID": "20250829105223-fk06kth",
  "blockIDs": ["20250829105224-mh7mtd2", "20250829105226-8o6pfqb"]
}
\`\`\`

### 10. getBlockIDsByItemIDs - 根据ItemID获取块ID
根据ItemID获取对应的绑定块ID (v3.3.1+)。

**参数:**
- avID: 数据库ID
- itemIDs: ItemID数组

**示例:**
\`\`\`json
{
  "operation": "getBlockIDsByItemIDs",
  "avID": "20250829105223-fk06kth",
  "itemIDs": ["20250830173630-y0h4nrx", "20250830185837-4ww0kcq"]
}
\`\`\`

### 11. addColumn - 添加数据库列
向数据库添加新的列。

**参数:**
- avID: 数据库ID
- keyName: 列名称
- keyType: 列类型 (text/number/select/mSelect/block/date/url/email/phone等)
- previousKeyID: 前一列的ID，用于指定新列的位置
- keyIcon: 可选，列图标，默认为空字符串，unicode字符，比如2728，1f4cc
**返回值**

为null
**示例:**
\`\`\`json
{
  "operation": "addColumn",
  "avID": "20241017094451-2urncs9",
  "keyName": "新列名",
  "keyType": "text",
  "keyIcon": "",
  "previousKeyID": "20251217230203-rm3hnkr"
}
\`\`\`

### 12. removeColumn - 删除数据库列
删除数据库中的指定列。

**参数:**
- avID: 数据库ID
- keyID: 要删除的列ID

**示例:**
\`\`\`json
{
  "operation": "removeColumn",
  "avID": "20241017094451-2urncs9",
  "keyID": "20241102151935-gypad0k"
}
\`\`\`

### 13. removeRows - 删除数据库行
删除数据库中的指定行。

**参数:**
- avID: 数据库ID
- srcIDs: 要删除的行ID数组

**示例:**
\`\`\`json
{
  "operation": "removeRows",
  "avID": "20241017094451-2urncs9",
  "srcIDs": ["20251217205758-el6y4i3", "20220719202005-e3bn8ks"]
}
\`\`\`

## 数据类型说明

### 列类型 (type)
- block: 块引用
- text: 文本
- number: 数字
- select: 单选
- mSelect: 多选
- date: 日期
- url: 链接
- email: 邮箱
- phone: 电话

### 值格式示例

**文本:**
\`\`\`json
{ "text": { "content": "文本内容" } }
\`\`\`

**数字:**
\`\`\`json
{ "number": { "content": 123 } }
\`\`\`

**单选/多选:**
\`\`\`json
{ "mSelect": [{ "content": "选项名", "color": "1" }] }
\`\`\`

**块引用:**
\`\`\`json
{ "block": { "content": "块标题" } }
\`\`\`

## 注意事项
- 单选设置值也使用mSelect类型来设置
- 添加绑定块时，isDetached设为false
- 添加非绑定块时，使用addDetachedRows操作
`,
        {
            type: 'object',
            properties: {
                operation: {
                    type: 'string',
                    description: '操作类型',
                    enum: [
                        'searchDatabase',
                        'getColumns',
                        'renderDatabase',
                        'addDetachedRows',
                        'addBoundBlocks',
                        'setAttribute',
                        'batchSetAttributes',
                        'getDatabasesForBlock',
                        'getItemIDsByBlockIDs',
                        'getBlockIDsByItemIDs',
                        'addColumn',
                        'removeColumn',
                        'removeRows'
                    ],
                },
                keyword: {
                    type: 'string',
                    description: '搜索关键词 (searchDatabase操作)',
                },
                avID: {
                    type: 'string',
                    description: '数据库ID',
                },
                viewID: {
                    type: 'string',
                    description: '视图ID (renderDatabase操作)',
                },
                pageSize: {
                    type: 'number',
                    description: '每页数量 (renderDatabase操作，默认9999999)',
                },
                page: {
                    type: 'number',
                    description: '页码 (renderDatabase操作，默认1)',
                },
                createIfNotExist: {
                    type: 'boolean',
                    description: '如果不存在是否创建 (renderDatabase操作，默认true)',
                },
                blocksValues: {
                    type: 'array',
                    description: '二维数组，每个元素是一行的数据 (addDetachedRows操作)',
                },
                blockIDs: {
                    type: 'array',
                    description: '块ID数组',
                    items: {
                        type: 'string',
                    },
                },
                itemIDs: {
                    type: 'array',
                    description: 'ItemID数组',
                    items: {
                        type: 'string',
                    },
                },
                keyID: {
                    type: 'string',
                    description: '列ID (setAttribute/removeColumn操作)',
                },
                itemID: {
                    type: 'string',
                    description: '行ID/ItemID (setAttribute操作)',
                },
                valueType: {
                    type: 'string',
                    description: '值类型 (setAttribute操作)',
                    enum: ['text', 'number', 'select', 'mSelect', 'block', 'date', 'url', 'email', 'phone'],
                },
                value: {
                    type: 'object',
                    description: '属性值对象 (setAttribute操作)',
                },
                values: {
                    type: 'array',
                    description: '属性值数组 (batchSetAttributes操作)',
                },
                blockID: {
                    type: 'string',
                    description: '块ID (getDatabasesForBlock操作)',
                },
                keyName: {
                    type: 'string',
                    description: '列名称 (addColumn操作)',
                },
                keyType: {
                    type: 'string',
                    description: '列类型 (addColumn操作)',
                    enum: ['text', 'number', 'select', 'mSelect', 'block', 'date', 'url', 'email', 'phone'],
                },
                keyIcon: {
                    type: 'string',
                    description: '列图标 (addColumn操作，可选，默认为空字符串)',
                },
                previousKeyID: {
                    type: 'string',
                    description: '前一列ID (addColumn操作，用于指定新列的位置)',
                },
                srcIDs: {
                    type: 'array',
                    description: '要删除的行ID数组 (removeRows操作)',
                    items: {
                        type: 'string',
                    },
                },
            },
            required: ['operation'],
        }
    ),

    // 网页内容获取工具
    createTool(
        'web_fetch',
        `获取网页内容并转换为 Markdown 格式的工具。

## 何时使用
- 需要获取网页文章内容进行参考或分析
- 需要抓取外部网页信息保存到笔记
- 需要阅读和分析在线文档、博客、新闻等

## 两种获取模式

### 1. 普通模式（默认）
直接发送 HTTP 请求获取网页内容，速度快，适用于大多数网站。

### 2. WebView 模式
使用内置浏览器加载页面，可以执行 JavaScript，适用于：
- 需要登录才能查看内容的网站
- 内容通过 JavaScript 动态加载的网站
- 有反爬虫机制的网站
- 需要执行页面脚本才能获取完整内容的网站

## 使用示例

\`\`\`javascript
// 普通模式获取某篇文章
web_fetch({
  url: "https://example.com/article"
})

// WebView 模式获取某篇文章（适用于动态加载或有反爬虫机制的网站）
web_fetch({
  url: "https://example.com/article",
  useWebView: true
})
\`\`\`

## 注意事项
- 某些网站有严格的反爬虫机制，如果普通模式失败，请尝试 WebView 模式
- 知乎网站暂不支持解析
- WebView 模式会实际加载页面，可能需要更长时间（最长等待30秒）
- 获取的内容会转换为 Markdown 格式返回`,
        {
            type: 'object',
            properties: {
                url: {
                    type: 'string',
                    description: '要获取的网页 URL，必须是完整的 http:// 或 https:// 链接',
                },
                useWebView: {
                    type: 'boolean',
                    description: '是否使用 WebView 模式加载页面。默认为 false（普通模式）。对于需要登录、动态加载或有反爬虫机制的网站，建议设为 true',
                    default: false,
                },
            },
            required: ['url'],
        }
    ),

    // 获取当前时间工具
    createTool(
        'siyuan_get_current_time',
        `获取当前日期和时间的工具。

## 何时使用
- 需要获取当前日期时间用于记录或计算
- 设置定时通知时需要知道今天的日期
- 需要计算时间差或时间戳
- 在笔记中插入当前日期时间

## 参数说明

### format (可选)
返回的时间格式：
- **"local"**（默认）：本地格式，如 "2026/3/12 10:30:00"
- **"iso"**：ISO 8601 格式，如 "2026-03-12T10:30:00.000Z"
- **"date"**：仅日期，如 "2026-03-12"
- **"time"**：仅时间，如 "10:30:00"
- **"timestamp"**：时间戳（毫秒），如 "1710234600000"

## 使用示例

\`\`\`javascript
// 获取本地格式时间（默认）
siyuan_get_current_time({})

// 获取完整 ISO 格式时间
siyuan_get_current_time({
  format: "iso"
})

// 获取今天日期（用于设置定时通知）
siyuan_get_current_time({
  format: "date"
})

// 获取当前时间戳
siyuan_get_current_time({
  format: "timestamp"
})

// 拼接今天指定时间用于定时通知
// 先获取日期，然后拼接具体时间
const date = "2026-03-12";  // 从 format: "date" 获取
const timeString = date + "T14:30:00";  // "2026-03-12T14:30:00"
\`\`\`

## 返回值
根据 format 参数返回不同格式的时间字符串`,
        {
            type: 'object',
            properties: {
                format: {
                    type: 'string',
                    description: '返回格式：local(默认)、iso、date、time、timestamp',
                    enum: ['iso', 'local', 'date', 'time', 'timestamp'],
                    default: 'local',
                },
            },
            required: [],
        }
    ),

    // 系统通知工具
    createTool(
        'siyuan_send_notification',
        `发送系统通知（桌面通知）到操作系统。

## 何时使用
- 需要向用户发送重要提醒或通知
- 长时间操作完成后提醒用户
- 定时任务到期提醒
- 需要立即引起用户注意的消息

## 参数说明

### title (必填)
通知标题，显示在通知的顶部。

### body (可选)
通知的详细内容，显示在标题下方。

### delay (可选)
延迟发送时间，支持三种格式：
- **数字**：延迟秒数，如 60 表示 60 秒后发送
- **时间字符串**：ISO 8601 格式的时间字符串
  - **本地时间**（推荐）：\`"2026-03-12T11:50:00"\` - 表示本地时区的 11:50
  - **UTC 时间**：\`"2026-03-12T11:50:00Z"\` - 表示 UTC 时区的 11:50，会自动转换为本地的对应时间
- **0 或不传**：立即发送

### timeoutType (可选)
通知超时类型：
- **"default"**（默认）：使用系统默认的超时时间
- **"never"**：通知不会自动消失，直到用户点击

## 使用示例

\`\`\`javascript
// 立即发送通知
siyuan_send_notification({
  title: "任务完成",
  body: "文档已成功导出到指定位置。"
})

// 延迟 5 分钟后发送通知
siyuan_send_notification({
  title: "休息提醒",
  body: "您已经工作了 25 分钟，该休息一下了！",
  delay: 300
})

// 在本地时间 11:50 发送通知（推荐，无时区后缀表示本地时间）
siyuan_send_notification({
  title: "会议提醒",
  body: "11:50 有团队会议，请做好准备。",
  delay: "2026-03-12T11:50:00"
})

// 在 UTC 时间 11:50 发送通知（带 Z 后缀表示 UTC）
// 系统会自动转换为本地对应时间
siyuan_send_notification({
  title: "国际会议",
  body: "UTC 时间 11:50 的会议即将开始",
  delay: "2026-03-12T11:50:00Z"
})

// 发送不会自动消失的重要通知
siyuan_send_notification({
  title: "重要提醒",
  body: "请记得备份今天的笔记内容！",
  timeoutType: "never"
})
\`\`\`

## 注意事项
- 通知会显示在操作系统的通知中心
- 需要操作系统支持并允许思源笔记发送通知
- 延迟通知会在后台等待，即使思源笔记最小化也能触发
- **时区说明**：无时区标记（如T11:50:00）表示本地时间，带 Z标记（如 T11:50:00Z）表示 UTC 时间`,
        {
            type: 'object',
            properties: {
                title: {
                    type: 'string',
                    description: '通知标题（必填）',
                },
                body: {
                    type: 'string',
                    description: '通知内容（可选，默认为空）',
                },
                delay: {
                    type: ['number', 'string'],
                    description: '延迟时间：数字表示秒数，字符串表示具体时间。本地时间格式 "2026-03-12T11:50:00"，UTC 时间格式 "2026-03-12T11:50:00Z"',
                },
                timeoutType: {
                    type: 'string',
                    description: '超时类型："default"（默认）或 "never"（不自动消失）',
                    enum: ['default', 'never'],
                    default: 'default',
                },
            },
            required: ['title'],
        }
    ),

    // 删除块工具
    createTool(
        'siyuan_delete_block',
        `删除思源笔记中的指定块。

## 何时使用
- 需要删除不再需要的内容块
- 清理错误或重复的块
- 删除空块或无用块

## 使用方法
1. 确定要删除的块ID
2. 调用此工具删除该块

## 注意事项
- **此操作不可恢复**，删除前请确认块ID正确
- 删除父块会同时删除其所有子块
- 删除文档块会删除整个文档

## 使用示例

\`\`\`javascript
// 删除指定块
siyuan_delete_block({
  id: "20210104091228-d0rzbmm"
})
\`\`\``,
        {
            type: 'object',
            properties: {
                id: {
                    type: 'string',
                    description: '要删除的块ID',
                },
            },
            required: ['id'],
        }
    ),

    // 通用思源API调用工具
    createTool(
        'siyuan_fetch_sync_post',
        `通用思源笔记 API 调用工具。可以调用任何思源笔记提供的 API 接口。

## 何时使用
- 需要使用当前工具列表中未提供的 API 功能
- 执行高级或特殊的思源笔记操作
- 访问底层思源笔记功能

## 常用 API 列表及参数

### 块操作

#### POST /api/block/insertBlock - 插入块
**参数:**
- dataType: string - 数据类型，"markdown" 或 "dom"
- data: string - 块内容
- nextID?: string - 在此块之前插入
- previousID?: string - 在此块之后插入  
- parentID?: string - 作为此块的子块插入（前置子块）

#### POST /api/block/prependBlock - 前置插入块
**参数:**
- dataType: string - 数据类型
- data: string - 块内容
- parentID: string - 父块ID

#### POST /api/block/appendBlock - 后置追加块
**参数:**
- dataType: string - 数据类型
- data: string - 块内容
- parentID: string - 父块ID

#### POST /api/block/updateBlock - 更新块
**参数:**
- dataType: string - 数据类型
- data: string - 新内容
- id: string - 块ID

#### POST /api/block/deleteBlock - 删除块
**参数:**
- id: string - 块ID

#### POST /api/block/moveBlock - 移动块
**参数:**
- id: string - 块ID
- previousID?: string - 移动到此块之后
- parentID?: string - 移动到此块下作为子块

#### POST /api/block/getBlockKramdown - 获取块 Kramdown 格式
**参数:**
- id: string - 块ID
- mode?: string - 模式，"md" 或 "textmark"（默认）

#### POST /api/block/getBlockDOM - 获取块 DOM
**参数:**
- id: string - 块ID

#### POST /api/block/getChildBlocks - 获取子块列表
**参数:**
- id: string - 块ID

#### POST /api/block/foldBlock - 折叠块
**参数:**
- id: string - 块ID

#### POST /api/block/unfoldBlock - 展开块
**参数:**
- id: string - 块ID

#### POST /api/block/transferBlockRef - 转移块引用
**参数:**
- fromID: string - 源块ID
- toID: string - 目标块ID
- refIDs: string[] - 引用ID数组

---

### 文档操作

#### POST /api/filetree/getDoc - 获取文档内容
**参数:**
- id: string - 文档ID

#### POST /api/filetree/createDocWithMd - 创建文档
**参数:**
- notebook: string - 笔记本ID
- path: string - 文档路径，如 "/folder/doc"
- markdown: string - 文档内容（Markdown格式）

#### POST /api/filetree/renameDoc - 重命名文档（通过路径）
**参数:**
- notebook: string - 笔记本ID
- path: string - 文档路径
- title: string - 新标题

#### POST /api/filetree/renameDocByID - 重命名文档（通过ID）
**参数:**
- id: string - 文档ID
- title: string - 新标题

#### POST /api/filetree/removeDoc - 删除文档
**参数:**
- notebook: string - 笔记本ID
- path: string - 文档路径

#### POST /api/filetree/moveDocs - 移动文档（通过路径）
**参数:**
- fromPaths: string[] - 源路径数组
- toNotebook: string - 目标笔记本ID
- toPath: string - 目标路径

#### POST /api/filetree/moveDocsByID - 移动文档（通过ID）
**参数:**
- fromIDs: string[] - 源文档ID数组
- toID: string - 目标文档ID

#### POST /api/filetree/getHPathByPath - 获取可读路径（通过路径）
**参数:**
- notebook: string - 笔记本ID
- path: string - 文档路径

#### POST /api/filetree/getHPathByID - 获取可读路径（通过ID）
**参数:**
- id: string - 文档ID

#### POST /api/filetree/getIDsByHPath - 通过可读路径获取ID
**参数:**
- notebook: string - 笔记本ID
- path: string - 可读路径

#### POST /api/filetree/searchDocs - 搜索文档
**参数:**
- k: string - 关键词
- flashcard?: boolean - 是否搜索闪卡文档

#### POST /api/filetree/listDocsByPath - 列出路径下文档
**参数:**
- notebook: string - 笔记本ID
- path: string - 路径
- sort?: number - 排序方式（默认15）
- showHidden?: boolean - 是否显示隐藏文档
- maxListCount?: number - 最大返回数量

---

### 笔记本操作

#### POST /api/notebook/lsNotebooks - 列出笔记本
**参数:** 无

#### POST /api/notebook/openNotebook - 打开笔记本
**参数:**
- notebook: string - 笔记本ID

#### POST /api/notebook/closeNotebook - 关闭笔记本
**参数:**
- notebook: string - 笔记本ID

#### POST /api/notebook/createNotebook - 创建笔记本
**参数:**
- name: string - 笔记本名称

#### POST /api/notebook/removeNotebook - 删除笔记本
**参数:**
- notebook: string - 笔记本ID

#### POST /api/notebook/renameNotebook - 重命名笔记本
**参数:**
- notebook: string - 笔记本ID
- name: string - 新名称

#### POST /api/notebook/getNotebookConf - 获取笔记本配置
**参数:**
- notebook: string - 笔记本ID

#### POST /api/notebook/setNotebookConf - 设置笔记本配置
**参数:**
- notebook: string - 笔记本ID
- conf: object - 配置对象

---

### 属性操作

#### POST /api/attr/getBlockAttrs - 获取块属性
**参数:**
- id: string - 块ID

#### POST /api/attr/setBlockAttrs - 设置块属性
**参数:**
- id: string - 块ID
- attrs: object - 属性对象，如 {"custom-key": "value"}

---

### SQL 查询

#### POST /api/query/sql - 执行 SQL 查询
**参数:**
- stmt: string - SQL 语句

---

### 资源文件

#### POST /api/asset/upload - 上传资源文件
**参数:**
- assetsDirPath: string - 资源目录路径
- files: File[] - 文件数组（使用 FormData 格式）

---

### 导出

#### POST /api/export/exportMdContent - 导出 Markdown 内容
**参数:**
- id: string - 文档ID
- yfm?: boolean - 是否包含 YAML Front Matter
- fillCSSVar?: boolean - 是否填充 CSS 变量
- refMode?: number - 引用模式（2:锚文本块链, 3:仅锚文本, 4:块引转脚注）
- embedMode?: number - 嵌入模式（0:原始文本, 1:Blockquote）
- adjustHeadingLevel?: boolean - 是否调整标题级别

#### POST /api/export/exportResources - 导出资源
**参数:**
- paths: string[] - 路径数组
- name: string - 导出文件名

---

### 系统

#### POST /api/system/version - 获取版本
**参数:** 无

#### POST /api/system/currentTime - 获取当前时间
**参数:** 无

#### POST /api/system/bootProgress - 获取启动进度
**参数:** 无

---

### 数据库 (AttributeView)

#### POST /api/av/searchAttributeView - 搜索数据库
**参数:**
- keyword: string - 搜索关键词
- avID?: string - 数据库ID（可选，精确搜索）

#### POST /api/av/getAttributeViewKeys - 获取块所在数据库列表
**参数:**
- id: string - 块ID

#### POST /api/av/getAttributeViewKeysByAvID - 获取数据库列信息
**参数:**
- avID: string - 数据库ID

#### POST /api/av/renderAttributeView - 渲染数据库视图
**参数:**
- id: string - 数据库ID
- viewID: string - 视图ID
-createIfNotExist
:
true
- pageSize?: number - 每页数量（默认9999999）
- page?: number - 页码（默认1）

#### POST /api/av/appendAttributeViewDetachedBlocksWithValues - 添加非绑定块
**参数:**
- avID: string - 数据库ID
- blocksValues: any[][] - 二维数组，每行数据

#### POST /api/av/addAttributeViewBlocks - 添加绑定块
**参数:**
- avID: string - 数据库ID
- srcs: Array<{id: string, isDetached: boolean, itemID?: string}> - 源块数组

#### POST /api/av/setAttributeViewBlockAttr - 设置块属性值
**参数:**
- avID: string - 数据库ID
- keyID: string - 列ID
- itemID: string - 行ID
- value: object - 属性值

#### POST /api/av/batchSetAttributeViewBlockAttrs - 批量设置属性值
**参数:**
- avID: string - 数据库ID
- values: Array<{keyID: string, rowID: string, value: any}> - 属性值数组

#### POST /api/av/addAttributeViewKey - 添加数据库列
**参数:**
- avID: string - 数据库ID
- keyName: string - 列名称
- keyType: string - 列类型（text/number/select/mSelect/block/date/url/email/phone）
- previousKeyID: string - 前一列ID（用于指定位置）
- keyIcon?: string - 列图标（可选）

#### POST /api/av/removeAttributeViewKey - 删除数据库列
**参数:**
- avID: string - 数据库ID
- keyID: string - 列ID

#### POST /api/av/removeAttributeViewBlocks - 删除数据库行
**参数:**
- avID: string - 数据库ID
- srcIDs: string[] - 行ID数组

#### POST /api/av/getAttributeViewBoundBlockIDsByItemIDs - 通过ItemID获取块ID
**参数:**
- avID: string - 数据库ID
- itemIDs: string[] - ItemID数组

#### POST /api/av/getAttributeViewItemIDsByBoundIDs - 通过块ID获取ItemID
**参数:**
- avID: string - 数据库ID
- blockIDs: string[] - 块ID数组

---

### 网络

#### POST /api/network/forwardProxy - 正向代理请求
**参数:**
- url: string - 目标URL
- method?: string - 请求方法（默认GET）
- payload?: object - 请求体
- headers?: any[] - 请求头数组
- timeout?: number - 超时时间（默认7000ms）
- contentType?: string - 内容类型（默认text/html）

---

### 通知

#### POST /api/notification/pushMsg - 推送消息
**参数:**
- msg: string - 消息内容
- timeout?: number - 显示时间（默认7000ms）

#### POST /api/notification/pushErrMsg - 推送错误消息
**参数:**
- msg: string - 错误消息内容
- timeout?: number - 显示时间（默认7000ms）

---

### 闪卡

#### POST /api/riff/addRiffCards - 添加闪卡
**参数:**
- blockIDs: string[] - 块ID数组
- deckID?: string - 闪卡组ID（默认快速闪卡组）

#### POST /api/riff/removeRiffCards - 移除闪卡
**参数:**
- blockIDs: string[] - 块ID数组
- deckID?: string - 闪卡组ID

#### POST /api/riff/getRiffDecks - 获取闪卡组列表
**参数:** 无

#### POST /api/riff/createRiffDeck - 创建闪卡组
**参数:**
- name: string - 闪卡组名称

#### POST /api/riff/removeRiffDeck - 删除闪卡组
**参数:**
- deckID: string - 闪卡组ID

#### POST /api/riff/renameRiffDeck - 重命名闪卡组
**参数:**
- deckID: string - 闪卡组ID
- name: string - 新名称

#### POST /api/riff/getRiffCards - 获取闪卡列表
**参数:**
- deckID: string - 闪卡组ID

---

### 文件

#### POST /api/file/getFile - 获取文件
**参数:**
- path: string - 文件路径

#### POST /api/file/putFile - 保存文件（使用 FormData）
**参数:**
- path: string - 文件路径
- isDir: boolean - 是否为目录
- file: File - 文件内容

#### POST /api/file/removeFile - 删除文件
**参数:**
- path: string - 文件路径

#### POST /api/file/readDir - 读取目录
**参数:**
- path: string - 目录路径

---

### 模板

#### POST /api/template/render - 渲染模板
**参数:**
- id: string - 文档ID
- path: string - 模板路径

#### POST /api/template/renderSprig - 渲染 Sprig 模板
**参数:**
- template: string - 模板字符串

---

### 转换

#### POST /api/convert/pandoc - Pandoc 转换
**参数:**
- args: string[] - Pandoc 参数数组

---

## 使用示例

\`\`\`javascript
// 获取块的 Kramdown 格式内容
siyuan_fetch_sync_post({
  api: "/api/block/getBlockKramdown",
  data: {
    id: "20210104091228-d0rzbmm",
    mode: "textmark"
  }
})

// 获取子块列表
siyuan_fetch_sync_post({
  api: "/api/block/getChildBlocks",
  data: {
    id: "20210104091228-d0rzbmm"
  }
})

// 列出笔记本
siyuan_fetch_sync_post({
  api: "/api/notebook/lsNotebooks",
  data: {}
})

// 执行 SQL 查询
siyuan_fetch_sync_post({
  api: "/api/query/sql",
  data: {
    stmt: "SELECT * FROM blocks WHERE type='d' LIMIT 10"
  }
})

// 折叠块
siyuan_fetch_sync_post({
  api: "/api/block/foldBlock",
  data: {
    id: "20210104091228-d0rzbmm"
  }
})

// 推送通知
siyuan_fetch_sync_post({
  api: "/api/notification/pushMsg",
  data: {
    msg: "操作完成！",
    timeout: 5000
  }
})
\`\`\`

## 注意事项
- API 路径可以带或不带 "/api/" 前缀，工具会自动处理
- 所有参数都通过 data 对象传递
- 可选参数可以不传或使用 null/undefined
- 此工具提供底层 API 访问，请谨慎使用
- 部分 API 可能需要特定的权限或前提条件
- 文件上传类 API（如 /api/asset/upload、/api/file/putFile）可能需要特殊处理，建议使用专用工具`,
        {
            type: 'object',
            properties: {
                api: {
                    type: 'string',
                    description: 'API 路径，如 "/api/block/getChildBlocks" 或 "block/getChildBlocks"',
                },
                data: {
                    type: 'object',
                    description: '请求数据对象，根据具体 API 的要求构造',
                },
            },
            required: ['api'],
        }
    ),
];

// ==================== 工具实现 ====================


/**
 * 执行SQL查询（带限制）
 */
export async function siyuan_sql_query(sqlQuery: string): Promise<any[]> {
    try {

        // 限制返回数量
        const limitedQuery = sqlQuery.includes('LIMIT') ? sqlQuery : `${sqlQuery} LIMIT 1000`;

        const results = await sql(limitedQuery);

        // 如果结果过多，提供摘要
        if (results.length >= 1000) {
            console.warn('SQL query returned 1000+ results, might be truncated');
        }

        return results;
    } catch (error) {
        console.error('Execute SQL query error:', error);
        throw new Error(`SQL查询失败: ${(error as Error).message}`);
    }
}

/**
 * 插入块
 */
export async function siyuan_insert_block(
    dataType: 'markdown' | 'dom',
    data: string,
    parentID?: string,
    appendParentID?: string,
    previousID?: string,
    nextID?: string
): Promise<any> {
    try {
        if (!parentID && !appendParentID && !previousID && !nextID) {
            throw new Error('必须至少指定一个位置参数：parentID、appendParentID、previousID 或 nextID');
        }

        // 使用 insertBlock API 插入块
        let lute = window.Lute.New()
        let newBlockDom: string;
        if (dataType === 'dom') {
            newBlockDom = data;
        } else {
            newBlockDom = lute.Md2BlockDOM(data);
        }
        let newBlockId = newBlockDom.match(/data-node-id="([^"]*)"/)?.[1];

        let insertResult = null;
        // 创建可撤回的事务
        if (newBlockId) {
            try {
                const currentProtyle = getProtyle();
                if (currentProtyle) {

                    // 获取父块ID
                    let actualParentID = parentID || appendParentID;
                    if (!actualParentID && (previousID || nextID)) {
                        const refBlockId = previousID || nextID;
                        const refBlock = await getBlockByID(refBlockId as string);
                        actualParentID = refBlock?.root_id || currentProtyle.block?.id;
                    }

                    const doOperations = [];
                    if (appendParentID) {
                        // 使用appendBlock API作为后置子块插入
                        const appendResult = await appendBlock(dataType, data, appendParentID);
                        insertResult = {
                            id: newBlockId,
                            parentID: appendParentID,
                            previousID: previousID,
                            nextID: nextID,
                            appendParentID: appendParentID
                        };
                        return insertResult;
                    } else if (nextID) {
                        doOperations.push({
                            action: 'insert',
                            id: newBlockId,
                            data: newBlockDom,
                            parentID: actualParentID,
                            nextID: nextID,
                        });
                    } else if (previousID) {
                        doOperations.push({
                            action: 'insert',
                            id: newBlockId,
                            data: newBlockDom,
                            parentID: actualParentID,
                            previousID: previousID,
                        });
                    } else if (parentID) {
                        doOperations.push({
                            action: 'insert',
                            id: newBlockId,
                            data: newBlockDom,
                            parentID: actualParentID,
                        });
                    }

                    const undoOperations = [
                        {
                            action: 'delete',
                            id: newBlockId,
                            data: null,
                        },
                    ];
                    insertResult = {
                        id: newBlockId,
                        parentID: actualParentID,
                        previousID: previousID,
                        nextID: nextID,
                        appendParentID: appendParentID
                    };
                    // 执行事务以支持撤回
                    // @ts-ignore
                    currentProtyle.getInstance()?.transaction(doOperations, undoOperations);
                    setTimeout(() => {
                        currentProtyle.getInstance()?.reload(false);
                    }, 500);
                }

            } catch (transactionError) {

            }
        }

        return insertResult;
    } catch (error) {
        console.error('Insert block error:', error);
        throw new Error(`插入块失败: ${(error as Error).message}`);
    }
}

/**
 * 更新块
 */
export async function siyuan_update_block(
    dataType: 'markdown' | 'dom',
    data: string,
    id: string
): Promise<any> {
    try {
        // 保存旧的DOM用于撤回操作
        const oldBlockDomRes = await getBlockDOM(id);
        const oldBlockDom = oldBlockDomRes?.dom;

        // 使用 updateBlock API 更新块内容
        const result = await updateBlock(dataType, data, id);
        await refreshSql();

        // 获取当前编辑器实例并创建可撤回的事务
        try {
            const currentProtyle = getProtyle();
            if (currentProtyle && oldBlockDom) {
                await refreshSql();
                const newBlockDomRes = await getBlockDOM(id);
                const newBlockDom = newBlockDomRes?.dom;

                if (newBlockDom) {
                    // @ts-ignore
                    currentProtyle.getInstance()?.updateTransaction(id, newBlockDom, oldBlockDom);
                    console.log('Created undo transaction for block update:', id);
                }
            }
        } catch (transactionError) {
            console.warn('创建撤回事务失败，但块内容已更新:', transactionError);
        }

        return result;
    } catch (error) {
        console.error('Update block error:', error);
        throw new Error(`更新块失败: ${(error as Error).message}`);
    }
}

/**
 * 获取块内容
 */
export async function siyuan_get_block_content(
    id: string,
    format: 'markdown' | 'kramdown'
): Promise<string> {
    try {
        if (format === 'kramdown') {
            const result = await getBlockKramdown(id);
            if (!result || !result.kramdown) {
                throw new Error('获取Kramdown内容失败');
            }
            return result.kramdown;
        } else {
            const result = await exportMdContent(id, false, false, 2, 0, false);
            if (!result || !result.content) {
                throw new Error('获取Markdown内容失败');
            }
            return result.content;
        }
    } catch (error) {
        console.error('Get block content error:', error);
        throw new Error(`获取块内容失败: ${(error as Error).message}`);
    }
}

/**
 * 创建文档
 */
export async function siyuan_create_document(
    notebook: string,
    path: string,
    markdown: string
): Promise<string> {
    try {
        // 首先创建文档
        const docId = await createDocWithMd(notebook, path, markdown);

        // 自动打开创建的文档
        try {
            await openBlock(docId);
        } catch (openError) {
            console.warn('打开文档失败，但文档已创建:', openError);
        }

        return docId;
    } catch (error) {
        console.error('Create document error:', error);
        throw new Error(`创建文档失败: ${(error as Error).message}`);
    }
}

/**
 * 列出所有笔记本
 */
export async function siyuan_list_notebooks(): Promise<any> {
    try {
        const result = await lsNotebooks();
        return result;
    } catch (error) {
        console.error('List notebooks error:', error);
        throw new Error(`获取笔记本列表失败: ${(error as Error).message}`);
    }
}

/**
 * 递归获取指定路径下的文档树结构
 */
export async function siyuan_get_doc_tree(notebook: string, path: string = '/', sortMode?: number): Promise<any[]> {
    try {
        // 决定最终的排序模式
        let finalSortMode = sortMode;
        if (finalSortMode === undefined || finalSortMode === null) {
            const confRes: any = await getNotebookConf(notebook);
            const notebookSortMode = confRes?.conf?.sortMode;
            if (notebookSortMode === 15) {
                finalSortMode = window.siyuan?.config?.fileTree?.sort ?? 15;
            } else {
                finalSortMode = notebookSortMode ?? 15;
            }
        }

        async function fetchDocsRecursively(currentPath: string): Promise<any[]> {
            try {
                const res: any = await listDocsByPath(notebook, currentPath, finalSortMode, false, 10000);
                if (!res || !res.files) {
                    console.error(`获取路径 [${currentPath}] 失败:`, res);
                    return [];
                }

                const docPromises = res.files.map(async (file: any) => {
                    const node: any = {
                        name: file.name.replace(/\.sy$/, ''),
                        id: file.id,
                        children: [] as any[],
                    };

                    if (file.subFileCount > 0) {
                        const childPath = file.path.replace(/\.sy$/, '');
                        node.children = await fetchDocsRecursively(childPath);
                    }
                    return node;
                });

                return await Promise.all(docPromises);

            } catch (error) {
                console.error(`处理路径 [${currentPath}] 时发生错误:`, error);
                return [];
            }
        }

        return await fetchDocsRecursively(path);
    } catch (error) {
        console.error('Get doc tree error:', error);
        throw new Error(`获取文档树失败: ${(error as Error).message}`);
    }
}

/**
 * 创建笔记本
 */
export async function siyuan_create_notebook(name: string): Promise<any> {
    try {
        const result = await createNotebook(name);
        return result;
    } catch (error) {
        console.error('Create notebook error:', error);
        throw new Error(`创建笔记本失败: ${(error as Error).message}`);
    }
}

/**
 * 重命名文档
 */
export async function siyuan_rename_document(
    id: string,
    title: string
): Promise<string> {
    try {
        const result = await renameDocByID(id, title);
        return result;
    } catch (error) {
        console.error('Rename document error:', error);
        throw new Error(`重命名文档失败: ${(error as Error).message}`);
    }
}

/**
 * 移动文档
 */
export async function siyuan_move_documents(
    fromIDs: string[],
    toID: string
): Promise<any> {
    try {
        if (!fromIDs || fromIDs.length === 0) {
            throw new Error('fromIDs 不能为空');
        }
        if (!toID) {
            throw new Error('toID 不能为空');
        }

        const result = await moveDocsByID(fromIDs, toID);
        return result;
    } catch (error) {
        console.error('Move documents error:', error);
        throw new Error(`移动文档失败: ${(error as Error).message}`);
    }
}

/**
 * 获取块属性
 */
export async function siyuan_get_block_attrs(id: string): Promise<{ [key: string]: string } | any> {
    try {
        const res = await getBlockAttrs(id);
        return res;
    } catch (error) {
        console.error('Get block attrs error:', error);
        throw new Error(`获取块属性失败: ${(error as Error).message}`);
    }
}

/**
 * 设置块属性
 */
export async function siyuan_set_block_attrs(id: string, attrs: { [key: string]: string }): Promise<any> {
    try {
        const result = await setBlockAttrs(id, attrs);
        return result;
    } catch (error) {
        console.error('Set block attrs error:', error);
        throw new Error(`设置块属性失败: ${(error as Error).message}`);
    }
}

/**
 * 数据库操作工具
 */
export async function siyuan_database(params: any): Promise<any> {
    try {
        const { operation } = params;

        switch (operation) {
            case 'searchDatabase': {
                const { keyword, avID } = params;
                if (!keyword) {
                    throw new Error('keyword参数是必需的');
                }
                const result = await searchAttributeView(keyword, avID);
                return result;
            }

            case 'getColumns': {
                const { avID } = params;
                if (!avID) {
                    throw new Error('avID参数是必需的');
                }
                const result = await getAttributeViewKeysByAvID(avID);
                return result;
            }

            case 'renderDatabase': {
                const { avID, viewID, pageSize, page, createIfNotExist } = params;
                if (!avID || !viewID) {
                    throw new Error('avID和viewID参数是必需的');
                }
                const result = await renderAttributeView(
                    avID,
                    viewID,
                    pageSize || 9999999,
                    page || 1,
                    createIfNotExist ?? true
                );
                return result;
            }

            case 'addDetachedRows': {
                const { avID, blocksValues } = params;
                if (!avID || !blocksValues) {
                    throw new Error('avID和blocksValues参数是必需的');
                }
                const result = await appendAttributeViewDetachedBlocksWithValues(avID, blocksValues);
                return result;
            }

            case 'addBoundBlocks': {
                const { avID, blockIDs, itemIDs } = params;
                if (!avID || !blockIDs) {
                    throw new Error('avID和blockIDs参数是必需的');
                }
                const srcs = blockIDs.map((id: string, index: number) => ({
                    id: id,
                    isDetached: false,
                    itemID: itemIDs ? itemIDs[index] : id
                }));
                const result = await addAttributeViewBlocks(avID, srcs);
                return result;
            }

            case 'setAttribute': {
                const { avID, keyID, itemID, value } = params;
                if (!avID || !keyID || !itemID || !value) {
                    throw new Error('avID、keyID、itemID和value参数是必需的');
                }
                const result = await setAttributeViewBlockAttr(avID, keyID, itemID, value);
                return result;
            }

            case 'batchSetAttributes': {
                const { avID, values } = params;
                if (!avID || !values) {
                    throw new Error('avID和values参数是必需的');
                }
                const result = await batchSetAttributeViewBlockAttrs(avID, values);
                return result;
            }

            case 'getDatabasesForBlock': {
                const { blockID } = params;
                if (!blockID) {
                    throw new Error('blockID参数是必需的');
                }
                const result = await getAttributeViewKeys(blockID);
                return result;
            }

            case 'getItemIDsByBlockIDs': {
                const { avID, blockIDs } = params;
                if (!avID || !blockIDs) {
                    throw new Error('avID和blockIDs参数是必需的');
                }
                const result = await getAttributeViewItemIDsByBoundIDs(avID, blockIDs);
                return result;
            }


            case 'getBlockIDsByItemIDs': {
                const { avID, itemIDs } = params;
                if (!avID || !itemIDs) {
                    throw new Error('avID和itemIDs参数是必需的');
                }
                const result = await getAttributeViewBoundBlockIDsByItemIDs(avID, itemIDs);
                return result;
            }

            case 'addColumn': {
                const { avID, keyName, keyType, keyIcon, previousKeyID } = params;
                if (!avID || !keyName || !keyType || !previousKeyID) {
                    throw new Error('avID、keyName、keyType和previousKeyID参数是必需的');
                }
                // addAttributeViewKey 会自动生成 keyID，keyIcon 默认为空字符串
                const result = await addAttributeViewKey(
                    avID,
                    keyName,
                    keyType,
                    previousKeyID, // previousKeyID 必选
                    undefined, // keyID 自动生成
                    keyIcon || "" // keyIcon 默认为空字符串
                );
                return result;
            }

            case 'removeColumn': {
                const { avID, keyID } = params;
                if (!avID || !keyID) {
                    throw new Error('avID和keyID参数是必需的');
                }
                const result = await removeAttributeViewKey(avID, keyID);
                return result;
            }

            case 'removeRows': {
                const { avID, srcIDs } = params;
                if (!avID || !srcIDs) {
                    throw new Error('avID和srcIDs参数是必需的');
                }
                const result = await removeAttributeViewBlocks(avID, srcIDs);
                return result;
            }

            default:
                throw new Error(`未知的操作类型: ${operation}`);
        }
    } catch (error) {
        console.error('Database operation error:', error);
        throw new Error(`数据库操作失败: ${(error as Error).message}`);
    }
}

/**
 * 删除块工具
 * @param id 要删除的块ID
 */
export async function siyuan_delete_block(id: string): Promise<any> {
    try {
        if (!id) {
            throw new Error('块ID是必需的');
        }
        const result = await deleteBlock(id);
        return result;
    } catch (error) {
        console.error('Delete block error:', error);
        throw new Error(`删除块失败: ${(error as Error).message}`);
    }
}

/**
 * 通用思源API调用工具
 * 可以调用任何思源笔记的API
 * @param api API路径，如 '/api/block/insertBlock'
 * @param data 请求数据对象
 */
export async function siyuan_fetch_sync_post(api: string, data: any): Promise<any> {
    try {
        if (!api) {
            throw new Error('API路径是必需的');
        }
        // 确保API路径以 /api/ 开头
        const url = api.startsWith('/api/') ? api : `/api/${api}`;
        const result = await request(url, data || {});
        return result;
    } catch (error) {
        console.error('API call error:', error);
        throw new Error(`API调用失败: ${(error as Error).message}`);
    }
}

/**
 * 发送系统通知
 * @param title 通知标题
 * @param body 通知内容
 * @param delay 延迟时间（秒）或具体时间字符串/Date对象
 * @param timeoutType 超时类型：'default' 或 'never'
 */
export async function siyuan_send_notification(
    title: string,
    body: string,
    delay: number | string = 0,
    timeoutType: 'default' | 'never' = 'default'
): Promise<any> {
    try {
        if (!title) {
            throw new Error('通知标题是必需的');
        }
        console.log(`siyuan_send_notification: title="${title}", delay=${delay}, type=${typeof delay}`);
        const result = await sendNotification(title, body || '', delay, timeoutType);
        return result;
    } catch (error) {
        console.error('Send notification error:', error);
        throw new Error(`发送通知失败: ${(error as Error).message}`);
    }
}

/**
 * 获取当前日期和时间
 * @param format 返回格式，'iso' | 'local' | 'date' | 'time' | 'timestamp'，默认为 'iso'
 */
export async function siyuan_get_current_time(
    format: 'iso' | 'local' | 'date' | 'time' | 'timestamp' = 'local'
): Promise<string> {
    const now = new Date();
    
    switch (format) {
        case 'iso':
            return now.toISOString();
        case 'local':
            return now.toLocaleString('zh-CN');
        case 'date':
            return now.toISOString().split('T')[0];
        case 'time':
            return now.toTimeString().split(' ')[0];
        case 'timestamp':
            return now.getTime().toString();
        default:
            return now.toISOString();
    }
}

/**
 * 获取网页内容并转换为 Markdown
 * @param url 要获取的网页 URL
 * @param useWebView 是否使用 WebView 模式，默认为 false
 */
export async function web_fetch(url: string, useWebView: boolean = false): Promise<string> {
    // 如果明确指定使用 WebView 模式
    if (useWebView) {
        try {
            const webviewResult = await fetchWithWebView(url);
            
            if (webviewResult.success) {
                return `# ${webviewResult.title}\n\n来源: ${url}\n\n---\n\n${webviewResult.markdown}`;
            } else {
                return `WebView 模式获取失败: ${webviewResult.error}`;
            }
        } catch (error) {
            console.error('WebView fetch error:', error);
            return `WebView 模式获取失败: ${(error as Error).message}`;
        }
    }
    
    // 普通模式：直接获取
    const result = await parseWebPageToMarkdown(url);
    
    if (result.success) {
        return `# ${result.title}\n\n来源: ${result.url}\n\n---\n\n${result.markdown}`;
    }
    
    // 普通模式失败，提示用户可以尝试 WebView 模式
    return `获取网页内容失败: ${result.error}\n\n提示: 如果该网站需要登录、使用 JavaScript 动态加载内容或有反爬虫机制，请使用 WebView 模式重试。设置 useWebView: true 即可。`;
}

/**
 * 执行工具调用
 */
export async function executeToolCall(toolCall: ToolCall): Promise<string> {
    const { name, arguments: argsStr } = toolCall.function;

    try {
        const args = JSON.parse(argsStr);

        switch (name) {
            case 'get_siyuan_skills':
                // 获取工具详细描述
                const toolDesc = getSiyuanSkills(args.toolName);
                return toolDesc;

            case 'siyuan_sql_query':
                const results = await siyuan_sql_query(args.sql);
                return JSON.stringify(results, null, 2);

            case 'siyuan_insert_block':
                const insertResult = await siyuan_insert_block(
                    args.dataType,
                    args.data,
                    args.parentID,
                    args.appendParentID,
                    args.previousID,
                    args.nextID
                );
                return JSON.stringify(insertResult, null, 2);

            case 'siyuan_update_block':
                const updateResult = await siyuan_update_block(args.dataType, args.data, args.id);
                return JSON.stringify(updateResult, null, 2);

            case 'siyuan_get_block_content':
                return await siyuan_get_block_content(args.id, args.format);

            case 'siyuan_create_document':
                const docId = await siyuan_create_document(args.notebook, args.path, args.markdown);
                return `文档创建成功，ID: ${docId}`;

            case 'siyuan_list_notebooks':
                const notebooks = await siyuan_list_notebooks();
                return JSON.stringify(notebooks, null, 2);

            case 'siyuan_get_doc_tree':
                {
                    const tree = await siyuan_get_doc_tree(args.notebook, args.path || '/', args.sortMode);
                    return JSON.stringify(tree, null, 2);
                }

            case 'siyuan_create_notebook':
                const notebook = await siyuan_create_notebook(args.name);
                return JSON.stringify(notebook, null, 2);

            case 'siyuan_get_block_attrs':
                {
                    const attrs = await siyuan_get_block_attrs(args.id);
                    return JSON.stringify(attrs, null, 2);
                }

            case 'siyuan_set_block_attrs':
                {
                    const setRes = await siyuan_set_block_attrs(args.id, args.attrs);
                    return JSON.stringify(setRes, null, 2);
                }

            case 'siyuan_rename_document':
                const renameResult = await siyuan_rename_document(args.id, args.title);
                return `文档重命名成功，新ID: ${renameResult}`;

            case 'siyuan_move_documents':
                const moveResult = await siyuan_move_documents(args.fromIDs, args.toID);
                return JSON.stringify(moveResult, null, 2);

            case 'siyuan_database':
                const dbResult = await siyuan_database(args);
                return JSON.stringify(dbResult, null, 2);

            case 'web_fetch':
                const webResult = await web_fetch(args.url, args.useWebView);
                return webResult;

            case 'siyuan_delete_block':
                const deleteResult = await siyuan_delete_block(args.id);
                return JSON.stringify(deleteResult, null, 2);

            case 'siyuan_fetch_sync_post':
                const apiResult = await siyuan_fetch_sync_post(args.api, args.data);
                return JSON.stringify(apiResult, null, 2);

            case 'siyuan_send_notification':
                const notifyResult = await siyuan_send_notification(
                    args.title,
                    args.body,
                    args.delay,
                    args.timeoutType
                );
                return JSON.stringify(notifyResult, null, 2);

            case 'siyuan_get_current_time':
                const timeResult = await siyuan_get_current_time(args.format);
                return timeResult;

            default:
                throw new Error(`未知的工具: ${name}`);
        }
    } catch (error) {
        console.error(`Execute tool ${name} error:`, error);
        return `执行工具失败: ${(error as Error).message}`;
    }
}
