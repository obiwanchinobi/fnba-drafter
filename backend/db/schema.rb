# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_09_22_150000) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "player_projections", force: :cascade do |t|
    t.decimal "ast"
    t.decimal "blk"
    t.datetime "created_at", null: false
    t.decimal "dd"
    t.decimal "dreb"
    t.integer "espn_roto_rank"
    t.text "estimated_stat_keys", default: [], null: false, array: true
    t.decimal "fga"
    t.decimal "fgm"
    t.decimal "fta"
    t.decimal "ftm"
    t.decimal "gp"
    t.datetime "imported_at", null: false
    t.decimal "min"
    t.text "missing_stat_keys", default: [], null: false, array: true
    t.decimal "oreb"
    t.decimal "pf"
    t.bigint "player_id", null: false
    t.decimal "pts"
    t.decimal "reb"
    t.integer "season", null: false
    t.string "source", null: false
    t.decimal "stl"
    t.decimal "td"
    t.decimal "to"
    t.decimal "tpa"
    t.decimal "tpm"
    t.datetime "updated_at", null: false
    t.index ["player_id"], name: "index_player_projections_on_player_id"
    t.index ["source", "season", "player_id"], name: "index_player_projections_on_source_and_season_and_player_id", unique: true
    t.index ["source", "season"], name: "index_player_projections_on_source_and_season"
  end

  create_table "player_season_stats", force: :cascade do |t|
    t.decimal "ast"
    t.decimal "blk"
    t.datetime "created_at", null: false
    t.decimal "dd"
    t.decimal "dreb"
    t.decimal "fga"
    t.decimal "fgm"
    t.decimal "fta"
    t.decimal "ftm"
    t.decimal "gp"
    t.datetime "imported_at", null: false
    t.decimal "min"
    t.decimal "oreb"
    t.decimal "pf"
    t.bigint "player_id", null: false
    t.decimal "pts"
    t.decimal "reb"
    t.integer "season", null: false
    t.string "source", null: false
    t.decimal "stl"
    t.decimal "td"
    t.decimal "to"
    t.decimal "tpa"
    t.decimal "tpm"
    t.datetime "updated_at", null: false
    t.index ["player_id"], name: "index_player_season_stats_on_player_id"
    t.index ["source", "season", "player_id"], name: "index_player_season_stats_on_source_and_season_and_player_id", unique: true
    t.index ["source", "season"], name: "index_player_season_stats_on_source_and_season"
  end

  create_table "players", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "espn_player_id"
    t.string "first_name", null: false
    t.string "full_name", null: false
    t.string "injury_status"
    t.string "last_name", null: false
    t.string "nba_team", null: false
    t.string "positions", default: [], null: false, array: true
    t.datetime "updated_at", null: false
    t.index ["espn_player_id"], name: "index_players_on_espn_player_id", unique: true, where: "(espn_player_id IS NOT NULL)"
  end

  create_table "weight_sets", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.datetime "updated_at", null: false
    t.jsonb "weights", default: {}, null: false
    t.index "lower((name)::text)", name: "index_weight_sets_on_lower_name", unique: true
  end

  add_foreign_key "player_projections", "players"
  add_foreign_key "player_season_stats", "players"
end
