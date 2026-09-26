# One row per season holding the real ESPN draft state, replaced wholesale on
# every refresh: the draft order (ESPN team names), the made picks as jsonb
# rows and ESPN's inProgress / drafted flags.
class CreateDrafts < ActiveRecord::Migration[8.1]
  def change
    create_table :drafts do |t|
      t.integer :season, null: false
      t.text :draft_order, null: false, array: true, default: []
      t.jsonb :picks, null: false, default: []
      t.boolean :espn_in_progress, null: false, default: false
      t.boolean :espn_drafted, null: false, default: false
      t.datetime :refreshed_at

      t.timestamps
    end

    add_index :drafts, :season, unique: true
  end
end
