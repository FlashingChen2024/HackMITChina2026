-- 方案 A Step 1：餐盒用餐主表
-- 状态机 EATING→IDLE 时更新；GET /meals 与 GET /meals/{meal_id} 读此表

CREATE TABLE IF NOT EXISTS Lunchbox_Meals (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    meal_id VARCHAR(64) NOT NULL COMMENT '业务主键，如 meal_{device_id}_{start_time_unix}',
    device_id VARCHAR(64) NOT NULL COMMENT '设备标识',
    user_id BIGINT NOT NULL COMMENT '用户ID，冗余便于按 user 分页',

    start_time INT NOT NULL COMMENT '就餐开始 Unix 时间戳(秒)',
    end_time INT NULL COMMENT '就餐结束 Unix 时间戳(秒)',
    duration_minutes INT NULL COMMENT '就餐时长(分钟)',

    total_served_g DECIMAL(10,2) NULL COMMENT '打饭总量(g)',
    total_leftover_g DECIMAL(10,2) NULL COMMENT '剩余总量(g)',
    total_intake_g DECIMAL(10,2) NULL COMMENT '摄入量(g)',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_meal_id (meal_id),
    INDEX idx_user_start (user_id, start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='餐盒用餐主表';
