渲染并获取数据库的完整内容，包括所有行和列的数据。

## 何时使用
- 查看数据库的所有数据
- 获取数据库的行信息
- 在指定块中创建新的数据库视图

## 参数说明
- avID: 数据库ID（已存在的数据库）或块ID（要在其中创建新数据库的块）（必填）
- viewID: 视图ID（必填）
- pageSize: (可选)每页数量，默认9999999
- page: (可选)页码，默认1
- createIfNotExist: (可选)如果不存在是否创建，默认true

## 在块中创建新数据库
要在指定块中创建新数据库，需要先调用此工具获取数据库视图，然后使用 siyuan_update_block 在块内容中插入以下 HTML：

```html
<div data-type="NodeAttributeView" data-av-id="数据库ID" data-av-type="table"></div>
```

## 使用示例
```javascript
siyuan_render_database({
  avID: "20241017094451-2urncs9",
  viewID: "20241017094451-91wdu3a",
  pageSize: 9999999,
  page: 1
})
```
