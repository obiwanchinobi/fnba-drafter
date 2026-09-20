class AddEstimatedStatKeysAndRebToPlayerProjections < ActiveRecord::Migration[8.1]
  def change
    add_column :player_projections, :estimated_stat_keys, :text, array: true, default: [], null: false
    add_column :player_projections, :reb, :decimal
  end
end
