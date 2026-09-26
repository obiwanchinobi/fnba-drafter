# Each Team Chino slot's search is now its own saved run, keyed by user_slot,
# with the search metadata and scenario scores on the run. Existing runs are
# deleted rather than backfilled: they were scored on a single base draft and
# would read as comparable to scenario win rates.
class MoveWeightSearchToRuns < ActiveRecord::Migration[8.1]
  def up
    execute "DELETE FROM weight_search_runs"

    change_table :weight_search_runs, bulk: true do |t|
      t.integer :budget
      t.bigint :seed
      t.string :source
      t.integer :season
      t.datetime :projection_imported_at
      t.decimal :win_rate
      t.decimal :mean_margin
      t.decimal :worst_margin
      t.jsonb :margins
      t.integer :scenario_count
      t.decimal :noise_sd
    end

    remove_reference :weight_search_runs, :weight_search, foreign_key: true, index: true
    add_index :weight_search_runs, :user_slot, unique: true
    drop_table :weight_searches
  end

  def down
    execute "DELETE FROM weight_search_runs"

    create_table :weight_searches do |t|
      t.integer :budget, null: false
      t.bigint :seed, null: false
      t.string :source, null: false
      t.integer :season, null: false
      t.datetime :projection_imported_at, null: false
      t.string :user_team, null: false

      t.timestamps
    end

    remove_index :weight_search_runs, :user_slot
    add_reference :weight_search_runs, :weight_search, null: false, foreign_key: true
    add_index :weight_search_runs, [ :weight_search_id, :user_slot ], unique: true

    change_table :weight_search_runs, bulk: true do |t|
      t.remove :budget, :seed, :source, :season, :projection_imported_at, :win_rate, :mean_margin,
        :worst_margin, :margins, :scenario_count, :noise_sd
    end
  end
end
