module Api
  class StatusController < ApplicationController
    def show
      render json: { app: "fnba-drafter", ok: true }
    end
  end
end
