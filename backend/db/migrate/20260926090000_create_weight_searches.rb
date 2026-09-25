class CreateWeightSearches < ActiveRecord::Migration[8.1]
  def change
    create_table :weight_searches do |t|
      t.integer :budget, null: false
      t.bigint :seed, null: false
      t.string :source, null: false
      t.integer :season, null: false
      t.datetime :projection_imported_at, null: false
      t.string :user_team, null: false

      t.timestamps
    end

    create_table :weight_search_runs do |t|
      t.references :weight_search, null: false, foreign_key: true
      t.integer :user_slot, null: false
      t.string :weight_set_name, null: false
      t.jsonb :weights, null: false
      t.integer :rank, null: false
      t.decimal :roto_points, null: false
      t.decimal :margin, null: false
      t.boolean :won, null: false
      t.text :draft_order, array: true, null: false
      t.jsonb :standings, null: false
      t.jsonb :picks, null: false

      t.timestamps
    end

    add_index :weight_search_runs, [ :weight_search_id, :user_slot ], unique: true
  end
end
