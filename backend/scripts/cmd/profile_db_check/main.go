package main

import (
	"database/sql"
	"fmt"
	"os"

	_ "github.com/go-sql-driver/mysql"
)

func main() {
	if len(os.Args) != 3 {
		panic("usage: profile_db_check <mysql_dsn> <user_id>")
	}

	db, err := sql.Open("mysql", os.Args[1])
	if err != nil {
		panic(err)
	}
	defer db.Close()

	userID := os.Args[2]

	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM user_profiles WHERE user_id = ?", userID).Scan(&count); err != nil {
		panic(err)
	}

	var height int
	var weight float64
	var gender string
	var age int
	if err := db.QueryRow(
		"SELECT height_cm, weight_kg, gender, age FROM user_profiles WHERE user_id = ?",
		userID,
	).Scan(&height, &weight, &gender, &age); err != nil {
		panic(err)
	}

	fmt.Printf("%d|%d|%.1f|%s|%d", count, height, weight, gender, age)
}
