package model

import "time"

type Meal struct {
	MealID          string    `gorm:"column:meal_id;type:char(36);primaryKey"`
	UserID          string    `gorm:"column:user_id;type:varchar(64);not null;default:''"`
	StartTime       time.Time `gorm:"column:start_time;not null"`
	DurationMinutes int       `gorm:"column:duration_minutes;not null;default:0"`
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
	Grid1G    int       `gorm:"column:grid_1_g;not null;default:0"`
	Grid2G    int       `gorm:"column:grid_2_g;not null;default:0"`
	Grid3G    int       `gorm:"column:grid_3_g;not null;default:0"`
	Grid4G    int       `gorm:"column:grid_4_g;not null;default:0"`
	CreatedAt time.Time `gorm:"column:created_at;not null"`
}

func (MealCurveData) TableName() string {
	return "meal_curve_data"
}

type MealGrid struct {
	ID             uint64    `gorm:"column:id;primaryKey;autoIncrement"`
	MealID         string    `gorm:"column:meal_id;type:char(36);not null;index:idx_meal_grid,priority:1;uniqueIndex:uk_meal_grid"`
	GridIndex      int       `gorm:"column:grid_index;not null;index:idx_meal_grid,priority:2;uniqueIndex:uk_meal_grid"`
	FoodName       string    `gorm:"column:food_name;type:varchar(255);not null;default:''"`
	UnitCalPer100G float64   `gorm:"column:unit_cal_per_100g;not null;default:0"`
	ServedG        int       `gorm:"column:served_g;not null;default:0"`
	LeftoverG      int       `gorm:"column:leftover_g;not null;default:0"`
	IntakeG        int       `gorm:"column:intake_g;not null;default:0"`
	TotalCal       float64   `gorm:"column:total_cal;not null;default:0"`
	CreatedAt      time.Time `gorm:"column:created_at;not null"`
	UpdatedAt      time.Time `gorm:"column:updated_at;not null"`
}

func (MealGrid) TableName() string {
	return "meal_grids"
}

type DailyStatisticsRow struct {
	Date            string  `gorm:"column:date"`
	DailyServedG    float64 `gorm:"column:daily_served_g"`
	DailyIntakeG    float64 `gorm:"column:daily_intake_g"`
	DailyCalories   float64 `gorm:"column:daily_calories"`
	AvgSpeedGPerMin float64 `gorm:"column:avg_speed_g_per_min"`
}
