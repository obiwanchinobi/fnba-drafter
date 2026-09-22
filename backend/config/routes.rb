Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    resources :mock_drafts, only: %i[index show create]
    get "status", to: "status#show"
    get "projections", to: "projections#index"
    post "projections/refresh", to: "projections#refresh"
    get "season_stats", to: "season_stats#index"
  end
end
