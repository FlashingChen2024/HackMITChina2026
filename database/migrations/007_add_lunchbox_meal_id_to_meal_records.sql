-- 方案 A Step 1（可选）：Meal_Records 增加餐盒 meal_id 便于去重与追溯
-- 可重复执行：仅当列/索引不存在时添加

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Meal_Records' AND COLUMN_NAME = 'lunchbox_meal_id');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE Meal_Records ADD COLUMN lunchbox_meal_id VARCHAR(64) NULL COMMENT ''智能餐盒 meal_id，用于去重与追溯'' AFTER meal_time',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Meal_Records' AND INDEX_NAME = 'idx_lunchbox_meal_id');
SET @sql2 = IF(@idx_exists = 0,
  'CREATE INDEX idx_lunchbox_meal_id ON Meal_Records (lunchbox_meal_id)',
  'SELECT 1');
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;
