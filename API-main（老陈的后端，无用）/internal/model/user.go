package model

import "time"

type User struct {
	ID           string    `gorm:"column:id;type:char(36);primaryKey"`
	Username     string    `gorm:"column:username;type:varchar(64);not null;uniqueIndex:uk_users_username"`
	PasswordHash string    `gorm:"column:password_hash;type:varchar(255);not null"`
	CreatedAt    time.Time `gorm:"column:created_at;not null"`
}

func (User) TableName() string {
	return "users"
}
