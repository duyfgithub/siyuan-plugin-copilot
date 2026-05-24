在思源笔记中插入新块的工具。

## 何时使用
- 用户要求添加新内容到笔记
- 需要在特定位置插入信息
- 创建新的笔记内容

## 使用方法
1. 使用markdown格式准备要插入的内容
2. 确定插入位置（在某个块之前、之后，或作为子块）
3. 调用工具插入内容，插入

## 位置参数说明
- parentID: 将新块作为指定块的子块插入（前置子块）
- appendParentID: 将新块作为指定块的后置子块插入（追加到父块最后）
- previousID: 在指定块之后插入新块
- nextID: 在指定块之前插入新块

## 使用示例

```javascript
// 在块前插入新块
siyuan_insert_block({
  dataType: "markdown",
  data: "# 新标题\n\n这是新插入的内容。",
  nextID: "20210104091228-d0rzbmm"  // 在此块之前插入
})

// 在块后插入新块
siyuan_insert_block({
  dataType: "markdown",
  data: "- 新列表项",
  previousID: "20210104091228-d0rzbmm"  // 在此块之后插入
})

// 作为前置子块插入
siyuan_insert_block({
  dataType: "markdown",
  data: "这是前置子块内容",
  parentID: "20210104091228-d0rzbmm"  // 作为此块的前置子块
})

// 作为后置子块插入（追加到父块最后）
siyuan_insert_block({
  dataType: "markdown",
  data: "这是后置子块内容",
  appendParentID: "20210104091228-d0rzbmm"  // 作为此块的后置子块
})
```

## 注意事项
- 插入块可以通过markdown换行符一次性插入多个块，可以一次性插入长文本
- 至少需要指定一个位置参数（parentID、appendParentID、previousID或nextID）
- 如果指定parentID，会作为子块追加到父块的最前面
- 如果指定appendParentID，会作为子块追加到父块的最后面
- previousID和nextID用于在同级块中定位

## 调用工具后
- 插入块后以思源块链接格式返回，方便用户点击跳转查看
