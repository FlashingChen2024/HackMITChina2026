package store

import (
	"context"
	"fmt"
	"time"

	"kxyz-backend/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type GormCommunityStore struct {
	db *gorm.DB
}

func NewGormCommunityStore(db *gorm.DB) *GormCommunityStore {
	return &GormCommunityStore{db: db}
}

func (s *GormCommunityStore) CreateCommunity(ctx context.Context, community model.Community) error {
	if err := s.db.WithContext(ctx).Create(&community).Error; err != nil {
		return fmt.Errorf("create community: %w", err)
	}
	return nil
}

func (s *GormCommunityStore) GetCommunityByID(ctx context.Context, communityID string) (model.Community, error) {
	var community model.Community
	if err := s.db.WithContext(ctx).
		Model(&model.Community{}).
		Where("community_id = ?", communityID).
		First(&community).Error; err != nil {
		return model.Community{}, fmt.Errorf("get community by id: %w", err)
	}
	return community, nil
}

func (s *GormCommunityStore) JoinCommunity(ctx context.Context, communityID string, userID string) error {
	now := time.Now().UTC()
	member := model.CommunityMember{
		CommunityID: communityID,
		UserID:      userID,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns: []clause.Column{
				{Name: "community_id"},
				{Name: "user_id"},
			},
			DoUpdates: clause.Assignments(map[string]any{
				"updated_at": now,
			}),
		}).
		Create(&member).Error; err != nil {
		return fmt.Errorf("join community: %w", err)
	}
	return nil
}

func (s *GormCommunityStore) CountMembers(ctx context.Context, communityID string) (int64, error) {
	var count int64
	if err := s.db.WithContext(ctx).
		Model(&model.CommunityMember{}).
		Where("community_id = ?", communityID).
		Count(&count).Error; err != nil {
		return 0, fmt.Errorf("count community members: %w", err)
	}
	return count, nil
}

func (s *GormCommunityStore) ListUserCommunities(
	ctx context.Context,
	userID string,
) ([]model.UserCommunityWithMemberCount, error) {
	var items []model.UserCommunityWithMemberCount

	if err := s.db.WithContext(ctx).
		Table("communities AS c").
		Select(`
			c.community_id AS community_id,
			c.name AS name,
			c.description AS description,
			COUNT(all_uc.user_id) AS member_count
		`).
		Joins("INNER JOIN user_communities AS mine_uc ON mine_uc.community_id = c.community_id AND mine_uc.user_id = ?", userID).
		Joins("LEFT JOIN user_communities AS all_uc ON all_uc.community_id = c.community_id").
		Group("c.community_id, c.name, c.description, c.created_at").
		Order("c.created_at DESC").
		Scan(&items).Error; err != nil {
		return nil, fmt.Errorf("list user communities: %w", err)
	}

	return items, nil
}

func (s *GormCommunityStore) ListDashboardStats(
	ctx context.Context,
	communityID string,
) ([]model.CommunityFoodAvgStat, error) {
	var stats []model.CommunityFoodAvgStat

	if err := s.db.WithContext(ctx).
		Table("meal_grids AS mg").
		Select(`
			mg.food_name AS food_name,
			AVG(mg.served_g) AS avg_served_g,
			AVG(mg.leftover_g) AS avg_leftover_g,
			AVG(mg.intake_g) AS avg_intake_g,
			AVG(CASE WHEN m.duration_minutes > 0 THEN mg.intake_g * 1.0 / m.duration_minutes ELSE 0 END) AS avg_speed_g_per_min
		`).
		Joins("INNER JOIN meals AS m ON m.meal_id = mg.meal_id").
		Joins("INNER JOIN user_communities AS cm ON cm.user_id = m.user_id").
		Where("cm.community_id = ? AND mg.food_name <> ''", communityID).
		Group("mg.food_name").
		Order("mg.food_name ASC").
		Scan(&stats).Error; err != nil {
		return nil, fmt.Errorf("list community dashboard stats: %w", err)
	}

	return stats, nil
}
