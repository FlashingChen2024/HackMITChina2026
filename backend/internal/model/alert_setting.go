package model

import "time"

type AlertSetting struct {
	UserID    string    `gorm:"column:user_id;type:char(36);primaryKey"`
	Email     string    `gorm:"column:email;type:varchar(255);not null;default:''"`
	Enabled   bool      `gorm:"column:enabled;not null;default:false"`
	CreatedAt time.Time `gorm:"column:created_at;not null"`
	UpdatedAt time.Time `gorm:"column:updated_at;not null"`
}

func (AlertSetting) TableName() string {
	return "alert_settings"
}
