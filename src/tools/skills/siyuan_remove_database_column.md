删除数据库中的指定列。

## 何时使用
- 移除不再需要的列
- 调整数据库结构

## 参数说明
- avID: 数据库ID（必填）
- keyID: 要删除的列ID（必填）

## 使用示例
```javascript
siyuan_remove_database_column({
  avID: "20241017094451-2urncs9",
  keyID: "20241102151935-gypad0k"
})
```

## 注意事项
- 删除列会同时删除该列的所有数据，请谨慎操作
