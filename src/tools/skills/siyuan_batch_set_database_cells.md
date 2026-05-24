批量设置数据库多个单元格的属性值。

## 何时使用
- 同时修改多个单元格的值
- 批量更新数据行

## 参数说明
- avID: 数据库ID（必填）
- values: 属性值数组（必填）
  - keyID: 列ID
  - itemID: 行ID/ItemID
  - value: 属性值对象

## 使用示例
```javascript
siyuan_batch_set_database_cells({
  avID: "20250716235026-51p7441",
  values: [
    { "keyID": "20250716235026-njmx362", "itemID": "20250716235124-6qqlnpw", "value": { "block": { "content": "Test" } } },
    { "keyID": "20250716235026-a0v1j35", "itemID": "20250716235124-6qqlnpw", "value": { "number": { "content": 111 } } },
    { "keyID": "20250716235026-a0v1j35", "itemID": "20250716235124-6qqlnpw", "value": { "mSelect": [{ "content": "选项1", "color": "2" }] } }
  ]
})
```

## 返回值
- 成功时返回 null，这是正常行为
- 失败时会抛出错误

## 注意事项
- 单选列和多选列都是用 mSelect 类型来设置值
- 对于 mSelect 类型的值，color 范围为 1-13，如果传入的值大于 13，系统会自动取余数
