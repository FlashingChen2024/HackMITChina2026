package model

import "time"

type Meal struct {
	MealID          string    `gorm:"column:meal_id;type:char(36);primaryKey"`
	UserID          string    `gorm:"column:user_id;type:varchar(64);not null;default:''"`
	StartTime       time.Time `gorm:"column:start_time;not null"`
	DurationMinutes int       `gorm:"column:duration_minutes;not null;default:0"`
	TotalServedG    int       `gorm:"column:total_served_g;not null;default:0"`
	TotalLeftoverG  int       `gorm:"column:total_leftover_g;not null;default:0"`
	CreatedAt       time.Time `gorm:"column:created_at;not null"`
	UpdatedAt       time.Time `gorm:"column:updated_at;not null"`
}

func (Meal) TableName() string {
	return "meals"
}

type MealCurveData struct {
	ID        uint64    `gorm:"column:id;primaryKey;autoIncrement"`
	MealID    string    `gorm:"column:meal_id;type:char(36);not null;index:idx_meal_time,priority:1"`
	Timestamp time.Time `gorm:"column:timestamp;not null;index:idx_meal_time,priority:2"`
	WeightG   int       `gorm:"column:weight_g;not null"`
	CreatedAt time.Time `gorm:"column:created_at;not null"`
}

func (MealCurveData) TableName() string {
	return "meal_curve_data"
}
