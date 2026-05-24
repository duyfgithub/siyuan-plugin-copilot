向数据库添加新的列。

## 何时使用
- 扩展数据库结构，添加新字段
- 创建新的属性列

## 参数说明
- avID: 数据库ID（必填）
- keyName: 列名称（必填）
- keyType: 列类型（必填）
  - text: 文本
  - number: 数字
  - select: 单选
  - mSelect: 多选
  - block: 块引用
  - date: 日期
  - url: 链接
  - email: 邮箱
  - phone: 电话
- previousKeyID: 前一列的ID，用于指定新列的位置（必填）
- keyIcon: 列图标（可选，unicode字符，如2728、1f4cc）

## 使用示例
```javascript
siyuan_add_database_column({
  avID: "20241017094451-2urncs9",
  keyName: "优先级",
  keyType: "select",
  previousKeyID: "20251217230203-rm3hnkr",
  keyIcon: "1f4cc"
})
```
