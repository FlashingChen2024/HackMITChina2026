package main

import (
	"database/sql"
	"fmt"
	"os"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

func main() {
	if len(os.Args) != 3 {
		panic("usage: seed_ai_advice_data <mysql_dsn> <user_id>")
	}

	dsn := os.Args[1]
	userID := os.Args[2]

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		panic(err)
	}
	defer db.Close()

	mealID := fmt.Sprintf("meal-m2-%d", time.Now().UTC().UnixNano())
	now := time.Now().UTC()

	_, err = db.Exec(
		"INSERT INTO meals (meal_id, user_id, start_time, duration_minutes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
		mealID,
		userID,
		now.Add(-30*time.Minute),
		20,
		now,
		now,
	)
	if err != nil {
		panic(err)
	}

	type gridSeed struct {
		index     int
		foodName  string
		intakeG   int
		totalCal  float64
		servedG   int
		leftoverG int
	}
	seeds := []gridSeed{
		{index: 1, foodName: "沙拉", intakeG: 120, totalCal: 120, servedG: 150, leftoverG: 30},
		{index: 2, foodName: "鸡胸肉", intakeG: 100, totalCal: 165, servedG: 120, leftoverG: 20},
		{index: 3, foodName: "糙米饭", intakeG: 80, totalCal: 104, servedG: 90, leftoverG: 10},
		{index: 4, foodName: "西兰花", intakeG: 70, totalCal: 25, servedG: 85, leftoverG: 15},
	}

	for _, seed := range seeds {
		_, err = db.Exec(
			`INSERT INTO meal_grids
			(meal_id, grid_index, food_name, unit_cal_per_100g, served_g, leftover_g, intake_g, total_cal, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			mealID,
			seed.index,
			seed.foodName,
			100.0,
			seed.servedG,
			seed.leftoverG,
			seed.intakeG,
			seed.totalCal,
			now,
			now,
		)
		if err != nil {
			panic(err)
		}
	}

	fmt.Printf("seeded meal_id=%s", mealID)
}
