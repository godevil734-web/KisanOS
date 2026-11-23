-- Manual Rollback Script for Migration 013 (Maintained Strictly Outside backend/migrations/)
-- Drops F.1.4/F.1.5 durable audit gateway functions, triggers, indexes, and tables cleanly
-- in exact reverse dependency order while preserving public.mandi_historical_observations 100% intact.

DROP TRIGGER IF EXISTS trg_immutable_recovery_events ON public.mandi_harvest_recovery_events;
DROP TRIGGER IF EXISTS trg_verify_recovery_event_matches_transition ON public.mandi_harvest_recovery_events;
DROP TRIGGER IF EXISTS trg_immutable_lifecycle_transitions ON public.mandi_harvest_lifecycle_transitions;
DROP TRIGGER IF EXISTS trg_verify_transition_matches_parent ON public.mandi_harvest_lifecycle_transitions;
DROP TRIGGER IF EXISTS trg_verify_log_has_transition_history ON public.mandi_harvest_execution_log;
DROP TRIGGER IF EXISTS trg_enforce_mandi_harvest_update ON public.mandi_harvest_execution_log;
DROP TRIGGER IF EXISTS trg_enforce_mandi_harvest_insert ON public.mandi_harvest_execution_log;

DROP FUNCTION IF EXISTS public.fn_mandi_record_lifecycle_transition(
  VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR,
  INTEGER, INTEGER, VARCHAR, VARCHAR, VARCHAR,
  TEXT, VARCHAR, JSONB, JSONB, TEXT
);
DROP FUNCTION IF EXISTS public.fn_mandi_update_batch_metadata(VARCHAR, INTEGER, TEXT, TEXT);

DROP FUNCTION IF EXISTS public.prevent_append_only_history_mutation();
DROP FUNCTION IF EXISTS public.verify_recovery_event_matches_transition();
DROP FUNCTION IF EXISTS public.verify_transition_history_matches_parent();
DROP FUNCTION IF EXISTS public.verify_mandi_harvest_log_has_history();
DROP FUNCTION IF EXISTS public.enforce_mandi_harvest_log_contracts();
DROP FUNCTION IF EXISTS public.enforce_mandi_harvest_insert_contracts();

DROP TABLE IF EXISTS public.mandi_harvest_recovery_events;
DROP TABLE IF EXISTS public.mandi_harvest_lifecycle_transitions;
DROP TABLE IF EXISTS public.mandi_harvest_execution_log;

