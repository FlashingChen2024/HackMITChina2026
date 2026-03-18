package store

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	gormmysql "gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func newMealQueryMockDB(t *testing.T) (*gorm.DB, sqlmock.Sqlmock, func()) {
	t.Helper()

	sqlDB, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	if err != nil {
		t.Fatalf("create sql mock: %v", err)
	}

	db, err := gorm.Open(gormmysql.New(gormmysql.Config{
		Conn:                      sqlDB,
		SkipInitializeWithVersion: true,
	}), &gorm.Config{})
	if err != nil {
		t.Fatalf("open gorm db: %v", err)
	}

	cleanup := func() {
		_ = sqlDB.Close()
	}
	return db, mock, cleanup
}

func TestGormMealQueryStoreAggregateDailyStatistics(t *testing.T) {
	db, mock, cleanup := newMealQueryMockDB(t)
	defer cleanup()

	queryPattern := `SELECT .* FROM \(SELECT DATE\(m\.start_time\) AS stat_date.*FROM meals AS m JOIN meal_grids AS mg ON mg\.meal_id = m\.meal_id WHERE m\.user_id = \? AND \(DATE\(m\.start_time\) >= \? AND DATE\(m\.start_time\) <= \?\).*GROUP BY DATE\(m\.start_time\), m\.meal_id, m\.duration_minutes\) AS meal_daily.*`
	rows := sqlmock.NewRows([]string{
		"date",
		"daily_served_g",
		"daily_intake_g",
		"daily_calories",
		"avg_speed_g_per_min",
	}).
		AddRow("2026-03-01", 600.0, 500.0, 750.5, 15.2).
		AddRow("2026-03-02", 550.0, 450.0, 620.0, 14.0)

	mock.ExpectQuery(queryPattern).
		WithArgs("user-1", "2026-03-01", "2026-03-02").
		WillReturnRows(rows)

	store := NewGormMealQueryStore(db)
	got, err := store.AggregateDailyStatistics(
		context.Background(),
		"user-1",
		time.Date(2026, 3, 1, 8, 30, 0, 0, time.FixedZone("UTC+8", 8*3600)),
		time.Date(2026, 3, 2, 23, 59, 0, 0, time.UTC),
	)
	if err != nil {
		t.Fatalf("aggregate daily statistics: %v", err)
	}

	if len(got) != 2 {
		t.Fatalf("expected 2 rows, got %d", len(got))
	}
	if got[0].Date != "2026-03-01" {
		t.Fatalf("expected first row date 2026-03-01, got %s", got[0].Date)
	}
	if got[0].DailyServedG != 600.0 || got[0].DailyIntakeG != 500.0 || got[0].DailyCalories != 750.5 || got[0].AvgSpeedGPerMin != 15.2 {
		t.Fatalf("unexpected first row values: %+v", got[0])
	}
	if got[1].Date != "2026-03-02" || got[1].DailyServedG != 550.0 || got[1].DailyIntakeG != 450.0 || got[1].DailyCalories != 620.0 || got[1].AvgSpeedGPerMin != 14.0 {
		t.Fatalf("unexpected second row values: %+v", got[1])
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}

func TestGormMealQueryStoreAggregateDailyStatisticsRejectsInvalidDateRange(t *testing.T) {
	db, mock, cleanup := newMealQueryMockDB(t)
	defer cleanup()

	store := NewGormMealQueryStore(db)
	_, err := store.AggregateDailyStatistics(
		context.Background(),
		"user-1",
		time.Date(2026, 3, 3, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC),
	)
	if err == nil {
		t.Fatal("expected error for invalid date range")
	}
	if !strings.Contains(err.Error(), "end_date before start_date") {
		t.Fatalf("expected end_date before start_date error, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected sql calls: %v", err)
	}
}

func TestGormMealQueryStoreAggregateDailyStatisticsWrapsQueryError(t *testing.T) {
	db, mock, cleanup := newMealQueryMockDB(t)
	defer cleanup()

	queryPattern := `SELECT .* FROM \(SELECT DATE\(m\.start_time\) AS stat_date.*FROM meals AS m JOIN meal_grids AS mg ON mg\.meal_id = m\.meal_id WHERE m\.user_id = \? AND \(DATE\(m\.start_time\) >= \? AND DATE\(m\.start_time\) <= \?\).*GROUP BY DATE\(m\.start_time\), m\.meal_id, m\.duration_minutes\) AS meal_daily.*`
	mock.ExpectQuery(queryPattern).
		WithArgs("user-1", "2026-03-01", "2026-03-02").
		WillReturnError(errors.New("db unavailable"))

	store := NewGormMealQueryStore(db)
	_, err := store.AggregateDailyStatistics(
		context.Background(),
		"user-1",
		time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 3, 2, 0, 0, 0, 0, time.UTC),
	)
	if err == nil {
		t.Fatal("expected query error")
	}
	if !strings.Contains(err.Error(), "aggregate daily statistics") || !strings.Contains(err.Error(), "db unavailable") {
		t.Fatalf("expected wrapped query error, got %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}
