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

ActiveRecord::Schema[8.1].define(version: 2026_09_26_110000) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "mock_draft_picks", force: :cascade do |t|
    t.bigint "mock_draft_run_id", null: false
    t.integer "overall_pick", null: false
    t.integer "round", null: false
    t.integer "slot", null: false
    t.string "team", null: false
    t.bigint "player_id", null: false
    t.string "roster_slot", null: false
    t.decimal "z_total", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.decimal "z_weighted"
    t.index ["mock_draft_run_id", "overall_pick"], name: "index_mock_draft_picks_on_mock_draft_run_id_and_overall_pick", unique: true
    t.index ["mock_draft_run_id", "team"], name: "index_mock_draft_picks_on_mock_draft_run_id_and_team"
    t.index ["mock_draft_run_id"], name: "index_mock_draft_picks_on_mock_draft_run_id"
    t.index ["player_id"], name: "index_mock_draft_picks_on_player_id"
  end

  create_table "mock_draft_runs", force: :cascade do |t|
    t.bigint "mock_draft_id", null: false
    t.integer "user_slot", null: false
    t.text "draft_order", null: false, array: true
    t.jsonb "standings", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["mock_draft_id", "user_slot"], name: "index_mock_draft_runs_on_mock_draft_id_and_user_slot", unique: true
    t.index ["mock_draft_id"], name: "index_mock_draft_runs_on_mock_draft_id"
  end

  create_table "mock_drafts", force: :cascade do |t|
    t.string "policy", null: false
    t.string "source", null: false
    t.integer "season", null: false
    t.datetime "projection_imported_at", null: false
    t.integer "pool_size", null: false
    t.string "user_team", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "weight_set_name"
    t.jsonb "weights"
  end

  create_table "player_projections", force: :cascade do |t|
    t.bigint "player_id", null: false
    t.string "source", null: false
    t.integer "season", null: false
    t.decimal "gp"
    t.decimal "min"
    t.decimal "fgm"
    t.decimal "fga"
    t.decimal "ftm"
    t.decimal "fta"
    t.decimal "tpm"
    t.decimal "tpa"
    t.decimal "oreb"
    t.decimal "dreb"
    t.decimal "ast"
    t.decimal "stl"
    t.decimal "blk"
    t.decimal "to"
    t.decimal "pf"
    t.decimal "dd"
    t.decimal "td"
    t.decimal "pts"
    t.text "missing_stat_keys", default: [], null: false, array: true
    t.datetime "imported_at", null: false
    t.integer "espn_roto_rank"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.text "estimated_stat_keys", default: [], null: false, array: true
    t.decimal "reb"
    t.index ["player_id"], name: "index_player_projections_on_player_id"
    t.index ["source", "season", "player_id"], name: "index_player_projections_on_source_and_season_and_player_id", unique: true
    t.index ["source", "season"], name: "index_player_projections_on_source_and_season"
  end

  create_table "player_season_stats", force: :cascade do |t|
    t.bigint "player_id", null: false
    t.string "source", null: false
    t.integer "season", null: false
    t.decimal "gp"
    t.decimal "min"
    t.decimal "fgm"
    t.decimal "fga"
    t.decimal "ftm"
    t.decimal "fta"
    t.decimal "tpm"
    t.decimal "tpa"
    t.decimal "reb"
    t.decimal "oreb"
    t.decimal "dreb"
    t.decimal "ast"
    t.decimal "stl"
    t.decimal "blk"
    t.decimal "to"
    t.decimal "pf"
    t.decimal "dd"
    t.decimal "td"
    t.decimal "pts"
    t.datetime "imported_at", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["player_id"], name: "index_player_season_stats_on_player_id"
    t.index ["source", "season", "player_id"], name: "index_player_season_stats_on_source_and_season_and_player_id", unique: true
    t.index ["source", "season"], name: "index_player_season_stats_on_source_and_season"
  end

  create_table "players", force: :cascade do |t|
    t.bigint "espn_player_id"
    t.string "first_name", null: false
    t.string "last_name", null: false
    t.string "full_name", null: false
    t.string "positions", default: [], null: false, array: true
    t.string "nba_team", null: false
    t.string "injury_status"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["espn_player_id"], name: "index_players_on_espn_player_id", unique: true, where: "(espn_player_id IS NOT NULL)"
  end

  create_table "weight_search_runs", force: :cascade do |t|
    t.integer "user_slot", null: false
    t.string "weight_set_name", null: false
    t.jsonb "weights", null: false
    t.integer "rank", null: false
    t.decimal "roto_points", null: false
    t.decimal "margin", null: false
    t.boolean "won", null: false
    t.text "draft_order", null: false, array: true
    t.jsonb "standings", null: false
    t.jsonb "picks", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "budget"
    t.bigint "seed"
    t.string "source"
    t.integer "season"
    t.datetime "projection_imported_at"
    t.decimal "win_rate"
    t.decimal "mean_margin"
    t.decimal "worst_margin"
    t.jsonb "margins"
    t.integer "scenario_count"
    t.decimal "noise_sd"
    t.index ["user_slot"], name: "index_weight_search_runs_on_user_slot", unique: true
  end

  create_table "weight_sets", force: :cascade do |t|
    t.string "name", null: false
    t.jsonb "weights", default: {}, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index "lower((name)::text)", name: "index_weight_sets_on_lower_name", unique: true
  end

  add_foreign_key "mock_draft_picks", "mock_draft_runs"
  add_foreign_key "mock_draft_picks", "players"
  add_foreign_key "mock_draft_runs", "mock_drafts"
  add_foreign_key "player_projections", "players"
  add_foreign_key "player_season_stats", "players"
end
