-- 用餐记录表（原始数据）
-- 模块5 执行清单 5-1-1：Meal_Records 为汇总数据来源

CREATE TABLE IF NOT EXISTS Meal_Records (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL COMMENT '用户ID',
    meal_time TIMESTAMP NOT NULL COMMENT '用餐时间',

    initial_weight DECIMAL(10,2) COMMENT '打饭量(g)',
    remaining_weight DECIMAL(10,2) COMMENT '剩余量(g)',
    intake_weight DECIMAL(10,2) COMMENT '摄入量(g)',

    eating_duration INT COMMENT '用餐时长(秒)',
    eating_speed DECIMAL(10,2) COMMENT '用餐速度(g/min)',

    dish_info JSON COMMENT '菜品信息JSON',
    total_calories DECIMAL(10,2) COMMENT '卡路里(kcal)',

    status TINYINT DEFAULT 1 COMMENT '状态：1-正常，2-异常',
    is_summarized TINYINT DEFAULT 0 COMMENT '是否已汇总：0-未汇总，1-已汇总',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_user_meal_time (user_id, meal_time),
    INDEX idx_summarized (is_summarized, meal_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用餐记录表';
