package service

import (
	"context"
	"errors"
	"testing"

	"kxyz-backend/internal/model"

	"gorm.io/gorm"
)

type fakeCommunityStore struct {
	createCommunityArg model.Community
	createErr          error
	getCommunity       model.Community
	getErr             error
	memberCount        int64
	memberCountErr     error
	userCommunities    []model.UserCommunityWithMemberCount
	userCommunitiesErr error
	lastListUserID     string
	stats              []model.CommunityFoodAvgStat
	statsErr           error
	joinErr            error

	joinCalls       int
	joinCommunityID string
	joinUserID      string
}

func (f *fakeCommunityStore) CreateCommunity(_ context.Context, community model.Community) error {
	f.createCommunityArg = community
	return f.createErr
}

func (f *fakeCommunityStore) GetCommunityByID(_ context.Context, _ string) (model.Community, error) {
	if f.getErr != nil {
		return model.Community{}, f.getErr
	}
	return f.getCommunity, nil
}

func (f *fakeCommunityStore) JoinCommunity(_ context.Context, communityID string, userID string) error {
	f.joinCalls++
	f.joinCommunityID = communityID
	f.joinUserID = userID
	return f.joinErr
}

func (f *fakeCommunityStore) CountMembers(_ context.Context, _ string) (int64, error) {
	if f.memberCountErr != nil {
		return 0, f.memberCountErr
	}
	return f.memberCount, nil
}

func (f *fakeCommunityStore) ListUserCommunities(_ context.Context, userID string) ([]model.UserCommunityWithMemberCount, error) {
	f.lastListUserID = userID
	if f.userCommunitiesErr != nil {
		return nil, f.userCommunitiesErr
	}
	return f.userCommunities, nil
}

func (f *fakeCommunityStore) ListDashboardStats(_ context.Context, _ string) ([]model.CommunityFoodAvgStat, error) {
	if f.statsErr != nil {
		return nil, f.statsErr
	}
	return f.stats, nil
}

func TestCommunityServiceCreateCommunity(t *testing.T) {
	store := &fakeCommunityStore{}
	svc := NewCommunityService(store)

	community, err := svc.CreateCommunity(context.Background(), " user-1 ", " MIT 黑客松 ", " 健康营 ")
	if err != nil {
		t.Fatalf("create community failed: %v", err)
	}

	if community.CommunityID == "" {
		t.Fatalf("expected generated community_id")
	}
	if store.createCommunityArg.Name != "MIT 黑客松" {
		t.Fatalf("expected trimmed community name, got %q", store.createCommunityArg.Name)
	}
	if store.createCommunityArg.Description != "健康营" {
		t.Fatalf("expected trimmed description, got %q", store.createCommunityArg.Description)
	}
	if store.joinCalls != 1 {
		t.Fatalf("expected creator to auto join community")
	}
	if store.joinCommunityID != community.CommunityID {
		t.Fatalf("expected join with created community_id")
	}
	if store.joinUserID != "user-1" {
		t.Fatalf("expected join user user-1, got %s", store.joinUserID)
	}
}

func TestCommunityServiceJoinCommunityRequiresExistingCommunity(t *testing.T) {
	store := &fakeCommunityStore{getErr: gorm.ErrRecordNotFound}
	svc := NewCommunityService(store)

	err := svc.JoinCommunity(context.Background(), "community-1", "user-1")
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("expected gorm.ErrRecordNotFound, got %v", err)
	}
}

func TestCommunityServiceGetDashboard(t *testing.T) {
	store := &fakeCommunityStore{
		getCommunity: model.Community{
			CommunityID: "community-1",
			Name:        "MIT 黑客松健康营",
		},
		memberCount: 3,
		stats: []model.CommunityFoodAvgStat{
			{
				FoodName:        "西红柿炒鸡蛋",
				AvgServedG:      180.5,
				AvgLeftoverG:    30,
				AvgIntakeG:      150.5,
				AvgSpeedGPerMin: 12.5,
			},
		},
	}
	svc := NewCommunityService(store)

	dashboard, err := svc.GetDashboard(context.Background(), "community-1")
	if err != nil {
		t.Fatalf("get dashboard failed: %v", err)
	}

	if dashboard.CommunityID != "community-1" {
		t.Fatalf("expected community_id=community-1, got %s", dashboard.CommunityID)
	}
	if dashboard.CommunityName != "MIT 黑客松健康营" {
		t.Fatalf("expected community_name=MIT 黑客松健康营, got %s", dashboard.CommunityName)
	}
	if dashboard.MemberCount != 3 {
		t.Fatalf("expected member_count=3, got %d", dashboard.MemberCount)
	}
	if len(dashboard.FoodAvgStats) != 1 || dashboard.FoodAvgStats[0].FoodName != "西红柿炒鸡蛋" {
		t.Fatalf("expected one food stats row")
	}
}

func TestCommunityServiceCreateCommunityRejectsEmptyName(t *testing.T) {
	store := &fakeCommunityStore{}
	svc := NewCommunityService(store)

	_, err := svc.CreateCommunity(context.Background(), "user-1", " ", "demo")
	if err != ErrInvalidInput {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
}

func TestCommunityServiceListUserCommunities(t *testing.T) {
	store := &fakeCommunityStore{
		userCommunities: []model.UserCommunityWithMemberCount{
			{
				CommunityID: "community-1",
				Name:        "减脂圈",
				Description: "少油少盐",
				MemberCount: 2,
			},
			{
				CommunityID: "community-2",
				Name:        "增肌圈",
				Description: "高蛋白",
				MemberCount: 3,
			},
		},
	}
	svc := NewCommunityService(store)

	items, err := svc.ListUserCommunities(context.Background(), " user-b ")
	if err != nil {
		t.Fatalf("list user communities failed: %v", err)
	}

	if store.lastListUserID != "user-b" {
		t.Fatalf("expected trimmed user_id user-b, got %s", store.lastListUserID)
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 communities, got %d", len(items))
	}
	if items[0].CommunityID != "community-1" || items[0].MemberCount != 2 {
		t.Fatalf("unexpected first community item: %+v", items[0])
	}
}
