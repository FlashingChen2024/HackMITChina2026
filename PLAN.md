🚀 交付物二：AI 与设备管理敏捷落地计划 (PLAN v4.2)

**实施原则**：设备接口优先落地，AI 接口先走“写死假数据”测试前端链路，最后再接入真实的大模型 API。

### 🟢 M1: 设备生命周期管理 (Easy Win)（已完成）

- **开发任务**：
  
  1. 在 Gin 路由组中新增 `GET /devices` 和 `DELETE /devices/{device_id}`，必须挂载 `JWTAuthMiddleware`。
    
  2. **查询**：使用 GORM `db.Where("user_id = ?", userID).Find(&devices)`。
    
  3. **解绑**：使用 GORM `db.Where("device_id = ? AND user_id = ?", reqID, userID).Delete(&DeviceBinding{})`。
    
- **验收标准 (Postman)**：
  
  1. 调用 `GET` 成功返回包含 `ESP32_xxx` 的数组。
    
  2. 调用 `DELETE` 后，数据库中的绑定记录消失；使用别人的 Token 去解绑，返回 `403 Forbidden`。
    

### 🟡 M2: AI 数据组装与 Prompt 引擎搭建（已完成）

- **开发任务**：
  
  1. 创建 `GET /users/me/ai-advice` 接口控制器。
    
  2. 编写三个数据捞取服务（Service 层）：
    
    - 捞取最后一次就餐的 `meal_grids` 详情。
      
    - 捞取今天的 `SUM(total_cal)`。
      
    - 捞取过去三天的聚合数据。
      
  3. 使用 Golang 的 `fmt.Sprintf`，将捞取出的真实数字动态填充进预设的文本模板（Prompt）中。
    
- **验收标准 (控制台日志)**：
  
  - 在控制台打印出拼接好的完整 Prompt（例如：“用户今天摄入了 800kcal，吃了西红柿和米饭，进食速度 25g/min，请生成点评”），确认传给大模型的数据准确无误。

### 🔴 M3: LLM 穿透调用与警报闭环 (The AI Magic)（已完成）

- **开发任务**：
  
  1. 在 Go 项目中引入大模型 SDK（如 `github.com/sashabaranov/go-openai` 或通过标准 HTTP 库请求 Google Gemini API）。
    
  2. 把 M2 组装好的 Prompt 发送给大模型，设置 `Temperature=0.7`（保证回答的灵活性和幽默感）。
    
  3. 将大模型返回的 `string` 包装成 JSON `{"advice": "...", "is_alert": true/false}` 返回给前端。
    
- **验收标准 (全链路路演模拟)**：
  
  1. 前端模拟吃完一顿极其不健康的饭（只吃肉不吃菜，2分钟吃完）。
    
  2. 前端请求 `type=meal_review` 接口，等待 2-3 秒后，屏幕上成功渲染出大模型生成的“吐槽式健康建议”。
