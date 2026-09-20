namespace :espn do
  desc "Re-run omitted-cat estimates for stored ESPN projections without fetching"
  task :estimate, [ :season ] => :environment do |_task, args|
    season = Integer(args[:season].presence || Espn::SEASON)

    unless PlayerProjection.exists?(source: "espn", season: season)
      abort "No ESPN projection rows for season #{season}"
    end

    summary = EspnStatEstimates.new(season: season).apply!
    puts summary.inspect
  end

  desc "Compare ESPN projections (stored or reconstructed) with season actuals"
  task :backtest, [ :season, :mode ] => :environment do |_task, args|
    season = Integer(args[:season].presence || Espn::SEASON)
    mode = (args[:mode].presence || "stored").to_s

    begin
      if mode == "stored" && !PlayerProjection.exists?(source: "espn", season: season)
        warn "No stored ESPN projection rows for season #{season}; using reconstructed ESPN mode"
        mode = "espn"
      end

      unless %w[stored espn].include?(mode)
        abort "Unknown backtest mode #{mode} (use stored or espn)"
      end

      backtest =
        if mode == "espn"
          EspnBacktest.from_espn(season: season)
        else
          EspnBacktest.from_stored(season: season)
        end

      backtest.warnings.each { |warning| warn warning }
      puts backtest.to_markdown
    rescue EspnProjectionsClient::Error, EspnCookies::Missing, EspnCookies::Unreadable, ChromeCookieDecryptor::Error => error
      abort error.message
    end
  end
end
