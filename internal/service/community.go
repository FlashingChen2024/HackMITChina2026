package service

import (
	"context"
	"strings"
	"time"

	"kxyz-backend/internal/model"
)

type CommunityStore interface {
	CreateCommunity(ctx context.Context, community model.Community) error
	GetCommunityByID(ctx context.Context, communityID string) (model.Community, error)
	JoinCommunity(ctx context.Context, communityID string, userID string) error
	CountMembers(ctx context.Context, communityID string) (int64, error)
	ListUserCommunities(ctx context.Context, userID string) ([]model.UserCommunityWithMemberCount, error)
	ListDashboardStats(ctx context.Context, communityID string) ([]model.CommunityFoodAvgStat, error)
}

type CommunityDashboard struct {
	CommunityID   string
	CommunityName string
	MemberCount   int64
	FoodAvgStats  []model.CommunityFoodAvgStat
}

type UserCommunity struct {
	CommunityID string
	Name        string
	Description string
	MemberCount int64
}

type CommunityService struct {
	store CommunityStore
}

func NewCommunityService(store CommunityStore) *CommunityService {
	return &CommunityService{store: store}
}

func (s *CommunityService) CreateCommunity(
	ctx context.Context,
	userID string,
	name string,
	description string,
) (model.Community, error) {
	userID = strings.TrimSpace(userID)
	name = strings.TrimSpace(name)
	description = strings.TrimSpace(description)
	if userID == "" || name == "" {
		return model.Community{}, ErrInvalidInput
	}

	communityID, err := newUUID()
	if err != nil {
		return model.Community{}, err
	}

	now := time.Now().UTC()
	community := model.Community{
		CommunityID: communityID,
		Name:        name,
		Description: description,
		CreatedBy:   userID,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.store.CreateCommunity(ctx, community); err != nil {
		return model.Community{}, err
	}
	if err := s.store.JoinCommunity(ctx, community.CommunityID, userID); err != nil {
		return model.Community{}, err
	}

	return community, nil
}

func (s *CommunityService) JoinCommunity(ctx context.Context, communityID string, userID string) error {
	communityID = strings.TrimSpace(communityID)
	userID = strings.TrimSpace(userID)
	if communityID == "" || userID == "" {
		return ErrInvalidInput
	}

	if _, err := s.store.GetCommunityByID(ctx, communityID); err != nil {
		return err
	}

	if err := s.store.JoinCommunity(ctx, communityID, userID); err != nil {
		return err
	}
	return nil
}

func (s *CommunityService) GetDashboard(ctx context.Context, communityID string) (CommunityDashboard, error) {
	communityID = strings.TrimSpace(communityID)
	if communityID == "" {
		return CommunityDashboard{}, ErrInvalidInput
	}

	community, err := s.store.GetCommunityByID(ctx, communityID)
	if err != nil {
		return CommunityDashboard{}, err
	}

	memberCount, err := s.store.CountMembers(ctx, communityID)
	if err != nil {
		return CommunityDashboard{}, err
	}

	stats, err := s.store.ListDashboardStats(ctx, communityID)
	if err != nil {
		return CommunityDashboard{}, err
	}

	return CommunityDashboard{
		CommunityID:   community.CommunityID,
		CommunityName: community.Name,
		MemberCount:   memberCount,
		FoodAvgStats:  stats,
	}, nil
}

func (s *CommunityService) ListUserCommunities(ctx context.Context, userID string) ([]UserCommunity, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return nil, ErrInvalidInput
	}

	items, err := s.store.ListUserCommunities(ctx, userID)
	if err != nil {
		return nil, err
	}

	result := make([]UserCommunity, 0, len(items))
	for _, item := range items {
		result = append(result, UserCommunity{
			CommunityID: item.CommunityID,
			Name:        item.Name,
			Description: item.Description,
			MemberCount: item.MemberCount,
		})
	}

	return result, nil
}
