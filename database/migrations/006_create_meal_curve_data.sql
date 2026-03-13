-- 方案 A Step 1：就餐时序轨迹表
-- GET /meals/{meal_id}/trajectory 读此表；EATING 阶段每次 telemetry 写入一点

CREATE TABLE IF NOT EXISTS Meal_Curve_Data (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    meal_id VARCHAR(64) NOT NULL COMMENT '关联 Lunchbox_Meals.meal_id',
    timestamp INT NOT NULL COMMENT 'Unix 时间戳(秒)',

    grid_1 DECIMAL(10,2) NULL COMMENT '左上主食格(g)',
    grid_2 DECIMAL(10,2) NULL COMMENT '右上菜品格(g)',
    grid_3 DECIMAL(10,2) NULL COMMENT '左下菜品格(g)',
    grid_4 DECIMAL(10,2) NULL COMMENT '右下汤/小菜格(g)',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_meal_timestamp (meal_id, timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='就餐时序轨迹表';
