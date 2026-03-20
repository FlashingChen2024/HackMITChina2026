package model

import "time"

type Community struct {
	CommunityID string    `gorm:"column:community_id;type:char(36);primaryKey"`
	Name        string    `gorm:"column:name;type:varchar(128);not null"`
	Description string    `gorm:"column:description;type:varchar(512);not null;default:''"`
	CreatedBy   string    `gorm:"column:created_by;type:char(36);not null;index:idx_communities_created_by"`
	CreatedAt   time.Time `gorm:"column:created_at;not null"`
	UpdatedAt   time.Time `gorm:"column:updated_at;not null"`
}

func (Community) TableName() string {
	return "communities"
}

type CommunityMember struct {
	ID          uint64    `gorm:"column:id;primaryKey;autoIncrement"`
	CommunityID string    `gorm:"column:community_id;type:char(36);not null;index:idx_user_communities_community_id;uniqueIndex:uk_user_communities,priority:1"`
	UserID      string    `gorm:"column:user_id;type:char(36);not null;index:idx_user_communities_user_id;uniqueIndex:uk_user_communities,priority:2"`
	CreatedAt   time.Time `gorm:"column:created_at;not null"`
	UpdatedAt   time.Time `gorm:"column:updated_at;not null"`
}

func (CommunityMember) TableName() string {
	return "user_communities"
}

type CommunityFoodAvgStat struct {
	FoodName        string  `gorm:"column:food_name"`
	AvgServedG      float64 `gorm:"column:avg_served_g"`
	AvgLeftoverG    float64 `gorm:"column:avg_leftover_g"`
	AvgIntakeG      float64 `gorm:"column:avg_intake_g"`
	AvgSpeedGPerMin float64 `gorm:"column:avg_speed_g_per_min"`
}

type UserCommunityWithMemberCount struct {
	CommunityID string `gorm:"column:community_id"`
	Name        string `gorm:"column:name"`
	Description string `gorm:"column:description"`
	MemberCount int64  `gorm:"column:member_count"`
}
