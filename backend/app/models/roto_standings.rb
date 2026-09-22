# Projected rotisserie table for one mock-draft run.
# Every rostered player counts. TO and PF award more points for fewer.
class RotoStandings
  COUNTING = %i[fgm ftm tpm oreb dreb ast stl blk to pf dd td pts].freeze
  RATIOS = {
    fg_pct: %i[fgm fga],
    ft_pct: %i[ftm fta],
    tp_pct: %i[tpm tpa],
    ato: %i[ast to],
    str: %i[stl to],
    ppm: %i[pts min]
  }.freeze
  INVERSE = %i[to pf].freeze
  SUM_KEYS = %i[fgm fga ftm fta tpm tpa oreb dreb ast stl blk to pf dd td pts min].freeze
  CATS = (COUNTING + RATIOS.keys).freeze

  def initialize(rosters)
    @rosters = rosters
  end

  def table
    @table ||= ranked_rows
  end

  def winners
    table.select { |row| row["rank"] == 1 }.map { |row| row["team"] }
  end

  private
    def ranked_rows
      totals = @rosters.transform_values { |rows| sum_rows(rows) }
      points = CATS.to_h { |cat| [ cat, award_points(totals, cat) ] }
      rows = totals.keys.map { |team| standing_row(team, totals[team], points) }
      assign_ranks!(rows)
      rows.sort_by { |row| [ row["rank"], row["team"] ] }
    end

    def sum_rows(rows)
      sums = SUM_KEYS.to_h { |key| [ key, 0.0 ] }
      rows.each do |row|
        SUM_KEYS.each do |key|
          value = row.public_send(key)
          sums[key] += value.nil? ? 0.0 : value.to_f
        end
      end
      sums
    end

    def standing_row(team, sums, points)
      cats = {}
      total = 0.0
      CATS.each do |cat|
        cat_points = points.fetch(cat).fetch(team)
        total += cat_points
        cats[cat.to_s] = { "value" => category_value(sums, cat), "points" => cat_points }
      end
      { "team" => team, "roto_points" => total, "cats" => cats }
    end

    def category_value(sums, cat)
      parts = RATIOS[cat]
      return sums.fetch(cat) if parts.nil?

      numerator, denominator = parts
      denominator_sum = sums.fetch(denominator)
      return 0.0 if denominator_sum.zero?

      sums.fetch(numerator) / denominator_sum
    end

    def award_points(totals, cat)
      inverse = INVERSE.include?(cat)
      ordered = totals.map { |team, sums| [ team, category_value(sums, cat) ] }
      ordered.sort_by! { |team, value| [ inverse ? value : -value, team ] }
      awarded = {}
      index = 0
      size = ordered.size
      while index < size
        value = ordered[index][1]
        finish = index
        finish += 1 while finish < size && ordered[finish][1] == value
        start_points = size - index
        end_points = size - (finish - 1)
        mean = (start_points + end_points) / 2.0
        index.upto(finish - 1) { |cursor| awarded[ordered[cursor][0]] = mean }
        index = finish
      end
      awarded
    end

    def assign_ranks!(rows)
      ordered = rows.sort_by { |row| [ -row["roto_points"], row["team"] ] }
      rank = 1
      ordered.each_with_index do |row, index|
        if index.positive? && row["roto_points"] != ordered[index - 1]["roto_points"]
          rank = index + 1
        end
        row["rank"] = rank
      end
    end
end
