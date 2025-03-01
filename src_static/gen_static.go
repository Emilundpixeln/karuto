package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"

	_ "github.com/mattn/go-sqlite3"
)

type ItemGradeOption struct {
	PrimaryKey   int `json:"PrimaryKey"`
	AddonType00  int `json:"AddonType00"`
	AddonStat00  int `json:"AddonStat00"`
	AddonValue00 int `json:"AddonValue00"`
}

type Item struct {
	PrimaryKey      int `json:"PrimaryKey"`
	StaticOptionId0 int `json:"StaticOptionId0"`
}

func skins(items []Item, itemGradeOptions []ItemGradeOption) {
	var effects []ItemGradeOption
	for _, o := range itemGradeOptions {
		if o.AddonType00 == 2 && (o.AddonStat00 == 7 || o.AddonStat00 == 8 || o.AddonStat00 == 9) {
			effects = append(effects, o)
		}
	}

	var skins []map[string]interface{}

	for _, i := range items {
		for _, e := range effects {
			if i.StaticOptionId0 == e.PrimaryKey {
				skin := map[string]interface{}{
					"id":                 i.PrimaryKey,
					"main_stat_increase": e.AddonValue00,
				}
				skins = append(skins, skin)
			}
		}
	}

	// Generating the output file
	outputFile := "src/client/zloa/static_skins.ts"
	skinsJSON, err := json.Marshal(skins)
	if err != nil {
		log.Fatalf("Error marshalling skins to JSON: %v", err)
	}

	// Writing the data to the output file
	content := fmt.Sprintf("/* eslint-disable */\n/* Auto Generated */\nexport const skins = %s;", string(skinsJSON))
	err = ioutil.WriteFile(outputFile, []byte(content), 0644)
	if err != nil {
		log.Fatalf("Error writing to output file: %v", err)
	}

	fmt.Println("Static skins have been successfully written to", outputFile)
}

func getTableNames(db *sql.DB) ([]string, error) {
	rows, err := db.Query("SELECT name FROM sqlite_master WHERE type='table'")
	if err != nil {
		return nil, fmt.Errorf("error querying sqlite_master: %v", err)
	}
	defer rows.Close()

	var tableNames []string
	for rows.Next() {
		var tableName string
		err = rows.Scan(&tableName)
		if err != nil {
			return nil, fmt.Errorf("error scanning row: %v", err)
		}
		tableNames = append(tableNames, tableName)
	}

	// Check for any error that occurred during row iteration
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating rows: %v", err)
	}

	return tableNames, nil
}

func loadFromSQLite(dbName string, tableName string, dest interface{}) error {
	db, err := sql.Open("sqlite3", dbName)
	if err != nil {
		return err
	}
	defer db.Close()

	if tableName == "" {
		names, err := getTableNames(db)
		if err != nil {
			return err
		}
		if len(names) != 1 {
			return fmt.Errorf("invalid length of names: %v", names)
		}
		tableName = names[0]
	}

	// Create the SELECT statement
	query := fmt.Sprintf("SELECT * FROM %s", tableName)
	rows, err := db.Query(query)
	if err != nil {
		return fmt.Errorf("error executing query: %v", err)
	}
	defer rows.Close()

	// Get columns
	columns, err := rows.Columns()
	if err != nil {
		return fmt.Errorf("error getting columns: %v", err)
	}

	// Create a slice of maps to hold the row data
	values := make([]interface{}, len(columns))
	for i := range values {
		values[i] = new(interface{})
	}

	// Loop through rows and map data to the destination slice
	var data []map[string]interface{}
	for rows.Next() {
		err = rows.Scan(values...)
		if err != nil {
			return fmt.Errorf("error scanning row: %v", err)
		}

		row := make(map[string]interface{})
		for i, colName := range columns {
			val := *(values[i].(*interface{}))
			row[colName] = val
		}
		data = append(data, row)
	}

	// Convert to JSON
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("error marshaling data to JSON: %v", err)
	}

	// Unmarshal JSON into the destination slice of structs
	err = json.Unmarshal(jsonData, dest)
	if err != nil {
		return fmt.Errorf("error unmarshaling JSON into struct: %v", err)
	}

	return nil
}

func main() {
	src := "C:/Users/Emil_2/Source/Repos/LostArkDumper/LoaDumper/out/root/EFGame_Extra/ClientData/TableData/"

	var itemGradeOptions []ItemGradeOption
	err := loadFromSQLite(src+"EFTable_ItemGradeOptionStatic.db", "", &itemGradeOptions)
	if err != nil {
		log.Fatalf("Error ItemGradeOptionStatic: %v", err)
	}

	var items []Item
	err = loadFromSQLite(src+"EFTable_Item.db", "", &items)
	if err != nil {
		log.Fatalf("Error Item: %v", err)
	}
	println("len items", len(items))
	skins(items, itemGradeOptions)
}
