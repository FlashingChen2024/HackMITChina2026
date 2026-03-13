-- 方案 A Step 1（可选）：Meal_Records 增加餐盒 meal_id 便于去重与追溯
-- 若表已存在多列，ALTER 会安全添加新列

ALTER TABLE Meal_Records
ADD COLUMN lunchbox_meal_id VARCHAR(64) NULL COMMENT '智能餐盒 meal_id，用于去重与追溯' AFTER meal_time;

CREATE INDEX idx_lunchbox_meal_id ON Meal_Records (lunchbox_meal_id);
