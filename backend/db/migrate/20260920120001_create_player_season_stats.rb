class CreatePlayerSeasonStats < ActiveRecord::Migration[8.1]
  def change
    create_table :player_season_stats do |t|
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
      t.decimal :reb
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
      t.datetime :imported_at, null: false

      t.timestamps
    end

    add_index :player_season_stats, [ :source, :season, :player_id ], unique: true
    add_index :player_season_stats, [ :source, :season ]
  end
end
