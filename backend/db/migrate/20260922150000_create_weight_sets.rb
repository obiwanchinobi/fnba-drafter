class CreateWeightSets < ActiveRecord::Migration[8.1]
  def change
    create_table :weight_sets do |t|
      t.string :name, null: false
      t.jsonb :weights, null: false, default: {}
      t.timestamps
    end

    add_index :weight_sets, "lower(name)", unique: true, name: "index_weight_sets_on_lower_name"
  end
end
