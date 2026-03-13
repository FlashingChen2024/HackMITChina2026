-- AI 分析报告表
-- 模块5 阶段三使用，提前建表便于迁移顺序

CREATE TABLE IF NOT EXISTS AI_Analysis_Reports (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL COMMENT '用户ID',
    report_date DATE NOT NULL COMMENT '报告日期',
    report_type TINYINT DEFAULT 1 COMMENT '报告类型：1-日报，2-周报，3-月报',

    analysis_result JSON COMMENT 'AI分析结果JSON',

    start_date DATE COMMENT '分析开始日期',
    end_date DATE COMMENT '分析结束日期',

    model_version VARCHAR(50) COMMENT '使用的AI模型版本',
    prompt_version VARCHAR(50) COMMENT '使用的Prompt版本',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_user_report (user_id, report_date),
    INDEX idx_report_type (report_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI分析报告表';
