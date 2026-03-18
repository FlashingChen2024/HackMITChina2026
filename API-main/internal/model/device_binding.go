package model

import "time"

type DeviceBinding struct {
	DeviceID  string    `gorm:"column:device_id;type:varchar(64);primaryKey"`
	UserID    string    `gorm:"column:user_id;type:char(36);not null;index:idx_device_bindings_user_id"`
	CreatedAt time.Time `gorm:"column:created_at;not null"`
	UpdatedAt time.Time `gorm:"column:updated_at;not null"`
}

func (DeviceBinding) TableName() string {
	return "device_bindings"
}
