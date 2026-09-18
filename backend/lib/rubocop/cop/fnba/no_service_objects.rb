# frozen_string_literal: true

module RuboCop
  module Cop
    module Fnba
      # Domain POROs live in app/models/ alongside Active Record. Service objects
      # are banned: app/services/, *Service types, and command objects whose API is #call.
      class NoServiceObjects < Base
        MSG_DIR = "Don't add app/services/. Put domain behavior in a PORO under app/models/."
        MSG_DOMAIN_DIR = "Don't add app/domain/. Put domain POROs in app/models/ alongside Active Record."
        MSG_NAME = "Don't define *Service types. Put domain behavior in a PORO under app/models/."
        MSG_CALL = "Don't give models a #call API. Use a domain verb on a PORO under app/models/."

        def on_new_investigation
          path = processed_source.file_path.to_s.tr("\\", "/")
          add_global_offense(MSG_DIR) if path.include?("/app/services/")
          add_global_offense(MSG_DOMAIN_DIR) if path.include?("/app/domain/")
        end

        def on_class(node)
          check_type_name(node)
        end

        def on_module(node)
          check_type_name(node)
        end

        def on_def(node)
          check_call_method(node)
        end

        def on_defs(node)
          check_call_method(node)
        end

        private
          def check_type_name(node)
            const = node.identifier
            name = const.respond_to?(:const_name) ? const.const_name : nil
            last = name.to_s.split("::").last
            return unless last&.end_with?("Service")

            add_offense(const, message: MSG_NAME)
          end

          def check_call_method(node)
            return unless node.method?(:call)
            return unless models_or_services_path?

            add_offense(node.loc.name, message: MSG_CALL)
          end

          def models_or_services_path?
            path = processed_source.file_path.to_s.tr("\\", "/")
            path.include?("/app/models/") || path.include?("/app/services/")
          end
      end
    end
  end
end
