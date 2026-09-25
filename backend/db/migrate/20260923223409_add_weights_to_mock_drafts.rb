class AddWeightsToMockDrafts < ActiveRecord::Migration[8.1]
  def change
    add_column :mock_drafts, :weight_set_name, :string
    add_column :mock_drafts, :weights, :jsonb
    add_column :mock_draft_picks, :z_weighted, :decimal
  end
end
