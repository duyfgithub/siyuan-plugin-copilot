获取当前日期和时间的工具。

## 何时使用
- 需要获取当前日期时间用于记录或计算
- 设置定时通知时需要知道今天的日期
- 需要计算时间差或时间戳
- 在笔记中插入当前日期时间

## 参数说明

### format (可选)
返回的时间格式：
- **"local"**（默认）：本地格式，如 "2026/3/12 10:30:00"
- **"iso"**：ISO 8601 格式，如 "2026-03-12T10:30:00.000Z"
- **"date"**：仅日期，如 "2026-03-12"
- **"time"**：仅时间，如 "10:30:00"
- **"timestamp"**：时间戳（毫秒），如 "1710234600000"

## 使用示例

```javascript
// 获取本地格式时间（默认）
siyuan_get_current_time({})

// 获取完整 ISO 格式时间
siyuan_get_current_time({
  format: "iso"
})

// 获取今天日期（用于设置定时通知）
siyuan_get_current_time({
  format: "date"
})

// 获取当前时间戳
siyuan_get_current_time({
  format: "timestamp"
})

// 拼接今天指定时间用于定时通知
// 先获取日期，然后拼接具体时间
const date = "2026-03-12";  // 从 format: "date" 获取
const timeString = date + "T14:30:00";  // "2026-03-12T14:30:00"
```

## 返回值
根据 format 参数返回不同格式的时间字符串
