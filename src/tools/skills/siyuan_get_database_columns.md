获取数据库的列信息（表头）。

## 何时使用
- 需要了解数据库有哪些列
- 获取列的ID和类型信息
- 在添加/修改数据前确认列结构

## 参数说明
- avID: 数据库ID（必填）

## 返回信息
- 列信息数组，包含id、name、type等

## 列类型说明
- block: 块引用
- text: 文本
- number: 数字
- select: 单选
- mSelect: 多选
- date: 日期
- url: 链接
- email: 邮箱
- phone: 电话

## 使用示例
```javascript
siyuan_get_database_columns({
  avID: "20241207205647-baw0ri8"
})
```
