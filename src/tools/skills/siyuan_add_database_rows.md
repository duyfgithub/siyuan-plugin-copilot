向数据库添加非绑定行（独立数据行）。

## 何时使用
- 向数据库添加新的数据行
- 添加不绑定到具体块的数据

## 参数说明
- avID: 数据库ID（必填）
- blocksValues: 二维数组，每个元素是一行的数据（必填）
  - keyID: 列ID
  - 根据列类型设置值: block/text/mSelect/number/date/url/email/phone等

## 值格式示例

**文本:**
```json
{ "keyID": "列ID", "text": { "content": "文本内容" } }
```

**数字:**
```json
{ "keyID": "列ID", "number": { "content": 123 } }
```

**单选/多选:**
```json
{ "keyID": "列ID", "mSelect": [{ "content": "选项名", "color": "1" }] }
```

**块引用:**
```json
{ "keyID": "列ID", "block": { "content": "块标题" } }
```

## 使用示例
```javascript
siyuan_add_database_rows({
  avID: "20241017094451-2urncs9",
  blocksValues: [
    [
      { "keyID": "20241017094451-jwfegvp", "block": { "content": "Test block" } },
      { "keyID": "20241017094451-fu1pv7s", "mSelect": [{"content": "Fiction", "color": "3"}] },
      { "keyID": "20241017095436-2wlgb7o", "number": { "content": 1234 } }
    ]
  ]
})
```

## 注意事项
- 单选设置值也使用mSelect类型来设置
- 添加非绑定行时不关联到具体文档块
- color 范围为 1-13，如果传入的值大于 13，系统会自动取余数
