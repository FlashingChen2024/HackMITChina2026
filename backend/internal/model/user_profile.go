package model

import "time"

type UserProfile struct {
	UserID    string    `gorm:"column:user_id;type:char(36);primaryKey"`
	HeightCM  int       `gorm:"column:height_cm;not null"`
	WeightKG  float64   `gorm:"column:weight_kg;not null"`
	Gender    string    `gorm:"column:gender;type:varchar(16);not null;default:''"`
	Age       int       `gorm:"column:age;not null"`
	CreatedAt time.Time `gorm:"column:created_at;not null"`
	UpdatedAt time.Time `gorm:"column:updated_at;not null"`
}

func (UserProfile) TableName() string {
	return "user_profiles"
}
