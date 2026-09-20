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
end
