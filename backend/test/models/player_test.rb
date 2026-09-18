require "test_helper"

class PlayerTest < ActiveSupport::TestCase
  test "espn_player_id is unique when present" do
    create_player(espn_player_id: 3_112_335)

    duplicate = new_player(espn_player_id: 3_112_335, full_name: "Nikola Jokic 2")

    assert_not duplicate.valid?
    assert duplicate.errors[:espn_player_id].any?
    assert_raises(ActiveRecord::RecordNotUnique) { duplicate.save(validate: false) }
  end

  test "two players may have a null espn_player_id" do
    first = create_player(espn_player_id: nil, full_name: "Free Agent One")
    second = create_player(espn_player_id: nil, full_name: "Free Agent Two")

    assert first.persisted?
    assert second.persisted?
    assert_nil first.espn_player_id
    assert_nil second.espn_player_id
  end

  test "has many player projections" do
    player = create_player(espn_player_id: 3_112_335)
    projection = player.player_projections.create!(
      source: "espn",
      season: 2027,
      imported_at: Time.current
    )

    assert_equal [ projection ], player.player_projections
  end

  test "positions only allow PG SG SF PF C" do
    player = new_player(positions: [ "G" ])

    assert_not player.valid?
    assert player.errors[:positions].any?

    player.positions = [ "PG", "SG" ]
    assert player.valid?
  end

  private
    def new_player(**attrs)
      Player.new(
        {
          first_name: "Nikola",
          last_name: "Jokic",
          full_name: "Nikola Jokic",
          positions: [ "C" ],
          nba_team: "DEN"
        }.merge(attrs)
      )
    end

    def create_player(**attrs)
      new_player(**attrs).tap(&:save!)
    end
end
