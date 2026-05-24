通用思源笔记 API 调用工具。可以调用任何思源笔记提供的 API 接口（如无必要，不要使用）。

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
- values: Array<{keyID: string, itemID: string, value: any}> - 属性值数组

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

```javascript
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
```

## 注意事项
- API 路径可以带或不带 "/api/" 前缀，工具会自动处理
- 所有参数都通过 data 对象传递
- 可选参数可以不传或使用 null/undefined
- 此工具提供底层 API 访问，请谨慎使用
- 部分 API 可能需要特定的权限或前提条件
- 文件上传类 API（如 /api/asset/upload、/api/file/putFile）可能需要特殊处理，建议使用专用工具
