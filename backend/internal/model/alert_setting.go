package model

import (
	"time"

	"gorm.io/datatypes"
)

type AlertSetting struct {
	UserID        string         `gorm:"column:user_id;type:char(36);primaryKey"`
	Email         string         `gorm:"column:email;type:varchar(255);not null;default:''"`
	GlobalEnabled bool           `gorm:"column:global_enabled;not null;default:false"`
	RulesJSON     datatypes.JSON `gorm:"column:rules_json;type:json;not null"`
	CreatedAt     time.Time      `gorm:"column:created_at;not null"`
	UpdatedAt     time.Time      `gorm:"column:updated_at;not null"`
}

func (AlertSetting) TableName() string {
	return "alert_settings"
}
