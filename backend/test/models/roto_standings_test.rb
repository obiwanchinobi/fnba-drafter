require "test_helper"

class RotoStandingsTest < ActiveSupport::TestCase
  TEAMS = %w[A B C D E F G H].freeze
  LINE = {
    fgm: 5, fga: 10, ftm: 4, fta: 5, tpm: 1, tpa: 3,
    oreb: 1, dreb: 4, ast: 3, stl: 1, blk: 1, to: 2, pf: 2,
    dd: 1, td: 0, pts: 12, min: 30
  }.freeze
  Line = Struct.new(*LINE.keys, keyword_init: true)

  test "category leader gets 8 points and last gets 1" do
    table = RotoStandings.new(eight { |index| line(pts: 100 - index) }).table

    assert_equal 8, cat_points(table, "A", "pts")
    assert_equal 1, cat_points(table, "H", "pts")
  end

  test "TO and PF give more points for fewer" do
    table = RotoStandings.new(eight { |index| line(to: index + 1, pf: index + 1) }).table

    assert_equal 8, cat_points(table, "A", "to")
    assert_equal 1, cat_points(table, "H", "to")
    assert_operator cat_points(table, "A", "pf"), :>, cat_points(table, "H", "pf")
  end

  test "two teams tied for first each get 7.5 and the next team gets 6" do
    rosters = eight do |index|
      makes = index < 2 ? 50 : 40 - (index * 3)
      line(fgm: makes)
    end
    table = RotoStandings.new(rosters).table

    assert_in_delta 7.5, cat_points(table, "A", "fgm")
    assert_in_delta 7.5, cat_points(table, "B", "fgm")
    assert_equal 6, cat_points(table, "C", "fgm")
  end

  test "FG% is summed makes over summed attempts" do
    rosters = eight { |index| line(fgm: 1, fga: 100 + index) }
    rosters["A"] = [ line(fgm: 1, fga: 1), line(fgm: 0, fga: 10) ]
    rosters["B"] = [ line(fgm: 4, fga: 10), line(fgm: 4, fga: 10) ]
    table = RotoStandings.new(rosters).table

    assert_in_delta 1.0 / 11, cat_value(table, "A", "fg_pct")
    assert_in_delta 0.4, cat_value(table, "B", "fg_pct")
    assert_operator cat_points(table, "B", "fg_pct"), :>, cat_points(table, "A", "fg_pct")
  end

  test "roto total equals the sum of the 19 category points and ties share rank 1" do
    rosters = eight { |index| line(pts: index < 2 ? 100 : 10) }
    standings = RotoStandings.new(rosters)
    table = standings.table

    table.each do |row|
      sum = row["cats"].sum { |_cat, entry| entry["points"] }
      assert_in_delta sum, row["roto_points"]
      assert_equal 19, row["cats"].size
    end
    assert_equal 1, rank_of(table, "A")
    assert_equal 1, rank_of(table, "B")
    assert_equal 3, rank_of(table, "C")
    assert_equal %w[A B], standings.winners
    assert_equal %w[A B C D E F G H], table.map { |row| row["team"] }
  end

  private
    def line(**overrides)
      Line.new(**LINE.merge(overrides))
    end

    def eight
      TEAMS.each_with_index.to_h { |team, index| [ team, [ yield(index) ] ] }
    end

    def row_for(table, team)
      table.find { |row| row["team"] == team }
    end

    def cat_points(table, team, cat)
      row_for(table, team).dig("cats", cat, "points")
    end

    def cat_value(table, team, cat)
      row_for(table, team).dig("cats", cat, "value")
    end

    def rank_of(table, team)
      row_for(table, team)["rank"]
    end
end
