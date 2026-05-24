向数据库添加绑定的文档块

## 何时使用
- 将已有文档块绑定到数据库
- 在数据库中引用现有内容

## 参数说明
- avID: 数据库ID（必填）
- blockIDs: 要绑定的块ID数组（必填）
- itemIDs: (可选)指定itemID数组，与blockIDs一一对应

## 使用示例
```javascript
siyuan_add_database_blocks({
  avID: "20241017094451-2urncs9",
  blockIDs: ["20240107212802-727hsjv"],
  itemIDs: ["20240107212802-727hsjv"]
})
```

## 注意事项
- 绑定块会与文档块关联，文档内容变化时数据库中的显示也会更新
- 绑定后可以通过块ID查询对应的ItemID
