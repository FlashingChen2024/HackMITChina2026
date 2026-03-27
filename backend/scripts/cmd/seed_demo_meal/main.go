package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

type mealGridSeed struct {
	Index     int
	FoodName  string
	IntakeG   int
	TotalCal  float64
	ServedG   int
	LeftoverG int
}

func main() {
	if len(os.Args) != 4 {
		panic("usage: seed_demo_meal <mysql_dsn> <user_id> <scenario:A|B>")
	}

	dsn := strings.TrimSpace(os.Args[1])
	userID := strings.TrimSpace(os.Args[2])
	scenario := strings.ToUpper(strings.TrimSpace(os.Args[3]))
	if dsn == "" || userID == "" {
		panic("mysql_dsn and user_id are required")
	}

	grids, err := demoGridsByScenario(scenario)
	if err != nil {
		panic(err)
	}

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		panic(err)
	}
	defer db.Close()

	mealID := fmt.Sprintf("meal-demo-%s-%d", strings.ToLower(scenario), time.Now().UTC().UnixNano())
	now := time.Now().UTC()
	startTime := now.Add(-25 * time.Minute)

	_, err = db.Exec(
		"INSERT INTO meals (meal_id, user_id, start_time, duration_minutes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
		mealID,
		userID,
		startTime,
		20,
		now,
		now,
	)
	if err != nil {
		panic(err)
	}

	totalCalories := 0.0
	for _, grid := range grids {
		totalCalories += grid.TotalCal
		_, err = db.Exec(
			`INSERT INTO meal_grids
			(meal_id, grid_index, food_name, unit_cal_per_100g, served_g, leftover_g, intake_g, total_cal, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			mealID,
			grid.Index,
			grid.FoodName,
			100.0,
			grid.ServedG,
			grid.LeftoverG,
			grid.IntakeG,
			grid.TotalCal,
			now,
			now,
		)
		if err != nil {
			panic(err)
		}
	}

	out := map[string]any{
		"scenario":      scenario,
		"meal_id":       mealID,
		"total_kcal":    totalCalories,
		"user_id":       userID,
		"seeded_at_utc": now.Format(time.RFC3339),
	}
	encoded, _ := json.Marshal(out)
	fmt.Print(string(encoded))
}

func demoGridsByScenario(scenario string) ([]mealGridSeed, error) {
	switch scenario {
	case "A":
		return []mealGridSeed{
			{Index: 1, FoodName: "沙拉", IntakeG: 140, TotalCal: 110, ServedG: 160, LeftoverG: 20},
			{Index: 2, FoodName: "鸡胸肉", IntakeG: 90, TotalCal: 150, ServedG: 110, LeftoverG: 20},
			{Index: 3, FoodName: "玉米", IntakeG: 70, TotalCal: 40, ServedG: 80, LeftoverG: 10},
		}, nil
	case "B":
		return []mealGridSeed{
			{Index: 1, FoodName: "炸鸡", IntakeG: 180, TotalCal: 450, ServedG: 200, LeftoverG: 20},
			{Index: 2, FoodName: "薯条", IntakeG: 140, TotalCal: 350, ServedG: 160, LeftoverG: 20},
			{Index: 3, FoodName: "可乐", IntakeG: 300, TotalCal: 120, ServedG: 330, LeftoverG: 30},
			{Index: 4, FoodName: "蘸酱", IntakeG: 60, TotalCal: 80, ServedG: 70, LeftoverG: 10},
		}, nil
	default:
		return nil, fmt.Errorf("unsupported scenario: %s", scenario)
	}
}
