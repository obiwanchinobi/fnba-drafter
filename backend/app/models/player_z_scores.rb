# Season-total z-scores for the 19 scored cats.
# Population sd (divide by n). TO and PF are inverse. A nil cat nils the total.
class PlayerZScores
  SCORED_CATS = {
    fgm: { kind: :counting, numerator: :fgm }.freeze,
    fg_pct: { kind: :ratio, numerator: :fgm, denominator: :fga }.freeze,
    ftm: { kind: :counting, numerator: :ftm }.freeze,
    ft_pct: { kind: :ratio, numerator: :ftm, denominator: :fta }.freeze,
    tpm: { kind: :counting, numerator: :tpm }.freeze,
    tp_pct: { kind: :ratio, numerator: :tpm, denominator: :tpa }.freeze,
    oreb: { kind: :counting, numerator: :oreb }.freeze,
    dreb: { kind: :counting, numerator: :dreb }.freeze,
    ast: { kind: :counting, numerator: :ast }.freeze,
    ato: { kind: :ratio, numerator: :ast, denominator: :to }.freeze,
    stl: { kind: :counting, numerator: :stl }.freeze,
    str: { kind: :ratio, numerator: :stl, denominator: :to }.freeze,
    blk: { kind: :counting, numerator: :blk }.freeze,
    to: { kind: :counting, inverse: true, numerator: :to }.freeze,
    pf: { kind: :counting, inverse: true, numerator: :pf }.freeze,
    dd: { kind: :counting, numerator: :dd }.freeze,
    td: { kind: :counting, numerator: :td }.freeze,
    pts: { kind: :counting, numerator: :pts }.freeze,
    ppm: { kind: :ratio, numerator: :pts, denominator: :min }.freeze
  }.freeze
  CAT_IDS = SCORED_CATS.keys.freeze

  def initialize(projections, pool_size:, pool_min_gp:)
    @rows = projections.to_a
    @pool_cap = pool_size
    @pool_min_gp = pool_min_gp
    pool = chosen_pool
    @pool_size = pool.length
    stats = compute_pool_stats(pool)
    @scores = {}
    @rows.each do |row|
      @scores[row.player_id] = score_row(row, stats)
    end
  end

  def for(player_id)
    @scores[player_id]
  end

  attr_reader :pool_size

  private
    def chosen_pool
      eligible = eligible_rows
      pool = eligible
      10.times do
        stats = compute_pool_stats(pool)
        next_pool = top_pool(eligible, stats)
        if same_membership?(pool, next_pool)
          pool = next_pool
          break
        end
        pool = next_pool
      end
      pool
    end

    def eligible_rows
      @rows.select do |row|
        gp = read_stat(row, :gp)
        !gp.nil? && gp >= @pool_min_gp && complete?(row)
      end
    end

    def complete?(row)
      CAT_IDS.all? do |cat|
        definition = SCORED_CATS.fetch(cat)
        if definition[:kind] == :counting
          !read_stat(row, definition[:numerator]).nil?
        else
          parts = ratio_parts(row, cat)
          !parts[:numerator].nil? && !parts[:denominator].nil?
        end
      end
    end

    def compute_pool_stats(pool)
      ratios = reference_ratios(pool)
      mean = {}
      sd = {}
      CAT_IDS.each do |cat|
        values = pool.filter_map { |row| cat_raw_value(row, cat, ratios[cat]) }
        mean[cat], sd[cat] = mean_and_sd(values)
      end
      { reference_ratio: ratios, mean: mean, sd: sd }
    end

    def reference_ratios(pool)
      ratios = {}
      CAT_IDS.each do |cat|
        next unless SCORED_CATS.fetch(cat)[:kind] == :ratio

        num_sum = 0.0
        den_sum = 0.0
        any = false
        pool.each do |row|
          parts = ratio_parts(row, cat)
          next if parts[:numerator].nil? || parts[:denominator].nil?

          num_sum += parts[:numerator]
          den_sum += parts[:denominator]
          any = true
        end
        next unless any

        ratios[cat] = den_sum.zero? ? 0.0 : num_sum / den_sum
      end
      ratios
    end

    def top_pool(eligible, stats)
      ranked = eligible.map { |row| { row: row, total: score_row(row, stats)[:total] } }
      ranked.sort! { |left, right| compare_totals(left, right) }
      ranked.take(@pool_cap).map { |entry| entry[:row] }
    end

    def compare_totals(left, right)
      left_missing = left[:total].nil?
      right_missing = right[:total].nil?
      if left_missing && right_missing
        left[:row].player_id <=> right[:row].player_id
      elsif left_missing
        1
      elsif right_missing
        -1
      elsif left[:total] != right[:total]
        right[:total] <=> left[:total]
      else
        left[:row].player_id <=> right[:row].player_id
      end
    end

    def same_membership?(left, right)
      return false unless left.length == right.length

      ids = {}
      left.each { |row| ids[row.player_id] = true }
      right.all? { |row| ids[row.player_id] }
    end

    def score_row(row, stats)
      cats = {}
      total = 0.0
      any_nil = false
      CAT_IDS.each do |cat|
        raw = cat_raw_value(row, cat, stats[:reference_ratio][cat])
        z = z_for(raw, cat, stats)
        cats[cat] = z
        if z.nil?
          any_nil = true
        else
          total += z
        end
      end
      { cats: cats, total: any_nil ? nil : total }
    end

    def cat_raw_value(row, cat, reference_ratio)
      definition = SCORED_CATS.fetch(cat)
      if definition[:kind] == :counting
        read_stat(row, definition[:numerator])
      else
        parts = ratio_parts(row, cat)
        return nil if parts[:numerator].nil? || parts[:denominator].nil?

        ref = reference_ratio || 0.0
        parts[:numerator] - (ref * parts[:denominator])
      end
    end

    def ratio_parts(row, cat)
      definition = SCORED_CATS.fetch(cat)
      {
        numerator: read_stat(row, definition[:numerator]),
        denominator: read_stat(row, definition[:denominator])
      }
    end

    def z_for(value, cat, stats)
      return nil if value.nil?

      mean = stats[:mean][cat]
      sd = stats[:sd][cat]
      return nil if mean.nil? || sd.nil?
      return 0.0 if sd.zero?

      if SCORED_CATS.fetch(cat)[:inverse]
        (mean - value) / sd
      else
        (value - mean) / sd
      end
    end

    def mean_and_sd(values)
      return [ nil, nil ] if values.empty?

      mean = values.sum(0.0) / values.length
      variance = values.sum(0.0) { |value| (value - mean)**2 } / values.length
      [ mean, Math.sqrt(variance) ]
    end

    def read_stat(row, name)
      finite_number(row.public_send(name))
    end

    def finite_number(value)
      return nil if value.nil?
      return nil unless value.is_a?(Numeric)

      number = value.to_f
      number.finite? ? number : nil
    end
end
