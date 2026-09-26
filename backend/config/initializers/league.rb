# League settings for this rotisserie league.
# Source: ESPN mSettings 2026-09-21 and docs/context/product-vision.md.
module League
  TEAM_COUNT = 8
  ROUNDS = 17
  USER_TEAM = "Team Chino"
  TEAMS = [
    "Adam's All Stars",
    "Double Pump Fake",
    "Pickle Balboa",
    "Team Not Rich Asian",
    "No More Acquisitions For Sale",
    "Team Chino",
    "Succulent Chinese Meal",
    "Trust in Pizza"
  ].freeze
  ROSTER_SLOTS = [
    "PG",
    "SG",
    "SF",
    "PF",
    "C",
    "G",
    "F/C",
    "UTIL",
    "UTIL",
    "UTIL",
    "UTIL",
    "BENCH",
    "BENCH",
    "BENCH",
    "BENCH",
    "BENCH",
    "BENCH"
  ].freeze
  SLOT_ELIGIBILITY = {
    "PG" => %w[PG].freeze,
    "SG" => %w[SG].freeze,
    "SF" => %w[SF].freeze,
    "PF" => %w[PF].freeze,
    "C" => %w[C].freeze,
    "G" => %w[PG SG].freeze,
    "F/C" => %w[SF PF C].freeze,
    "UTIL" => %w[PG SG SF PF C].freeze,
    "BENCH" => %w[PG SG SF PF C].freeze
  }.freeze
  POOL_SIZE = TEAM_COUNT * ROUNDS
  POOL_MIN_GP = 20
end
