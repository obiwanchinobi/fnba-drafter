module Api
  class SeasonStatsController < ApplicationController
    include StatLineSerialization

    DEFAULT_SOURCE = "espn"
    DEFAULT_SEASON = Espn::SEASON - 1

    def index
      source = params.fetch(:source, DEFAULT_SOURCE)
      season = params.fetch(:season, DEFAULT_SEASON).to_i

      stats = PlayerSeasonStat
        .includes(:player)
        .where(source: source, season: season)
        .order(Arel.sql("player_season_stats.pts DESC NULLS LAST"))

      render json: stats.map { |stat| serialize_stat_line(stat, dataset: "actual") }
    end
  end
end
