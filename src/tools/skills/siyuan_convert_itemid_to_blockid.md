根据ItemID获取对应的绑定块ID（v3.3.1+）。

## 何时使用
- 需要通过数据库行ID查询对应的块ID
- ItemID与块ID的转换

## 参数说明
- avID: 数据库ID（必填）
- itemIDs: ItemID数组（必填）

## 使用示例
```javascript
siyuan_convert_itemid_to_blockid({
  avID: "20250829105223-fk06kth",
  itemIDs: ["20250830173630-y0h4nrx", "20250830185837-4ww0kcq"]
})
```
