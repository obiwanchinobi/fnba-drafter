# A seeded 160-player espn board, plus replay helpers, for weight search tests.
module SearchBoardHelpers
  BASE_LINE = {
    gp: 70,
    min: 2_100,
    fgm: 420,
    fga: 880,
    ftm: 190,
    fta: 240,
    tpm: 110,
    tpa: 300,
    oreb: 70,
    dreb: 290,
    ast: 260,
    stl: 70,
    blk: 45,
    to: 140,
    pf: 150,
    dd: 15,
    td: 2,
    pts: 1_140
  }.freeze
  PLAYER_COUNT = 160
  IMPORTED_AT = Time.utc(2026, 9, 25, 8, 30, 0)

  private
    def create_search_board
      stats = Random.new(42)
      PLAYER_COUNT.times do |index|
        create_draftable(index, varied_line(stats))
      end
    end

    def espn_projections
      PlayerProjection.includes(:player).where(source: "espn", season: Espn::SEASON).to_a
    end

    def chino_row(table)
      table.find { |row| row["team"] == League::USER_TEAM }
    end

    def best_other_points(table)
      table.reject { |row| row["team"] == League::USER_TEAM }.map { |row| row["roto_points"] }.max
    end

    def replay_picks(user_slot, weights)
      board = MockDraft.draftable_board(espn_projections, weights)
      SnakeDraft.new(
        order: MockDraft.draft_order_for(user_slot),
        orders: MockDraft.team_orders(board, MockDraft.weighted_order(board)),
        rounds: League::ROUNDS
      ).picks
    end

    def replay(user_slot, weights)
      picks = replay_picks(user_slot, weights)
      RotoStandings.new(MockDraft.rosters_for(picks, espn_projections.index_by(&:player_id))).table
    end

    def espn_ranks
      espn_projections.to_h { |projection| [ projection.player_id, projection.espn_roto_rank ] }
    end

    def search_scenarios(seed, count)
      DraftScenarios.new(
        board: MockDraft.draftable_board(espn_projections), espn_ranks: espn_ranks, seed: seed, count: count
      )
    end

    # Chino's roto margin in each scenario: opponents draft the scenario's
    # orders, Chino drafts the board by `weights`, standings use the projections.
    def replay_margins(user_slot, weights, scenarios)
      chino_order = MockDraft.weighted_order(MockDraft.draftable_board(espn_projections, weights))
      by_player_id = espn_projections.index_by(&:player_id)
      scenarios.map do |scenario|
        orders = scenario[:orders].merge(League::USER_TEAM => chino_order)
        picks = SnakeDraft.new(order: MockDraft.draft_order_for(user_slot), orders: orders, rounds: League::ROUNDS).picks
        table = RotoStandings.new(MockDraft.rosters_for(picks, by_player_id)).table
        chino_row(table)["roto_points"] - best_other_points(table)
      end
    end

    # The search objective for a list of margins.
    def objective(margins)
      [ margins.count(&:positive?).fdiv(margins.size), margins.sum.fdiv(margins.size), margins.min ]
    end

    def varied_line(stats)
      line = BASE_LINE.to_h do |key, value|
        next [ key, value ] if key == :gp

        [ key, (value * (0.35 + (stats.rand * 1.3))).round ]
      end
      line[:fga] = [ line[:fga], line[:fgm] + 1 ].max
      line[:fta] = [ line[:fta], line[:ftm] + 1 ].max
      line[:tpa] = [ line[:tpa], line[:tpm] + 1 ].max
      line
    end

    def create_draftable(index, line)
      player = Player.create!(
        first_name: "Search",
        last_name: "Player#{index}",
        full_name: "Search Player #{index}",
        positions: [ "PG", "SG", "SF", "PF", "C" ],
        nba_team: "DEN",
        espn_player_id: (Process.pid * 1_000_000) + index + 1
      )
      PlayerProjection.create!(
        {
          player: player,
          source: "espn",
          season: Espn::SEASON,
          imported_at: index.zero? ? IMPORTED_AT : Time.utc(2026, 9, 1),
          missing_stat_keys: [],
          estimated_stat_keys: [],
          espn_roto_rank: index + 1
        }.merge(line)
      )
    end
end
