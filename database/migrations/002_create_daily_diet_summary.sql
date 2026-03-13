-- 日饮食统计汇总表
-- 模块5 执行清单 5-1-1：Daily_Diet_Summary 表

CREATE TABLE IF NOT EXISTS Daily_Diet_Summary (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL COMMENT '用户ID',
    date DATE NOT NULL COMMENT '日期',

    total_initial_weight DECIMAL(10,2) DEFAULT 0 COMMENT '总打饭量(g)',
    total_remaining_weight DECIMAL(10,2) DEFAULT 0 COMMENT '总剩余量(g)',
    total_intake_weight DECIMAL(10,2) DEFAULT 0 COMMENT '总摄入量(g)',
    total_calories DECIMAL(10,2) DEFAULT 0 COMMENT '总卡路里(kcal)',
    avg_eating_speed DECIMAL(10,2) DEFAULT 0 COMMENT '平均用餐速度(g/min)',

    meal_count INT DEFAULT 0 COMMENT '用餐次数',
    fastest_meal_duration INT COMMENT '最快用餐时长(秒)',
    slowest_meal_duration INT COMMENT '最慢用餐时长(秒)',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uk_user_date (user_id, date),
    INDEX idx_user_id (user_id),
    INDEX idx_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='日饮食统计汇总表';
