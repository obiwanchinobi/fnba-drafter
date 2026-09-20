module Espn
  LEAGUE_ID = 43046
  SEASON = 2027
  STAT_BLOCK_ID = "102027"
  PAGE_SIZE = 50

  def self.projection_block_id(season)
    "10#{season}"
  end

  def self.actuals_block_id(season)
    "00#{season}"
  end

  SLOT_MAP = {
    0 => "PG",
    1 => "SG",
    2 => "SF",
    3 => "PF",
    4 => "C"
  }.freeze

  # ESPN keys 19–21 are listed so callers can skip them; they are not columns.
  STAT_KEY_MAP = {
    "0" => :pts,
    "1" => :blk,
    "2" => :stl,
    "3" => :ast,
    "4" => :oreb,
    "5" => :dreb,
    "6" => :reb,
    "9" => :pf,
    "11" => :to,
    "13" => :fgm,
    "14" => :fga,
    "15" => :ftm,
    "16" => :fta,
    "17" => :tpm,
    "18" => :tpa,
    "19" => :fg_pct,
    "20" => :ft_pct,
    "21" => :tp_pct,
    "37" => :dd,
    "38" => :td,
    "40" => :min,
    "42" => :gp
  }.freeze

  UNSCORED_STAT_FIELDS = %i[fg_pct ft_pct tp_pct].freeze
  ESTIMATED_STAT_FIELDS = %i[oreb dreb pf dd td].freeze

  # Frozen from 2027 proTeamSchedules_wl (31 entries, including FA).
  PRO_TEAM_ABBREVS = {
    0 => "FA",
    1 => "ATL",
    2 => "BOS",
    3 => "NO",
    4 => "CHI",
    5 => "CLE",
    6 => "DAL",
    7 => "DEN",
    8 => "DET",
    9 => "GS",
    10 => "HOU",
    11 => "IND",
    12 => "LAC",
    13 => "LAL",
    14 => "MIA",
    15 => "MIL",
    16 => "MIN",
    17 => "BKN",
    18 => "NY",
    19 => "ORL",
    20 => "PHI",
    21 => "PHX",
    22 => "POR",
    23 => "SAC",
    24 => "SA",
    25 => "OKC",
    26 => "UTAH",
    27 => "WSH",
    28 => "TOR",
    29 => "MEM",
    30 => "CHA"
  }.freeze
end
