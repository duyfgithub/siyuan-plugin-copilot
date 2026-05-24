搜索思源笔记数据库(AttributeView)。

## 何时使用
- 需要查找特定的数据库
- 获取数据库ID和视图信息
- 列出系统中的所有数据库

## 参数说明
- keyword: 搜索关键词（必填）
- avID: (可选)数据库ID，用于精确搜索

## 返回信息
- 数据库ID、名称、视图信息等

## 使用示例
```javascript
siyuan_search_database({
  keyword: "项目管理",
  avID: "20230804163730-1olpfp2"
})
```
