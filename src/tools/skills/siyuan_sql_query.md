执行思源笔记SQL查询的工具。

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
| name       | 内容块命名| 一级标题命名   |
| alias       | 内容块别名| 一级标题别名   |
| memo       | 内容块备注| 一级标题备注   |
| tag       | 非文档块为块内包含的标签，文档块为文档的标签       | #标签1# #标签2# #标签3#   |
| content       | 去除了 Markdown 标记符的文本,对于数据库type=av，不能查询content字段，否则上下文会剧增,请查询Markdown       | 一级标题   |
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

```sql
-- 搜索包含关键词的文档，为了查找更相关的结果，需要思考不同词，一起查询
-- 假设用户要搜索“时间管理”相关文档，需要想到“任务管理”或“GTD”等相关词。
SELECT id,content FROM blocks
WHERE (content LIKE '%时间管理%' OR content LIKE '%任务管理%' OR content LIKE '%GTD%')
AND type='d'
LIMIT 50;

-- 获取最近更新的文档
SELECT id,content FROM blocks WHERE type='d' ORDER BY updated DESC LIMIT 50;

-- 查找带有特定标签的块
SELECT id,content FROM blocks WHERE tag LIKE '%标签名%';
```

## 注意事项
- 避免查询过多数据，使用LIMIT限制结果数量，默认50，如用户的要求出现“所有”等关键词，则LIMIT为-1
- 如果没有必要，不要用select *，只查询需要的字段如id和content，避免上下文爆炸，对于数据库type=av，不能查询content字段，否则上下文会剧增
- 查询之后的结果总结，使用思源笔记块链接的格式包裹，如`[脑机接口](siyuan://blocks/20240519195512-ccrifu0)`
