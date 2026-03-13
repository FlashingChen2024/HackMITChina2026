-- 方案 A Step 1：设备-用户绑定表
-- 用于 telemetry 的 device_id 查 user_id，列表/详情与同步 Meal_Records 时使用

CREATE TABLE IF NOT EXISTS Device_User_Binding (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    device_id VARCHAR(64) NOT NULL COMMENT '设备 MAC 或唯一标识',
    user_id BIGINT NOT NULL COMMENT '用户ID',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_device_id (device_id),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备-用户绑定表';
