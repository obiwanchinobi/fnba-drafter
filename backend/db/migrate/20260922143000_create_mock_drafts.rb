class CreateMockDrafts < ActiveRecord::Migration[8.1]
  def change
    create_table :mock_drafts do |t|
      t.string :policy, null: false
      t.string :source, null: false
      t.integer :season, null: false
      t.datetime :projection_imported_at, null: false
      t.integer :pool_size, null: false
      t.string :user_team, null: false

      t.timestamps
    end

    create_table :mock_draft_runs do |t|
      t.references :mock_draft, null: false, foreign_key: true
      t.integer :user_slot, null: false
      t.text :draft_order, array: true, null: false
      t.jsonb :standings, null: false

      t.timestamps
    end

    add_index :mock_draft_runs, [ :mock_draft_id, :user_slot ], unique: true

    create_table :mock_draft_picks do |t|
      t.references :mock_draft_run, null: false, foreign_key: true
      t.integer :overall_pick, null: false
      t.integer :round, null: false
      t.integer :slot, null: false
      t.string :team, null: false
      t.references :player, null: false, foreign_key: true
      t.string :roster_slot, null: false
      t.decimal :z_total, null: false

      t.timestamps
    end

    add_index :mock_draft_picks, [ :mock_draft_run_id, :overall_pick ], unique: true
    add_index :mock_draft_picks, [ :mock_draft_run_id, :team ]
  end
end
