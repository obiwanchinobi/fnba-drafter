class CreatePlayersAndProjections < ActiveRecord::Migration[8.1]
  def change
    create_table :players do |t|
      t.bigint :espn_player_id
      t.string :first_name, null: false
      t.string :last_name, null: false
      t.string :full_name, null: false
      t.string :positions, array: true, null: false, default: []
      t.string :nba_team, null: false
      t.string :injury_status

      t.timestamps
    end

    add_index :players, :espn_player_id, unique: true, where: "espn_player_id IS NOT NULL"

    create_table :player_projections do |t|
      t.references :player, null: false, foreign_key: true
      t.string :source, null: false
      t.integer :season, null: false
      t.decimal :gp
      t.decimal :min
      t.decimal :fgm
      t.decimal :fga
      t.decimal :ftm
      t.decimal :fta
      t.decimal :tpm
      t.decimal :tpa
      t.decimal :oreb
      t.decimal :dreb
      t.decimal :ast
      t.decimal :stl
      t.decimal :blk
      t.decimal :to
      t.decimal :pf
      t.decimal :dd
      t.decimal :td
      t.decimal :pts
      t.text :missing_stat_keys, array: true, null: false, default: []
      t.datetime :imported_at, null: false
      t.integer :espn_roto_rank

      t.timestamps
    end

    add_index :player_projections, [ :source, :season, :player_id ], unique: true
    add_index :player_projections, [ :source, :season ]
  end
end
