获取指定路径下的子文档结构（文档树结构）

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
- 返回结果为 JSON 数组，节点包含 name、id 和 children 字段，children 为数组（可能为空）
