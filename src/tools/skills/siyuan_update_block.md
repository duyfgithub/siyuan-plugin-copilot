更新思源笔记中已存在块的工具。

## 何时使用
- 需要修改现有笔记内容
- 用户要求更新某个特定的块
- 修正或改进已有信息

## 使用方法
1. 获取要更新的块ID（上下文提供、SQL查询等方式）
2. 准备新的内容（Markdown格式）
3. 调用工具更新块内容

## 更新策略
- 保留结构：尽量保持原有的块结构和子块
- 属性保留：块属性（如别名、标签）会被保留

## 注意事项
- 必须提供准确的块ID
- 思源笔记kramdown格式可以添加文字颜色：格式为<span data-type="text" style="background-color: var(--b3-card-error-background); color: var(--b3-card-error-color);">文本</span>，优先使用以下颜色变量：
  - 红色文字：--b3-font-color1
  - 橙色文字：--b3-font-color2
  - 蓝色文字：--b3-font-color3
  - 绿色文字：--b3-font-color4
  - 灰色文字：--b3-font-color5
  - 红色卡片：color: var(--b3-card-error-color); background-color: var(--b3-card-error-background);
  - 绿色卡片：color: var(--b3-card-success-color); background-color: var(--b3-card-success-background);
  - 蓝色卡片：color: var(--b3-card-info-color); background-color: var(--b3-card-info-background);
  - 橙色卡片：color: var(--b3-card-warning-color); background-color: var(--b3-card-warning-background);
- 不建议频繁更新大型文档块，考虑只更新特定段落

## 调用工具后
- 更新块后以思源块链接格式返回，方便用户点击跳转查看
