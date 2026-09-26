require "test_helper"

class MockDraftTest < ActiveSupport::TestCase
  STAT_LINE = {
    gp: 20,
    min: 2_000,
    fgm: 400,
    fga: 800,
    ftm: 200,
    fta: 250,
    tpm: 80,
    tpa: 240,
    oreb: 80,
    dreb: 320,
    ast: 240,
    stl: 80,
    blk: 40,
    to: 120,
    pf: 160,
    dd: 20,
    td: 4,
    pts: 1_080
  }.freeze

  # Circular rotation of the 2026 final-standings order. Slot k is Team Chino.
  EXPECTED_DRAFT_ORDERS = [
    [
      "Team Chino",
      "Succulent Chinese Meal",
      "Trust in Pizza",
      "Adam's All Stars",
      "Double Pump Fake",
      "Pickle Balboa",
      "Team Not Rich Asian",
      "No More Acquisitions For Sale"
    ],
    [
      "No More Acquisitions For Sale",
      "Team Chino",
      "Succulent Chinese Meal",
      "Trust in Pizza",
      "Adam's All Stars",
      "Double Pump Fake",
      "Pickle Balboa",
      "Team Not Rich Asian"
    ],
    [
      "Team Not Rich Asian",
      "No More Acquisitions For Sale",
      "Team Chino",
      "Succulent Chinese Meal",
      "Trust in Pizza",
      "Adam's All Stars",
      "Double Pump Fake",
      "Pickle Balboa"
    ],
    [
      "Pickle Balboa",
      "Team Not Rich Asian",
      "No More Acquisitions For Sale",
      "Team Chino",
      "Succulent Chinese Meal",
      "Trust in Pizza",
      "Adam's All Stars",
      "Double Pump Fake"
    ],
    [
      "Double Pump Fake",
      "Pickle Balboa",
      "Team Not Rich Asian",
      "No More Acquisitions For Sale",
      "Team Chino",
      "Succulent Chinese Meal",
      "Trust in Pizza",
      "Adam's All Stars"
    ],
    [
      "Adam's All Stars",
      "Double Pump Fake",
      "Pickle Balboa",
      "Team Not Rich Asian",
      "No More Acquisitions For Sale",
      "Team Chino",
      "Succulent Chinese Meal",
      "Trust in Pizza"
    ],
    [
      "Trust in Pizza",
      "Adam's All Stars",
      "Double Pump Fake",
      "Pickle Balboa",
      "Team Not Rich Asian",
      "No More Acquisitions For Sale",
      "Team Chino",
      "Succulent Chinese Meal"
    ],
    [
      "Succulent Chinese Meal",
      "Trust in Pizza",
      "Adam's All Stars",
      "Double Pump Fake",
      "Pickle Balboa",
      "Team Not Rich Asian",
      "No More Acquisitions For Sale",
      "Team Chino"
    ]
  ].freeze

  test "policy must be a known policy" do
    draft = MockDraft.new(
      policy: "adp",
      source: "espn",
      season: Espn::SEASON,
      projection_imported_at: Time.utc(2026, 9, 1),
      pool_size: League::POOL_SIZE,
      user_team: League::USER_TEAM
    )

    assert_not draft.valid?
    assert draft.errors[:policy].any?
  end

  test "simulate! creates eight runs of 136 picks and records projection_imported_at" do
    early = Time.utc(2026, 9, 1, 12, 0, 0)
    latest = Time.utc(2026, 9, 22, 3, 0, 0)

    nil_rank = create_draftable(imported_at: early, espn_roto_rank: nil)
    rank_two = create_draftable(imported_at: early, espn_roto_rank: 2)
    rank_one = create_draftable(
      imported_at: early,
      espn_roto_rank: 1,
      injury_status: "OUT",
      estimated_stat_keys: %w[dd td]
    )
    132.times do |offset|
      create_draftable(imported_at: early, espn_roto_rank: offset + 3)
    end
    standout = create_draftable(imported_at: early, espn_roto_rank: 400, pts: 9_000)
    low_gp = create_draftable(imported_at: latest, espn_roto_rank: 0, gp: 19, pts: 50_000)
    other_source = create_draftable(imported_at: early, espn_roto_rank: 0, source: "other", pts: 50_000)
    other_season = create_draftable(imported_at: early, espn_roto_rank: 0, season: Espn::SEASON - 1, pts: 50_000)
    missing_keys = create_draftable(
      imported_at: early,
      espn_roto_rank: 0,
      missing_stat_keys: %w[pts],
      pts: 50_000
    )
    nil_pts = create_draftable(imported_at: early, espn_roto_rank: 0, pts: nil)

    draft = MockDraft.simulate!(policy: "fnba_total_z")

    assert_equal 8, draft.runs.count
    assert_equal latest, draft.projection_imported_at
    assert_equal League::POOL_SIZE, draft.pool_size
    assert_equal League::USER_TEAM, draft.user_team
    assert_equal "fnba_total_z", draft.policy
    assert_equal "espn", draft.source
    assert_equal Espn::SEASON, draft.season

    runs = draft.runs.order(:user_slot).to_a
    assert_equal (1..8).to_a, runs.map(&:user_slot)
    assert_equal EXPECTED_DRAFT_ORDERS, runs.map(&:draft_order)

    sequences = runs.map { |run| run.picks.order(:overall_pick).pluck(:player_id) }
    assert_equal 1, sequences.uniq.size
    assert_equal (1..136).to_a, runs[0].picks.order(:overall_pick).pluck(:overall_pick)

    picked = sequences.first
    assert_equal standout.id, picked[0]
    assert_equal rank_one.id, picked[1]
    assert_equal rank_two.id, picked[2]
    assert_equal nil_rank.id, picked[135]
    assert_not_includes picked, low_gp.id
    assert_not_includes picked, other_source.id
    assert_not_includes picked, other_season.id
    assert_not_includes picked, missing_keys.id
    assert_not_includes picked, nil_pts.id

    runs.each_with_index do |run, index|
      assert_equal League::USER_TEAM, run.draft_order[index]
      assert_equal 8, run.standings.size
      winner = run.standings.find { |row| row["rank"] == 1 }
      assert_equal run.draft_order.first, winner["team"]
      run.standings.each do |row|
        sum = row["cats"].sum { |_cat, entry| entry["points"].to_f }
        assert_in_delta sum, row["roto_points"].to_f
        assert_equal 19, row["cats"].size
      end
      chino = run.standings.find { |row| row["team"] == League::USER_TEAM }
      assert_equal index.zero? ? 1 : 2, chino["rank"]
    end
    z_totals = runs[0].picks.order(:overall_pick).pluck(:z_total)
    assert z_totals.all? { |total| !total.nil? }
    assert_operator z_totals[0], :>, z_totals[1]
    assert_in_delta z_totals[1].to_f, z_totals[2].to_f, 1e-6
    assert_in_delta z_totals[1].to_f, z_totals[135].to_f, 1e-6

    sixth = runs[5]
    assert_equal League::TEAMS, sixth.draft_order
    picks = sixth.picks.order(:overall_pick).to_a
    assert_equal League::TEAMS[0], picks[0].team
    assert_equal 1, picks[0].slot
    assert_equal 1, picks[0].round
    assert_equal League::TEAMS[7], picks[7].team
    assert_equal 8, picks[7].slot
    assert_equal League::TEAMS[7], picks[8].team
    assert_equal 8, picks[8].slot
    assert_equal 2, picks[8].round
    assert_equal "PG", picks[0].roster_slot
    assert_equal "OUT", picks[1].player.injury_status
    assert_equal %w[dd td], picks[1].player.player_projections.find_by!(source: "espn", season: Espn::SEASON).estimated_stat_keys

    League::TEAMS.each do |team|
      slots = sixth.picks.where(team: team).order(:overall_pick).pluck(:roster_slot)
      assert_equal League::ROSTER_SLOTS.first(League::ROUNDS), slots, "#{team} roster slots"
    end
  end

  test "simulate! raises UnknownPolicy for an unknown policy" do
    assert_raises(MockDraft::UnknownPolicy) do
      MockDraft.simulate!(policy: "adp")
    end
    assert_equal 0, MockDraft.count
  end

  test "simulate! with a weight set ranks only Team Chino by that collection" do
    star = create_draftable(full_name: "Total Star", pts: 2_000, blk: 20, espn_roto_rank: 1)
    high_blocks = Array.new(68) { |index| create_draftable(blk: 60, espn_roto_rank: 100 + index) }
    low_blocks = Array.new(68) { |index| create_draftable(blk: 20, espn_roto_rank: 200 + index) }
    specialist = create_draftable(full_name: "Block Specialist", pts: 100, blk: 100, espn_roto_rank: 900)
    incomplete = create_draftable(full_name: "Missing Points", pts: nil, blk: 9_000, espn_roto_rank: 1)

    weights = WeightSet::CATEGORIES.index_with { |cat| cat == "blk" ? 1.0 : 0.0 }
    collection = WeightSet.create!(name: "Blocks only", weights: weights)

    default_draft = MockDraft.simulate!(policy: "fnba_total_z")
    weighted_draft = MockDraft.simulate!(policy: "fnba_total_z", weight_set: collection)

    assert_equal "fnba_total_z", weighted_draft.policy
    assert_nil default_draft.weight_set_name
    assert_nil default_draft.weights
    assert_equal "Blocks only", weighted_draft.weight_set_name
    assert_equal collection.weights.keys.sort, weighted_draft.weights.keys.sort
    collection.weights.each do |cat, weight|
      assert_in_delta weight, weighted_draft.weights.fetch(cat).to_f
    end

    default_last = default_draft.runs.find_by!(user_slot: 8)
    weighted_last = weighted_draft.runs.find_by!(user_slot: 8)
    assert_equal League::USER_TEAM, weighted_last.draft_order.last

    default_picks = default_last.picks.order(:overall_pick).to_a
    weighted_picks = weighted_last.picks.order(:overall_pick).to_a
    assert_equal star.id, default_picks.first.player_id
    assert_equal default_picks.first(7).map(&:player_id), weighted_picks.first(7).map(&:player_id)
    assert_equal high_blocks.first(6).map(&:id), weighted_picks[1, 6].map(&:player_id)

    weighted_draft.runs.each do |run|
      chino = run.picks.where(team: League::USER_TEAM).order(:overall_pick).first
      assert_equal specialist.id, chino.player_id
      assert_operator chino.z_weighted.to_f, :>, weighted_picks.first.z_weighted.to_f
    end

    default_first = first_player_by_team(default_last)
    weighted_first = first_player_by_team(weighted_last)
    (League::TEAMS - [ League::USER_TEAM ]).each do |team|
      assert_equal default_first[team], weighted_first[team], "#{team} first pick"
    end
    assert_equal specialist.id, weighted_first[League::USER_TEAM]
    assert_not_equal specialist.id, default_first[League::USER_TEAM]

    assert_in_delta default_picks.first.z_total.to_f, weighted_picks.first.z_total.to_f, 1e-6
    assert_operator default_picks.first.z_total.to_f, :>, default_picks.second.z_total.to_f

    drafted_default = default_draft.runs.flat_map { |run| run.picks.pluck(:player_id) }.uniq
    drafted_weighted = weighted_draft.runs.flat_map { |run| run.picks.pluck(:player_id) }.uniq
    assert_not_includes drafted_default, specialist.id
    assert_not_includes drafted_default, incomplete.id
    assert_not_includes drafted_weighted, incomplete.id
    assert_includes drafted_weighted, specialist.id
    assert_not_includes drafted_default, low_blocks.last.id

    weighted_draft.runs.each do |run|
      assert run.picks.pluck(:z_weighted).all? { |value| !value.nil? }
      assert_equal 19, run.standings.first.fetch("cats").size
    end
    default_draft.runs.each do |run|
      assert run.picks.pluck(:z_weighted).all?(&:nil?)
    end
  end

  test "simulate! raises BoardTooSmall when fewer than 136 players are draftable" do
    135.times { |index| create_draftable(espn_roto_rank: index + 1) }
    create_draftable(gp: 19, espn_roto_rank: 1_000)
    create_draftable(missing_stat_keys: %w[oreb], espn_roto_rank: 1_001)
    create_draftable(pts: nil, espn_roto_rank: 1_002)
    create_draftable(source: "other", espn_roto_rank: 1_003)
    create_draftable(season: Espn::SEASON - 1, espn_roto_rank: 1_004)

    assert_raises(MockDraft::BoardTooSmall) do
      MockDraft.simulate!(policy: "fnba_total_z")
    end
    assert_equal 0, MockDraft.count
  end

  test "draftable_board keeps each entry's per-category z-scores for weight searches" do
    create_draftable(pts: 2_000, espn_roto_rank: 1)
    create_draftable(blk: 90, espn_roto_rank: 2)
    create_draftable(missing_stat_keys: %w[pts], espn_roto_rank: 3)
    projections = PlayerProjection.includes(:player).where(source: "espn", season: Espn::SEASON).to_a
    weights = WeightSet::CATEGORIES.index_with { |cat| cat == "blk" ? 2.0 : 0.5 }

    board = MockDraft.draftable_board(projections, weights)

    assert_equal 2, board.size
    board.each do |entry|
      assert_equal %i[cats player_id positions value weighted_value], entry.keys.sort
      assert_equal PlayerZScores::CAT_IDS.sort, entry[:cats].keys.sort
      assert_in_delta entry[:cats].values.sum, entry[:value], 1e-9
      expected = PlayerZScores::CAT_IDS.sum { |cat| weights.fetch(cat.to_s) * entry[:cats][cat] }
      assert_in_delta expected, entry[:weighted_value], 1e-9
    end

    copy = MockDraft.duplicate_board(board)
    copy.first[:positions] << "X"
    assert_not_includes board.first[:positions], "X"
    assert_same board.first[:cats], copy.first[:cats]
  end

  private
    def first_player_by_team(run)
      run.picks.order(:overall_pick).each_with_object({}) do |pick, first|
        first[pick.team] ||= pick.player_id
      end
    end

    def next_espn_player_id
      @next_espn_player_id = @next_espn_player_id.to_i + 1
      (Process.pid * 1_000_000_000) + ((object_id % 1_000_000) * 1_000) + @next_espn_player_id
    end

    def create_player(**attrs)
      sequence = next_espn_player_id
      Player.create!(
        {
          first_name: "Mock",
          last_name: "Player#{sequence}",
          full_name: "Mock Player #{sequence}",
          positions: [ "PG", "SG", "SF", "PF", "C" ],
          nba_team: "DEN",
          espn_player_id: sequence
        }.merge(attrs)
      )
    end

    def create_projection(**attrs)
      player = attrs.delete(:player) || create_player
      PlayerProjection.create!(
        {
          player: player,
          source: "espn",
          season: Espn::SEASON,
          imported_at: Time.utc(2026, 9, 1),
          missing_stat_keys: [],
          estimated_stat_keys: []
        }.merge(STAT_LINE).merge(attrs)
      )
    end

    def create_draftable(**attrs)
      player_attrs = attrs.extract!(:injury_status, :positions, :full_name, :espn_player_id)
      player = create_player(**player_attrs)
      create_projection(**attrs, player: player)
      player
    end
end
