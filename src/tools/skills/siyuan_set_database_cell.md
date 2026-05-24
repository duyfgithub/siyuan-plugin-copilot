设置数据库中某个单元格的属性值。

## 何时使用
- 修改数据库中特定行和列的值
- 更新单个单元格数据

## 参数说明
- avID: 数据库ID（必填）
- keyID: 列ID（必填）
- itemID: 行ID/ItemID（必填）
- value: 属性值对象（必填）

## 值格式示例

**文本:**
```json
{ "text": { "content": "文本内容" } }
```

**数字:**
```json
{ "number": { "content": 123 } }
```

**单选/多选:**
```json
{ "mSelect": [{ "content": "选项名", "color": "1" }] }
```

**块引用:**
```json
{ "block": { "content": "块标题" } }
```

## 使用示例
```javascript
siyuan_set_database_cell({
  avID: "20241017094451-2urncs9",
  keyID: "20241102151935-gypad0k",
  itemID: "20251217205758-el6y4i3",
  value: { "text": { "content": "示例文本" } }
})
```

## 注意事项
- 单选设置值也使用mSelect类型来设置
- color 范围为 1-13，如果传入的值大于 13，系统会自动取余数
