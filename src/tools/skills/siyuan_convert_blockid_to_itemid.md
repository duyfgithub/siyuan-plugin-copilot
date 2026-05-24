根据绑定块ID获取对应的ItemID（v3.3.1+）。

## 何时使用
- 需要通过块ID查询数据库中的行ID
- 块ID与ItemID的转换

## 参数说明
- avID: 数据库ID（必填）
- blockIDs: 块ID数组（必填）

## 使用示例
```javascript
siyuan_convert_blockid_to_itemid({
  avID: "20250829105223-fk06kth",
  blockIDs: ["20250829105224-mh7mtd2", "20250829105226-8o6pfqb"]
})
```
