-- 社区主表：创建社区后返回 community_id，供他人输入加入
CREATE TABLE IF NOT EXISTS Communities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  community_id VARCHAR(32) NOT NULL COMMENT '对外展示的社区ID',
  owner_user_id BIGINT UNSIGNED NOT NULL COMMENT '创建者用户ID',
  name VARCHAR(128) NOT NULL COMMENT '社区名称',
  description VARCHAR(255) NULL COMMENT '社区简介',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '1=正常 0=已解散',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_community_id (community_id),
  KEY idx_owner_user_id (owner_user_id),
  KEY idx_status_created_at (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='社区主表';

-- 社区成员表：用于加入社区、查看我加入的社区、管理成员
CREATE TABLE IF NOT EXISTS Community_Members (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  community_id VARCHAR(32) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  role ENUM('owner', 'member') NOT NULL DEFAULT 'member' COMMENT 'owner=创建者 member=普通成员',
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_community_user (community_id, user_id),
  KEY idx_user_id (user_id),
  KEY idx_community_id (community_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='社区成员关系表';
