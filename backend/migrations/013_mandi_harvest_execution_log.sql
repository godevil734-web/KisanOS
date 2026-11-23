-- Migration 013: Durable Daily Mandi Collection Audit Infrastructure (Milestone F.1.4 / F.1.5)
-- Follows approved Design v2.2.9:
--   - Exact 9-field transition identity binding + RFC 8785 JCS SHA-256 IDs
--   - Bilateral DEFERRABLE INITIALLY DEFERRED atomic history & bidirectional recovery-event checks
--   - Hardened SECURITY DEFINER gateway functions owned by postgres with SET search_path = pg_catalog, pg_temp
--   - Revoked direct table writes from PUBLIC, anon, authenticated, ml_engine_readonly, and service_role

-- ---------------------------------------------------------------------------
-- 1. Current Batch State Table: public.mandi_harvest_execution_log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mandi_harvest_execution_log (
  harvest_batch_id VARCHAR(100) PRIMARY KEY,
  collection_window VARCHAR(40) NOT NULL,
  target_observation_date DATE DEFAULT NULL,
  ogd_publication_timestamp TIMESTAMPTZ DEFAULT NULL,
  execution_start_utc TIMESTAMPTZ NOT NULL,
  execution_start_ist VARCHAR(40) NOT NULL,
  execution_end_utc TIMESTAMPTZ DEFAULT NULL,
  execution_end_ist VARCHAR(40) DEFAULT NULL,
  api_reported_total INTEGER DEFAULT NULL CHECK (api_reported_total IS NULL OR api_reported_total >= 0),

  -- Nullable raw feed counters: strictly NULL when irrecoverably lost post-crash
  records_fetched INTEGER DEFAULT NULL CHECK (records_fetched IS NULL OR records_fetched >= 0),
  records_parsed INTEGER DEFAULT NULL CHECK (records_parsed IS NULL OR records_parsed >= 0),
  records_inserted INTEGER DEFAULT NULL CHECK (records_inserted IS NULL OR records_inserted >= 0),
  records_updated INTEGER DEFAULT NULL CHECK (records_updated IS NULL OR records_updated >= 0),
  records_skipped INTEGER DEFAULT NULL CHECK (records_skipped IS NULL OR records_skipped >= 0),
  records_rejected INTEGER DEFAULT NULL CHECK (records_rejected IS NULL OR records_rejected >= 0),
  duplicate_count INTEGER DEFAULT NULL CHECK (duplicate_count IS NULL OR duplicate_count >= 0),
  distinct_states INTEGER DEFAULT NULL CHECK (distinct_states IS NULL OR distinct_states >= 0),
  distinct_markets INTEGER DEFAULT NULL CHECK (distinct_markets IS NULL OR distinct_markets >= 0),
  distinct_commodities INTEGER DEFAULT NULL CHECK (distinct_commodities IS NULL OR distinct_commodities >= 0),

  gates JSONB NOT NULL DEFAULT '{}'::jsonb,
  final_validation_status VARCHAR(64) NOT NULL,
  execution_status VARCHAR(64) NOT NULL,
  observations_committed BOOLEAN NOT NULL DEFAULT FALSE,
  audit_persisted BOOLEAN NOT NULL DEFAULT FALSE,
  fully_certified BOOLEAN NOT NULL DEFAULT FALSE,
  audit_lifecycle_state VARCHAR(64) NOT NULL,
  error_details TEXT DEFAULT NULL,
  diagnostic_notes TEXT DEFAULT NULL,

  -- Canonical Monotonic State Rank & Optimistic Version
  state_rank INTEGER NOT NULL,
  state_version INTEGER NOT NULL DEFAULT 1 CHECK (state_version >= 1),
  last_transition_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),

  -- Recovery Summary Flags
  is_recovered BOOLEAN NOT NULL DEFAULT FALSE,
  last_recovered_at TIMESTAMPTZ DEFAULT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),

  CONSTRAINT chk_mandi_harvest_canonical_rank CHECK (
    (audit_lifecycle_state = 'OBSERVATIONS_COMMITTED' AND state_rank = 10) OR
    (audit_lifecycle_state = 'AUDIT_PERSIST_FAILED_AFTER_COMMIT' AND state_rank = 15) OR
    (audit_lifecycle_state = 'REJECTED_AUDIT_FAILED' AND state_rank = 15) OR
    (audit_lifecycle_state = 'AUDIT_RECOVERY_REQUIRED' AND state_rank = 20) OR
    (audit_lifecycle_state = 'REJECTED_AUDIT_PERSISTED' AND state_rank = 30) OR
    (audit_lifecycle_state = 'COLLECTION_FULLY_CERTIFIED' AND state_rank = 40)
  ),

  CONSTRAINT chk_mandi_harvest_certified_invariant CHECK (
    NOT fully_certified OR (
      observations_committed = TRUE
      AND audit_persisted = TRUE
      AND execution_status = 'SUCCESS'
      AND audit_lifecycle_state = 'COLLECTION_FULLY_CERTIFIED'
      AND state_rank = 40
    )
  ),

  CONSTRAINT chk_mandi_harvest_recovery_uncertified CHECK (
    audit_lifecycle_state != 'AUDIT_RECOVERY_REQUIRED'
    OR (fully_certified = FALSE AND state_rank = 20)
  )
);

CREATE INDEX IF NOT EXISTS idx_mandi_harvest_certified_lookup
ON public.mandi_harvest_execution_log (target_observation_date, collection_window, execution_end_utc DESC)
WHERE fully_certified = TRUE
  AND audit_persisted = TRUE
  AND observations_committed = TRUE
  AND execution_status = 'SUCCESS'
  AND audit_lifecycle_state = 'COLLECTION_FULLY_CERTIFIED';

CREATE INDEX IF NOT EXISTS idx_mandi_harvest_baseline_lookup
ON public.mandi_harvest_execution_log (target_observation_date DESC, execution_end_utc DESC)
WHERE observations_committed = TRUE
  AND execution_status IN ('SUCCESS', 'SUCCESS_INVESTIGATION_NEEDED');

CREATE INDEX IF NOT EXISTS idx_mandi_harvest_lifecycle_state
ON public.mandi_harvest_execution_log (audit_lifecycle_state, state_version DESC, last_transition_at DESC);

-- ---------------------------------------------------------------------------
-- 2. Complete Append-Only Transition History: public.mandi_harvest_lifecycle_transitions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mandi_harvest_lifecycle_transitions (
  transition_id VARCHAR(64) PRIMARY KEY CHECK (transition_id ~ '^[0-9a-f]{64}$'),
  harvest_batch_id VARCHAR(100) NOT NULL
    REFERENCES public.mandi_harvest_execution_log(harvest_batch_id) ON DELETE RESTRICT,
  transition_kind VARCHAR(30) NOT NULL CHECK (transition_kind IN ('NORMAL_COLLECTION', 'RECOVERY')),
  previous_lifecycle_state VARCHAR(64) DEFAULT NULL,
  new_lifecycle_state VARCHAR(64) NOT NULL,
  previous_state_version INTEGER NOT NULL CHECK (previous_state_version >= 0),
  resulting_state_version INTEGER NOT NULL CHECK (resulting_state_version >= 1),

  transition_event_id VARCHAR(64) NOT NULL UNIQUE CHECK (transition_event_id ~ '^[0-9a-f]{64}$'),
  evidence_checksum VARCHAR(64) NOT NULL CHECK (evidence_checksum ~ '^[0-9a-f]{64}$'),
  transition_reason TEXT NOT NULL,
  actor_or_source VARCHAR(120) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),

  CONSTRAINT chk_transition_contiguous_step CHECK (resulting_state_version = previous_state_version + 1),
  CONSTRAINT uq_transition_batch_prev_version UNIQUE (harvest_batch_id, previous_state_version),
  CONSTRAINT uq_transition_batch_res_version UNIQUE (harvest_batch_id, resulting_state_version),

  CONSTRAINT uq_transition_recovery_binding UNIQUE (
    transition_id,
    harvest_batch_id,
    new_lifecycle_state,
    resulting_state_version,
    transition_event_id,
    evidence_checksum
  )
);

CREATE INDEX IF NOT EXISTS idx_mandi_transitions_batch_chain
ON public.mandi_harvest_lifecycle_transitions (harvest_batch_id, resulting_state_version ASC);

-- ---------------------------------------------------------------------------
-- 3. Append-Only Recovery Event Log: public.mandi_harvest_recovery_events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mandi_harvest_recovery_events (
  recovery_event_id VARCHAR(64) PRIMARY KEY CHECK (recovery_event_id ~ '^[0-9a-f]{64}$'),
  transition_id VARCHAR(64) NOT NULL CHECK (transition_id ~ '^[0-9a-f]{64}$'),
  transition_event_id VARCHAR(64) NOT NULL CHECK (transition_event_id ~ '^[0-9a-f]{64}$'),
  harvest_batch_id VARCHAR(100) NOT NULL,
  recovery_method VARCHAR(50) NOT NULL,
  from_lifecycle_state VARCHAR(64) DEFAULT NULL,
  to_lifecycle_state VARCHAR(64) NOT NULL,
  expected_state_version INTEGER DEFAULT NULL CHECK (expected_state_version IS NULL OR expected_state_version >= 0),
  resulting_state_version INTEGER NOT NULL CHECK (resulting_state_version >= 1),
  evidence_checksum VARCHAR(64) NOT NULL CHECK (evidence_checksum ~ '^[0-9a-f]{64}$'),
  evidence_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_or_worker VARCHAR(120) NOT NULL,
  recovery_notes TEXT DEFAULT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),

  CONSTRAINT uq_recovery_event_unique_transition
    UNIQUE (transition_id),

  CONSTRAINT uq_recovery_event_batch_version
    UNIQUE (harvest_batch_id, resulting_state_version),

  CONSTRAINT chk_recovery_event_equals_transition_event
    CHECK (recovery_event_id = transition_event_id),

  CONSTRAINT fk_recovery_exact_transition_binding
    FOREIGN KEY (
      transition_id,
      harvest_batch_id,
      to_lifecycle_state,
      resulting_state_version,
      transition_event_id,
      evidence_checksum
    )
    REFERENCES public.mandi_harvest_lifecycle_transitions (
      transition_id,
      harvest_batch_id,
      new_lifecycle_state,
      resulting_state_version,
      transition_event_id,
      evidence_checksum
    )
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_mandi_recovery_events_batch
ON public.mandi_harvest_recovery_events (harvest_batch_id, occurred_at ASC);

-- ---------------------------------------------------------------------------
-- 4. Enforcement & Integrity Trigger Functions (Hardened search_path)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_mandi_harvest_insert_contracts()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF NEW.state_version != 1 THEN
    RAISE EXCEPTION 'Initial INSERT on batch % must set state_version = 1 (got %)',
      NEW.harvest_batch_id, NEW.state_version
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF NEW.audit_lifecycle_state NOT IN (
    'OBSERVATIONS_COMMITTED',
    'COLLECTION_FULLY_CERTIFIED',
    'REJECTED_AUDIT_PERSISTED',
    'AUDIT_PERSIST_FAILED_AFTER_COMMIT',
    'REJECTED_AUDIT_FAILED',
    'AUDIT_RECOVERY_REQUIRED'
  ) THEN
    RAISE EXCEPTION 'Prohibited initial lifecycle state % on batch %',
      NEW.audit_lifecycle_state, NEW.harvest_batch_id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_mandi_harvest_insert ON public.mandi_harvest_execution_log;
CREATE TRIGGER trg_enforce_mandi_harvest_insert
BEFORE INSERT ON public.mandi_harvest_execution_log
FOR EACH ROW EXECUTE FUNCTION public.enforce_mandi_harvest_insert_contracts();

CREATE OR REPLACE FUNCTION public.enforce_mandi_harvest_log_contracts()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_is_lifecycle_transition BOOLEAN;
  v_is_permitted_pair BOOLEAN := FALSE;
  v_is_terminal BOOLEAN;
BEGIN
  IF NEW.harvest_batch_id IS DISTINCT FROM OLD.harvest_batch_id
     OR NEW.collection_window IS DISTINCT FROM OLD.collection_window
     OR NEW.execution_start_utc IS DISTINCT FROM OLD.execution_start_utc
     OR NEW.execution_start_ist IS DISTINCT FROM OLD.execution_start_ist
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Cannot modify immutable identity fields on batch %', OLD.harvest_batch_id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  v_is_terminal := OLD.audit_lifecycle_state IN ('COLLECTION_FULLY_CERTIFIED', 'REJECTED_AUDIT_PERSISTED')
                   OR OLD.fully_certified = TRUE;
  v_is_lifecycle_transition := (NEW.audit_lifecycle_state IS DISTINCT FROM OLD.audit_lifecycle_state);

  IF v_is_lifecycle_transition THEN
    IF v_is_terminal THEN
      RAISE EXCEPTION 'Terminal immutability violation: cannot transition out of % for batch %',
        OLD.audit_lifecycle_state, OLD.harvest_batch_id
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    v_is_permitted_pair := (
      (OLD.audit_lifecycle_state = 'OBSERVATIONS_COMMITTED' AND NEW.audit_lifecycle_state = 'COLLECTION_FULLY_CERTIFIED') OR
      (OLD.audit_lifecycle_state = 'OBSERVATIONS_COMMITTED' AND NEW.audit_lifecycle_state = 'AUDIT_PERSIST_FAILED_AFTER_COMMIT') OR
      (OLD.audit_lifecycle_state = 'AUDIT_PERSIST_FAILED_AFTER_COMMIT' AND NEW.audit_lifecycle_state = 'COLLECTION_FULLY_CERTIFIED') OR
      (OLD.audit_lifecycle_state = 'REJECTED_AUDIT_FAILED' AND NEW.audit_lifecycle_state = 'REJECTED_AUDIT_PERSISTED') OR
      (OLD.audit_lifecycle_state = 'AUDIT_RECOVERY_REQUIRED' AND NEW.audit_lifecycle_state = 'COLLECTION_FULLY_CERTIFIED')
    );

    IF NOT v_is_permitted_pair THEN
      RAISE EXCEPTION 'Prohibited lifecycle transition (% -> %) on batch %',
        OLD.audit_lifecycle_state, NEW.audit_lifecycle_state, OLD.harvest_batch_id
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    IF NEW.state_rank <= OLD.state_rank THEN
      RAISE EXCEPTION 'State rank must increase monotonically (% -> %) on batch %',
        OLD.state_rank, NEW.state_rank, OLD.harvest_batch_id
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    IF NEW.state_version != OLD.state_version + 1 THEN
      RAISE EXCEPTION 'Contract A requires exact state_version increment (% -> %) on batch %',
        OLD.state_version, NEW.state_version, OLD.harvest_batch_id
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    IF OLD.observations_committed = TRUE AND NEW.observations_committed = FALSE THEN
      RAISE EXCEPTION 'Cannot revert observations_committed from TRUE to FALSE on batch %', OLD.harvest_batch_id
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    RETURN NEW;
  END IF;

  -- Contract B (Metadata-Only Update)
  IF NEW.state_rank IS DISTINCT FROM OLD.state_rank
     OR NEW.state_version IS DISTINCT FROM OLD.state_version
     OR NEW.last_transition_at IS DISTINCT FROM OLD.last_transition_at THEN
    RAISE EXCEPTION 'Contract B violation: metadata-only updates cannot change state_rank, state_version, or last_transition_at on batch %',
      OLD.harvest_batch_id USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF NEW.target_observation_date IS DISTINCT FROM OLD.target_observation_date
     OR NEW.ogd_publication_timestamp IS DISTINCT FROM OLD.ogd_publication_timestamp
     OR NEW.execution_end_utc IS DISTINCT FROM OLD.execution_end_utc
     OR NEW.execution_end_ist IS DISTINCT FROM OLD.execution_end_ist
     OR NEW.api_reported_total IS DISTINCT FROM OLD.api_reported_total
     OR NEW.records_fetched IS DISTINCT FROM OLD.records_fetched
     OR NEW.records_parsed IS DISTINCT FROM OLD.records_parsed
     OR NEW.records_inserted IS DISTINCT FROM OLD.records_inserted
     OR NEW.records_updated IS DISTINCT FROM OLD.records_updated
     OR NEW.records_skipped IS DISTINCT FROM OLD.records_skipped
     OR NEW.records_rejected IS DISTINCT FROM OLD.records_rejected
     OR NEW.duplicate_count IS DISTINCT FROM OLD.duplicate_count
     OR NEW.distinct_states IS DISTINCT FROM OLD.distinct_states
     OR NEW.distinct_markets IS DISTINCT FROM OLD.distinct_markets
     OR NEW.distinct_commodities IS DISTINCT FROM OLD.distinct_commodities
     OR NEW.gates IS DISTINCT FROM OLD.gates
     OR NEW.final_validation_status IS DISTINCT FROM OLD.final_validation_status
     OR NEW.execution_status IS DISTINCT FROM OLD.execution_status
     OR NEW.observations_committed IS DISTINCT FROM OLD.observations_committed
     OR NEW.audit_persisted IS DISTINCT FROM OLD.audit_persisted
     OR NEW.fully_certified IS DISTINCT FROM OLD.fully_certified
     OR NEW.is_recovered IS DISTINCT FROM OLD.is_recovered
     OR NEW.last_recovered_at IS DISTINCT FROM OLD.last_recovered_at THEN
    RAISE EXCEPTION 'Contract B violation: protected execution or certification fields cannot be modified on batch %',
      OLD.harvest_batch_id USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF v_is_terminal AND NEW.error_details IS DISTINCT FROM OLD.error_details THEN
    RAISE EXCEPTION 'Terminal record protection: cannot modify error_details on terminal batch %', OLD.harvest_batch_id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_mandi_harvest_update ON public.mandi_harvest_execution_log;
CREATE TRIGGER trg_enforce_mandi_harvest_update
BEFORE UPDATE ON public.mandi_harvest_execution_log
FOR EACH ROW EXECUTE FUNCTION public.enforce_mandi_harvest_log_contracts();

CREATE OR REPLACE FUNCTION public.verify_mandi_harvest_log_has_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_expected_prev_state VARCHAR(64);
  v_expected_prev_ver INTEGER;
  v_intent_key TEXT;
  v_intents JSONB;
  v_intent JSONB;
  v_match_count INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.audit_lifecycle_state IS NOT DISTINCT FROM OLD.audit_lifecycle_state THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_expected_prev_state := NULL;
    v_expected_prev_ver := 0;
  ELSE
    v_expected_prev_state := OLD.audit_lifecycle_state;
    v_expected_prev_ver := OLD.state_version;
  END IF;

  v_intent_key := NEW.harvest_batch_id || ':' || NEW.state_version::text;
  v_intents := NULLIF(pg_catalog.current_setting('kisanos.expected_transition_intents', true), '')::jsonb;
  v_intent := CASE WHEN v_intents IS NOT NULL THEN v_intents -> v_intent_key ELSE NULL END;

  IF v_intent IS NULL THEN
    RAISE EXCEPTION 'Unauthorized direct lifecycle write on batch % (v% -> v%): missing write-boundary intent',
      NEW.harvest_batch_id, v_expected_prev_ver, NEW.state_version
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  SELECT COUNT(*) INTO v_match_count
  FROM public.mandi_harvest_lifecycle_transitions t
  WHERE t.transition_id = v_intent->>'transition_id'
    AND t.transition_event_id = v_intent->>'transition_event_id'
    AND t.evidence_checksum = v_intent->>'evidence_checksum'
    AND t.transition_kind = v_intent->>'transition_kind'
    AND t.harvest_batch_id = NEW.harvest_batch_id
    AND t.harvest_batch_id = v_intent->>'harvest_batch_id'
    AND t.previous_lifecycle_state IS NOT DISTINCT FROM v_expected_prev_state
    AND t.previous_lifecycle_state IS NOT DISTINCT FROM NULLIF(v_intent->>'previous_lifecycle_state', '')
    AND t.new_lifecycle_state = NEW.audit_lifecycle_state
    AND t.new_lifecycle_state = v_intent->>'new_lifecycle_state'
    AND t.previous_state_version = v_expected_prev_ver
    AND t.previous_state_version = (v_intent->>'previous_state_version')::integer
    AND t.resulting_state_version = NEW.state_version
    AND t.resulting_state_version = (v_intent->>'resulting_state_version')::integer;

  IF v_match_count != 1 THEN
    RAISE EXCEPTION 'Exact 9-field transition identity verification failed on batch % (v% -> v%): found % matching history rows',
      NEW.harvest_batch_id, v_expected_prev_ver, NEW.state_version, v_match_count
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_verify_log_has_transition_history ON public.mandi_harvest_execution_log;
CREATE CONSTRAINT TRIGGER trg_verify_log_has_transition_history
AFTER INSERT OR UPDATE ON public.mandi_harvest_execution_log
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.verify_mandi_harvest_log_has_history();

CREATE OR REPLACE FUNCTION public.verify_transition_history_matches_parent()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_parent public.mandi_harvest_execution_log%ROWTYPE;
  v_prev_state VARCHAR(64);
  v_is_valid_transition BOOLEAN := FALSE;
  v_exact_recovery_count INTEGER;
  v_any_recovery_count INTEGER;
  v_intent_key TEXT;
  v_intents JSONB;
  v_intent JSONB;
BEGIN
  IF NEW.transition_id !~ '^[0-9a-f]{64}$'
     OR NEW.transition_event_id !~ '^[0-9a-f]{64}$'
     OR NEW.evidence_checksum !~ '^[0-9a-f]{64}$'
     OR NEW.transition_id = NEW.transition_event_id THEN
    RAISE EXCEPTION 'Invalid or degenerate canonical identifier format on batch %', NEW.harvest_batch_id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF NEW.previous_state_version < 0 OR NEW.resulting_state_version != NEW.previous_state_version + 1 THEN
    RAISE EXCEPTION 'Version continuity violation (% -> %) on batch %',
      NEW.previous_state_version, NEW.resulting_state_version, NEW.harvest_batch_id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  v_intent_key := NEW.harvest_batch_id || ':' || NEW.resulting_state_version::text;
  v_intents := NULLIF(pg_catalog.current_setting('kisanos.expected_transition_intents', true), '')::jsonb;
  v_intent := CASE WHEN v_intents IS NOT NULL THEN v_intents -> v_intent_key ELSE NULL END;

  IF v_intent IS NULL
     OR NEW.transition_id IS DISTINCT FROM (v_intent->>'transition_id')
     OR NEW.transition_event_id IS DISTINCT FROM (v_intent->>'transition_event_id')
     OR NEW.evidence_checksum IS DISTINCT FROM (v_intent->>'evidence_checksum')
     OR NEW.transition_kind IS DISTINCT FROM (v_intent->>'transition_kind')
     OR NEW.harvest_batch_id IS DISTINCT FROM (v_intent->>'harvest_batch_id')
     OR NEW.previous_lifecycle_state IS DISTINCT FROM NULLIF(v_intent->>'previous_lifecycle_state', '')
     OR NEW.new_lifecycle_state IS DISTINCT FROM (v_intent->>'new_lifecycle_state')
     OR NEW.previous_state_version IS DISTINCT FROM (v_intent->>'previous_state_version')::integer
     OR NEW.resulting_state_version IS DISTINCT FROM (v_intent->>'resulting_state_version')::integer THEN
    RAISE EXCEPTION 'Transition history row violates bound transaction intent on batch % at v%',
      NEW.harvest_batch_id, NEW.resulting_state_version
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  SELECT * INTO v_parent
  FROM public.mandi_harvest_execution_log
  WHERE harvest_batch_id = NEW.harvest_batch_id;

  IF NOT FOUND OR NEW.resulting_state_version > v_parent.state_version THEN
    RAISE EXCEPTION 'Spurious transition history row on batch % at v% exceeds parent state_version %',
      NEW.harvest_batch_id, NEW.resulting_state_version, COALESCE(v_parent.state_version, 0)
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF NEW.resulting_state_version = 1 THEN
    IF NEW.previous_state_version != 0 OR NEW.previous_lifecycle_state IS NOT NULL THEN
      RAISE EXCEPTION 'Initial v0 -> v1 transition for batch % requires previous_state_version=0 and NULL previous_lifecycle_state',
        NEW.harvest_batch_id USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    v_is_valid_transition := (
      (NEW.transition_kind = 'NORMAL_COLLECTION' AND NEW.new_lifecycle_state IN (
        'OBSERVATIONS_COMMITTED',
        'COLLECTION_FULLY_CERTIFIED',
        'REJECTED_AUDIT_PERSISTED',
        'AUDIT_PERSIST_FAILED_AFTER_COMMIT',
        'REJECTED_AUDIT_FAILED'
      )) OR
      (NEW.transition_kind = 'RECOVERY' AND NEW.new_lifecycle_state = 'AUDIT_RECOVERY_REQUIRED')
    );
  ELSE
    SELECT new_lifecycle_state INTO v_prev_state
    FROM public.mandi_harvest_lifecycle_transitions
    WHERE harvest_batch_id = NEW.harvest_batch_id
      AND resulting_state_version = NEW.resulting_state_version - 1;

    IF NOT FOUND OR v_prev_state IS DISTINCT FROM NEW.previous_lifecycle_state THEN
      RAISE EXCEPTION 'Broken previous/new lifecycle continuity on batch % at v% -> v%',
        NEW.harvest_batch_id, NEW.previous_state_version, NEW.resulting_state_version
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    v_is_valid_transition := (
      (NEW.transition_kind = 'NORMAL_COLLECTION' AND (
        (NEW.previous_lifecycle_state = 'OBSERVATIONS_COMMITTED' AND NEW.new_lifecycle_state = 'COLLECTION_FULLY_CERTIFIED') OR
        (NEW.previous_lifecycle_state = 'OBSERVATIONS_COMMITTED' AND NEW.new_lifecycle_state = 'AUDIT_PERSIST_FAILED_AFTER_COMMIT')
      )) OR
      (NEW.transition_kind = 'RECOVERY' AND (
        (NEW.previous_lifecycle_state = 'AUDIT_PERSIST_FAILED_AFTER_COMMIT' AND NEW.new_lifecycle_state = 'COLLECTION_FULLY_CERTIFIED') OR
        (NEW.previous_lifecycle_state = 'REJECTED_AUDIT_FAILED' AND NEW.new_lifecycle_state = 'REJECTED_AUDIT_PERSISTED') OR
        (NEW.previous_lifecycle_state = 'AUDIT_RECOVERY_REQUIRED' AND NEW.new_lifecycle_state = 'COLLECTION_FULLY_CERTIFIED')
      ))
    );
  END IF;

  IF NOT v_is_valid_transition THEN
    RAISE EXCEPTION 'Prohibited transition pair/kind (%: % -> %) in transition history on batch %',
      NEW.transition_kind, COALESCE(NEW.previous_lifecycle_state, 'NULL'), NEW.new_lifecycle_state, NEW.harvest_batch_id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF NEW.resulting_state_version = v_parent.state_version
     AND NEW.new_lifecycle_state IS DISTINCT FROM v_parent.audit_lifecycle_state THEN
    RAISE EXCEPTION 'Tip transition state (%) mismatches parent state (%) on batch %',
      NEW.new_lifecycle_state, v_parent.audit_lifecycle_state, NEW.harvest_batch_id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  -- Bidirectional order-independent recovery-event cardinality & match check at COMMIT
  SELECT COUNT(*) INTO v_any_recovery_count
  FROM public.mandi_harvest_recovery_events r
  WHERE r.transition_id = NEW.transition_id
     OR r.recovery_event_id = NEW.transition_event_id
     OR r.transition_event_id = NEW.transition_event_id
     OR (r.harvest_batch_id = NEW.harvest_batch_id AND r.resulting_state_version = NEW.resulting_state_version);

  IF NEW.transition_kind = 'RECOVERY' THEN
    SELECT COUNT(*) INTO v_exact_recovery_count
    FROM public.mandi_harvest_recovery_events r
    WHERE r.transition_id = NEW.transition_id
      AND r.recovery_event_id = NEW.transition_event_id
      AND r.transition_event_id = NEW.transition_event_id
      AND r.harvest_batch_id = NEW.harvest_batch_id
      AND r.from_lifecycle_state IS NOT DISTINCT FROM NEW.previous_lifecycle_state
      AND r.to_lifecycle_state = NEW.new_lifecycle_state
      AND COALESCE(r.expected_state_version, 0) = NEW.previous_state_version
      AND r.resulting_state_version = NEW.resulting_state_version
      AND r.evidence_checksum = NEW.evidence_checksum;

    IF v_exact_recovery_count != 1 OR v_any_recovery_count != 1 THEN
      RAISE EXCEPTION 'Atomic recovery-event violation on batch % v%: RECOVERY transition requires exact 1:1 recovery_event (exact=%, total=%)',
        NEW.harvest_batch_id, NEW.resulting_state_version, v_exact_recovery_count, v_any_recovery_count
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  ELSIF v_any_recovery_count != 0 THEN
    RAISE EXCEPTION 'Atomic recovery-event violation on batch % v%: NORMAL_COLLECTION transition prohibits recovery_event rows (found %)',
      NEW.harvest_batch_id, NEW.resulting_state_version, v_any_recovery_count
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_verify_transition_matches_parent ON public.mandi_harvest_lifecycle_transitions;
CREATE CONSTRAINT TRIGGER trg_verify_transition_matches_parent
AFTER INSERT ON public.mandi_harvest_lifecycle_transitions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.verify_transition_history_matches_parent();

CREATE OR REPLACE FUNCTION public.verify_recovery_event_matches_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_trans public.mandi_harvest_lifecycle_transitions%ROWTYPE;
  v_sibling_count INTEGER;
BEGIN
  IF NEW.recovery_event_id IS DISTINCT FROM NEW.transition_event_id THEN
    RAISE EXCEPTION 'Recovery event % mismatches transition_event_id %',
      NEW.recovery_event_id, NEW.transition_event_id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  SELECT * INTO v_trans
  FROM public.mandi_harvest_lifecycle_transitions
  WHERE transition_id = NEW.transition_id
    AND harvest_batch_id = NEW.harvest_batch_id
    AND new_lifecycle_state = NEW.to_lifecycle_state
    AND resulting_state_version = NEW.resulting_state_version
    AND transition_event_id = NEW.transition_event_id
    AND evidence_checksum = NEW.evidence_checksum;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recovery event % references missing or mismatched transition %',
      NEW.recovery_event_id, NEW.transition_id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF v_trans.transition_kind != 'RECOVERY' THEN
    RAISE EXCEPTION 'Recovery event % cannot attach to non-RECOVERY transition % (kind=%)',
      NEW.recovery_event_id, NEW.transition_id, v_trans.transition_kind
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  SELECT COUNT(*) INTO v_sibling_count
  FROM public.mandi_harvest_recovery_events r
  WHERE r.transition_id = NEW.transition_id
     OR (r.harvest_batch_id = NEW.harvest_batch_id AND r.resulting_state_version = NEW.resulting_state_version);

  IF v_sibling_count != 1 THEN
    RAISE EXCEPTION 'Duplicate or extra recovery event detected for batch % v% / transition % (count=%)',
      NEW.harvest_batch_id, NEW.resulting_state_version, NEW.transition_id, v_sibling_count
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF NEW.from_lifecycle_state IS DISTINCT FROM v_trans.previous_lifecycle_state
     OR COALESCE(NEW.expected_state_version, 0) != v_trans.previous_state_version
     OR (v_trans.resulting_state_version = 1 AND NEW.expected_state_version IS NOT NULL)
     OR (v_trans.resulting_state_version > 1 AND NEW.expected_state_version != v_trans.previous_state_version) THEN
    RAISE EXCEPTION 'Recovery event % origin metadata mismatches transition %',
      NEW.recovery_event_id, NEW.transition_id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF NOT (
    (v_trans.previous_lifecycle_state IS NULL AND v_trans.new_lifecycle_state = 'AUDIT_RECOVERY_REQUIRED' AND NEW.recovery_method = 'ORPHAN_RECONCILIATION') OR
    (v_trans.previous_lifecycle_state = 'AUDIT_PERSIST_FAILED_AFTER_COMMIT' AND v_trans.new_lifecycle_state = 'COLLECTION_FULLY_CERTIFIED' AND NEW.recovery_method = 'PAYLOAD_REPLAY') OR
    (v_trans.previous_lifecycle_state = 'REJECTED_AUDIT_FAILED' AND v_trans.new_lifecycle_state = 'REJECTED_AUDIT_PERSISTED' AND NEW.recovery_method = 'PAYLOAD_REPLAY') OR
    (v_trans.previous_lifecycle_state = 'AUDIT_RECOVERY_REQUIRED' AND v_trans.new_lifecycle_state = 'COLLECTION_FULLY_CERTIFIED' AND NEW.recovery_method = 'EVIDENCE_REVERIFICATION')
  ) THEN
    RAISE EXCEPTION 'Mismatched recovery_method % for transition (% -> %)',
      NEW.recovery_method, COALESCE(v_trans.previous_lifecycle_state, 'NULL'), v_trans.new_lifecycle_state
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_verify_recovery_event_matches_transition ON public.mandi_harvest_recovery_events;
CREATE CONSTRAINT TRIGGER trg_verify_recovery_event_matches_transition
AFTER INSERT ON public.mandi_harvest_recovery_events
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.verify_recovery_event_matches_transition();

CREATE OR REPLACE FUNCTION public.prevent_append_only_history_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Append-only audit table % prohibits % operations', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_immutable_lifecycle_transitions ON public.mandi_harvest_lifecycle_transitions;
CREATE TRIGGER trg_immutable_lifecycle_transitions
BEFORE UPDATE OR DELETE ON public.mandi_harvest_lifecycle_transitions
FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_history_mutation();

DROP TRIGGER IF EXISTS trg_immutable_recovery_events ON public.mandi_harvest_recovery_events;
CREATE TRIGGER trg_immutable_recovery_events
BEFORE UPDATE OR DELETE ON public.mandi_harvest_recovery_events
FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_history_mutation();

-- ---------------------------------------------------------------------------
-- 5. Hardened SECURITY DEFINER Gateway Functions (Complete Executable SQL)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_mandi_record_lifecycle_transition(
  p_harvest_batch_id VARCHAR(100),
  p_transition_kind VARCHAR(30),
  p_operation_kind VARCHAR(50),
  p_from_lifecycle_state VARCHAR(64),
  p_to_lifecycle_state VARCHAR(64),
  p_expected_state_version INTEGER,
  p_resulting_state_version INTEGER,
  p_transition_event_id VARCHAR(64),
  p_transition_id VARCHAR(64),
  p_evidence_checksum VARCHAR(64),
  p_transition_reason TEXT,
  p_actor_or_source VARCHAR(120),
  p_telemetry JSONB DEFAULT '{}'::jsonb,
  p_recovery_evidence_summary JSONB DEFAULT NULL,
  p_recovery_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  outcome VARCHAR(32),
  harvest_batch_id VARCHAR(100),
  audit_lifecycle_state VARCHAR(64),
  state_rank INTEGER,
  state_version INTEGER,
  transition_id VARCHAR(64),
  transition_event_id VARCHAR(64)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_parent public.mandi_harvest_execution_log%ROWTYPE;
  v_existing_trans public.mandi_harvest_lifecycle_transitions%ROWTYPE;
  v_target_rank INTEGER;
  v_expected_prev_ver INTEGER;
  v_existing_intents JSONB;
  v_intent_key TEXT;
  v_intent_payload JSONB;
  v_tel JSONB := COALESCE(p_telemetry, '{}'::jsonb);
  v_now TIMESTAMPTZ := pg_catalog.now();
BEGIN
  IF p_harvest_batch_id IS NULL OR pg_catalog.btrim(p_harvest_batch_id) = '' THEN
    RAISE EXCEPTION 'harvest_batch_id must be a non-empty string' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_transition_id !~ '^[0-9a-f]{64}$'
     OR p_transition_event_id !~ '^[0-9a-f]{64}$'
     OR p_evidence_checksum !~ '^[0-9a-f]{64}$'
     OR p_transition_id = p_transition_event_id THEN
    RAISE EXCEPTION 'Invalid canonical SHA-256 hex identity passed to transition gateway'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  IF p_transition_kind = 'NORMAL_COLLECTION' AND p_operation_kind != 'NORMAL_COLLECTION' THEN
    RAISE EXCEPTION 'NORMAL_COLLECTION transition requires operation_kind=NORMAL_COLLECTION (got %)', p_operation_kind
      USING ERRCODE = 'integrity_constraint_violation';
  ELSIF p_transition_kind = 'RECOVERY' AND p_operation_kind NOT IN ('PAYLOAD_REPLAY', 'ORPHAN_RECONCILIATION', 'EVIDENCE_REVERIFICATION') THEN
    RAISE EXCEPTION 'RECOVERY transition requires valid recovery operation_kind (got %)', p_operation_kind
      USING ERRCODE = 'integrity_constraint_violation';
  ELSIF p_transition_kind NOT IN ('NORMAL_COLLECTION', 'RECOVERY') THEN
    RAISE EXCEPTION 'Unsupported transition_kind %', p_transition_kind
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  v_target_rank := CASE p_to_lifecycle_state
    WHEN 'OBSERVATIONS_COMMITTED' THEN 10
    WHEN 'AUDIT_PERSIST_FAILED_AFTER_COMMIT' THEN 15
    WHEN 'REJECTED_AUDIT_FAILED' THEN 15
    WHEN 'AUDIT_RECOVERY_REQUIRED' THEN 20
    WHEN 'REJECTED_AUDIT_PERSISTED' THEN 30
    WHEN 'COLLECTION_FULLY_CERTIFIED' THEN 40
    ELSE NULL
  END;

  IF v_target_rank IS NULL THEN
    RAISE EXCEPTION 'Unrecognized target lifecycle state %', p_to_lifecycle_state
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  v_expected_prev_ver := COALESCE(p_expected_state_version, 0);
  IF p_resulting_state_version IS NULL OR p_resulting_state_version != v_expected_prev_ver + 1 THEN
    RAISE EXCEPTION 'Invalid resulting_state_version % for expected previous version %',
      p_resulting_state_version, v_expected_prev_ver
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  -- Serialize all concurrent normal and recovery workers per harvest_batch_id (64-bit xact lock)
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_harvest_batch_id, 0));

  SELECT * INTO v_parent
  FROM public.mandi_harvest_execution_log l
  WHERE l.harvest_batch_id = p_harvest_batch_id
  FOR UPDATE;

  -- Check global transition_event_id uniqueness & 7-field semantic parity before mutation
  SELECT * INTO v_existing_trans
  FROM public.mandi_harvest_lifecycle_transitions t
  WHERE t.transition_event_id = p_transition_event_id;

  IF FOUND THEN
    IF v_existing_trans.harvest_batch_id IS DISTINCT FROM p_harvest_batch_id
       OR v_existing_trans.transition_kind IS DISTINCT FROM p_transition_kind
       OR v_existing_trans.previous_lifecycle_state IS DISTINCT FROM p_from_lifecycle_state
       OR v_existing_trans.new_lifecycle_state IS DISTINCT FROM p_to_lifecycle_state
       OR v_existing_trans.previous_state_version IS DISTINCT FROM v_expected_prev_ver
       OR v_existing_trans.resulting_state_version IS DISTINCT FROM p_resulting_state_version
       OR v_existing_trans.evidence_checksum IS DISTINCT FROM p_evidence_checksum THEN
      RAISE EXCEPTION 'ERR_TRANSITION_IDENTITY_CONFLICT: existing transition_event_id % conflicts on semantic fields',
        p_transition_event_id USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    IF v_parent.harvest_batch_id IS NULL OR v_parent.state_version < v_existing_trans.resulting_state_version THEN
      RAISE EXCEPTION 'ERR_RECOVERY_CONSISTENCY_VIOLATION: parent state_version inconsistent with existing transition %',
        p_transition_event_id USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    IF v_parent.state_version = v_existing_trans.resulting_state_version
       AND v_parent.audit_lifecycle_state IS DISTINCT FROM v_existing_trans.new_lifecycle_state THEN
      RAISE EXCEPTION 'ERR_RECOVERY_CONSISTENCY_VIOLATION: parent lifecycle state % mismatches existing transition state %',
        v_parent.audit_lifecycle_state, v_existing_trans.new_lifecycle_state
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    RETURN QUERY SELECT
      'IDEMPOTENT_HIT'::VARCHAR(32),
      v_parent.harvest_batch_id,
      v_parent.audit_lifecycle_state,
      v_parent.state_rank,
      v_parent.state_version,
      v_existing_trans.transition_id,
      v_existing_trans.transition_event_id;
    RETURN;
  END IF;

  -- Bind version-keyed 9-field intra-transaction intent authoritatively from validated procedure arguments
  v_intent_key := p_harvest_batch_id || ':' || p_resulting_state_version::text;
  v_existing_intents := COALESCE(
    NULLIF(pg_catalog.current_setting('kisanos.expected_transition_intents', true), '')::jsonb,
    '{}'::jsonb
  );
  v_intent_payload := pg_catalog.jsonb_build_object(
    'transition_id', p_transition_id,
    'transition_event_id', p_transition_event_id,
    'evidence_checksum', p_evidence_checksum,
    'transition_kind', p_transition_kind,
    'harvest_batch_id', p_harvest_batch_id,
    'previous_lifecycle_state', p_from_lifecycle_state,
    'new_lifecycle_state', p_to_lifecycle_state,
    'previous_state_version', v_expected_prev_ver,
    'resulting_state_version', p_resulting_state_version
  );

  PERFORM pg_catalog.set_config(
    'kisanos.expected_transition_intents',
    (v_existing_intents || pg_catalog.jsonb_build_object(v_intent_key, v_intent_payload))::text,
    true
  );

  IF v_parent.harvest_batch_id IS NULL THEN
    IF p_from_lifecycle_state IS NOT NULL OR p_expected_state_version IS NOT NULL OR p_resulting_state_version != 1 THEN
      RAISE EXCEPTION 'Initial creation requires NULL from_lifecycle_state, NULL expected_state_version, and resulting_state_version=1'
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    INSERT INTO public.mandi_harvest_execution_log (
      harvest_batch_id, collection_window, target_observation_date, ogd_publication_timestamp,
      execution_start_utc, execution_start_ist, execution_end_utc, execution_end_ist,
      api_reported_total, records_fetched, records_parsed, records_inserted, records_updated,
      records_skipped, records_rejected, duplicate_count, distinct_states, distinct_markets,
      distinct_commodities, gates, final_validation_status, execution_status,
      observations_committed, audit_persisted, fully_certified, audit_lifecycle_state,
      error_details, diagnostic_notes, state_rank, state_version, last_transition_at,
      is_recovered, last_recovered_at, created_at, updated_at
    ) VALUES (
      p_harvest_batch_id,
      COALESCE(v_tel->>'collection_window', 'MANUAL'),
      NULLIF(v_tel->>'target_observation_date', '')::date,
      NULLIF(v_tel->>'ogd_publication_timestamp', '')::timestamptz,
      COALESCE(NULLIF(v_tel->>'execution_start_utc', '')::timestamptz, v_now),
      COALESCE(NULLIF(v_tel->>'execution_start_ist', ''), pg_catalog.to_char(v_now AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI:SS"+05:30"')),
      NULLIF(v_tel->>'execution_end_utc', '')::timestamptz,
      NULLIF(v_tel->>'execution_end_ist', ''),
      NULLIF(v_tel->>'api_reported_total', '')::integer,
      NULLIF(v_tel->>'records_fetched', '')::integer,
      NULLIF(v_tel->>'records_parsed', '')::integer,
      NULLIF(v_tel->>'records_inserted', '')::integer,
      NULLIF(v_tel->>'records_updated', '')::integer,
      NULLIF(v_tel->>'records_skipped', '')::integer,
      NULLIF(v_tel->>'records_rejected', '')::integer,
      NULLIF(v_tel->>'duplicate_count', '')::integer,
      NULLIF(v_tel->>'distinct_states', '')::integer,
      NULLIF(v_tel->>'distinct_markets', '')::integer,
      NULLIF(v_tel->>'distinct_commodities', '')::integer,
      COALESCE(v_tel->'gates', '{}'::jsonb),
      COALESCE(v_tel->>'final_validation_status', 'PENDING'),
      COALESCE(v_tel->>'execution_status', CASE WHEN p_to_lifecycle_state = 'COLLECTION_FULLY_CERTIFIED' THEN 'SUCCESS' ELSE 'IN_PROGRESS' END),
      COALESCE((v_tel->>'observations_committed')::boolean, FALSE),
      COALESCE((v_tel->>'audit_persisted')::boolean, FALSE),
      (p_to_lifecycle_state = 'COLLECTION_FULLY_CERTIFIED' AND COALESCE((v_tel->>'fully_certified')::boolean, TRUE)),
      p_to_lifecycle_state,
      v_tel->>'error_details',
      v_tel->>'diagnostic_notes',
      v_target_rank,
      1,
      v_now,
      (p_transition_kind = 'RECOVERY'),
      CASE WHEN p_transition_kind = 'RECOVERY' THEN v_now ELSE NULL END,
      v_now,
      v_now
    )
    RETURNING * INTO v_parent;
  ELSE
    IF p_from_lifecycle_state IS DISTINCT FROM v_parent.audit_lifecycle_state
       OR p_expected_state_version IS DISTINCT FROM v_parent.state_version THEN
      RAISE EXCEPTION 'Optimistic concurrency / state mismatch on batch %: expected (% v%), actual (% v%)',
        p_harvest_batch_id, p_from_lifecycle_state, p_expected_state_version,
        v_parent.audit_lifecycle_state, v_parent.state_version
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    UPDATE public.mandi_harvest_execution_log l
    SET
      target_observation_date = COALESCE(NULLIF(v_tel->>'target_observation_date', '')::date, l.target_observation_date),
      ogd_publication_timestamp = COALESCE(NULLIF(v_tel->>'ogd_publication_timestamp', '')::timestamptz, l.ogd_publication_timestamp),
      execution_end_utc = COALESCE(NULLIF(v_tel->>'execution_end_utc', '')::timestamptz, l.execution_end_utc),
      execution_end_ist = COALESCE(NULLIF(v_tel->>'execution_end_ist', ''), l.execution_end_ist),
      api_reported_total = COALESCE(NULLIF(v_tel->>'api_reported_total', '')::integer, l.api_reported_total),
      records_fetched = COALESCE(NULLIF(v_tel->>'records_fetched', '')::integer, l.records_fetched),
      records_parsed = COALESCE(NULLIF(v_tel->>'records_parsed', '')::integer, l.records_parsed),
      records_inserted = COALESCE(NULLIF(v_tel->>'records_inserted', '')::integer, l.records_inserted),
      records_updated = COALESCE(NULLIF(v_tel->>'records_updated', '')::integer, l.records_updated),
      records_skipped = COALESCE(NULLIF(v_tel->>'records_skipped', '')::integer, l.records_skipped),
      records_rejected = COALESCE(NULLIF(v_tel->>'records_rejected', '')::integer, l.records_rejected),
      duplicate_count = COALESCE(NULLIF(v_tel->>'duplicate_count', '')::integer, l.duplicate_count),
      distinct_states = COALESCE(NULLIF(v_tel->>'distinct_states', '')::integer, l.distinct_states),
      distinct_markets = COALESCE(NULLIF(v_tel->>'distinct_markets', '')::integer, l.distinct_markets),
      distinct_commodities = COALESCE(NULLIF(v_tel->>'distinct_commodities', '')::integer, l.distinct_commodities),
      gates = COALESCE(NULLIF(v_tel->'gates', 'null'::jsonb), l.gates),
      final_validation_status = COALESCE(NULLIF(v_tel->>'final_validation_status', ''), l.final_validation_status),
      execution_status = COALESCE(NULLIF(v_tel->>'execution_status', ''), l.execution_status),
      observations_committed = COALESCE((v_tel->>'observations_committed')::boolean, l.observations_committed),
      audit_persisted = COALESCE((v_tel->>'audit_persisted')::boolean, l.audit_persisted),
      fully_certified = (p_to_lifecycle_state = 'COLLECTION_FULLY_CERTIFIED' AND COALESCE((v_tel->>'fully_certified')::boolean, TRUE)),
      audit_lifecycle_state = p_to_lifecycle_state,
      error_details = COALESCE(v_tel->>'error_details', l.error_details),
      diagnostic_notes = COALESCE(v_tel->>'diagnostic_notes', l.diagnostic_notes),
      state_rank = v_target_rank,
      state_version = p_resulting_state_version,
      last_transition_at = v_now,
      is_recovered = (l.is_recovered OR p_transition_kind = 'RECOVERY'),
      last_recovered_at = CASE WHEN p_transition_kind = 'RECOVERY' THEN v_now ELSE l.last_recovered_at END,
      updated_at = v_now
    WHERE l.harvest_batch_id = p_harvest_batch_id
      AND l.state_version = p_expected_state_version
    RETURNING * INTO v_parent;
  END IF;

  INSERT INTO public.mandi_harvest_lifecycle_transitions (
    transition_id,
    harvest_batch_id,
    transition_kind,
    previous_lifecycle_state,
    new_lifecycle_state,
    previous_state_version,
    resulting_state_version,
    transition_event_id,
    evidence_checksum,
    transition_reason,
    actor_or_source,
    occurred_at
  ) VALUES (
    p_transition_id,
    p_harvest_batch_id,
    p_transition_kind,
    p_from_lifecycle_state,
    p_to_lifecycle_state,
    v_expected_prev_ver,
    p_resulting_state_version,
    p_transition_event_id,
    p_evidence_checksum,
    COALESCE(NULLIF(p_transition_reason, ''), p_operation_kind),
    p_actor_or_source,
    v_now
  );

  IF p_transition_kind = 'RECOVERY' THEN
    INSERT INTO public.mandi_harvest_recovery_events (
      recovery_event_id,
      transition_id,
      transition_event_id,
      harvest_batch_id,
      recovery_method,
      from_lifecycle_state,
      to_lifecycle_state,
      expected_state_version,
      resulting_state_version,
      evidence_checksum,
      evidence_summary,
      actor_or_worker,
      recovery_notes,
      occurred_at
    ) VALUES (
      p_transition_event_id,
      p_transition_id,
      p_transition_event_id,
      p_harvest_batch_id,
      p_operation_kind,
      p_from_lifecycle_state,
      p_to_lifecycle_state,
      p_expected_state_version,
      p_resulting_state_version,
      p_evidence_checksum,
      COALESCE(p_recovery_evidence_summary, '{}'::jsonb),
      p_actor_or_source,
      p_recovery_notes,
      v_now
    );
  END IF;

  RETURN QUERY SELECT
    'APPLIED'::VARCHAR(32),
    v_parent.harvest_batch_id,
    v_parent.audit_lifecycle_state,
    v_parent.state_rank,
    v_parent.state_version,
    p_transition_id,
    p_transition_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_mandi_update_batch_metadata(
  p_harvest_batch_id VARCHAR(100),
  p_expected_state_version INTEGER,
  p_diagnostic_notes TEXT DEFAULT NULL,
  p_error_details TEXT DEFAULT NULL
)
RETURNS TABLE (
  harvest_batch_id VARCHAR(100),
  audit_lifecycle_state VARCHAR(64),
  state_version INTEGER,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_row public.mandi_harvest_execution_log%ROWTYPE;
  v_now TIMESTAMPTZ := pg_catalog.now();
BEGIN
  IF p_harvest_batch_id IS NULL OR p_expected_state_version IS NULL THEN
    RAISE EXCEPTION 'harvest_batch_id and expected_state_version are required for metadata update'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_harvest_batch_id, 0));

  UPDATE public.mandi_harvest_execution_log l
  SET
    diagnostic_notes = COALESCE(p_diagnostic_notes, l.diagnostic_notes),
    error_details = COALESCE(p_error_details, l.error_details),
    updated_at = v_now
  WHERE l.harvest_batch_id = p_harvest_batch_id
    AND l.state_version = p_expected_state_version
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Metadata update failed: batch % at state_version % not found',
      p_harvest_batch_id, p_expected_state_version
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;

  RETURN QUERY SELECT
    v_row.harvest_batch_id,
    v_row.audit_lifecycle_state,
    v_row.state_version,
    v_row.updated_at;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Explicit Ownership, RLS & Role-ACL Lockdown (Verified per v2.2.9)
-- ---------------------------------------------------------------------------
ALTER TABLE public.mandi_harvest_execution_log OWNER TO postgres;
ALTER TABLE public.mandi_harvest_lifecycle_transitions OWNER TO postgres;
ALTER TABLE public.mandi_harvest_recovery_events OWNER TO postgres;

ALTER FUNCTION public.fn_mandi_record_lifecycle_transition(
  VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR,
  INTEGER, INTEGER, VARCHAR, VARCHAR, VARCHAR,
  TEXT, VARCHAR, JSONB, JSONB, TEXT
) OWNER TO postgres;

ALTER FUNCTION public.fn_mandi_update_batch_metadata(
  VARCHAR, INTEGER, TEXT, TEXT
) OWNER TO postgres;

ALTER TABLE public.mandi_harvest_execution_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mandi_harvest_lifecycle_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mandi_harvest_recovery_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.mandi_harvest_execution_log FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.mandi_harvest_lifecycle_transitions FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.mandi_harvest_recovery_events FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON TABLE public.mandi_harvest_execution_log TO service_role;
GRANT SELECT ON TABLE public.mandi_harvest_lifecycle_transitions TO service_role;
GRANT SELECT ON TABLE public.mandi_harvest_recovery_events TO service_role;

REVOKE ALL ON FUNCTION public.fn_mandi_record_lifecycle_transition(
  VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR,
  INTEGER, INTEGER, VARCHAR, VARCHAR, VARCHAR,
  TEXT, VARCHAR, JSONB, JSONB, TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fn_mandi_record_lifecycle_transition(
  VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR,
  INTEGER, INTEGER, VARCHAR, VARCHAR, VARCHAR,
  TEXT, VARCHAR, JSONB, JSONB, TEXT
) TO service_role;

REVOKE ALL ON FUNCTION public.fn_mandi_update_batch_metadata(
  VARCHAR, INTEGER, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fn_mandi_update_batch_metadata(
  VARCHAR, INTEGER, TEXT, TEXT
) TO service_role;

DROP POLICY IF EXISTS "Service role read mandi harvest execution log" ON public.mandi_harvest_execution_log;
CREATE POLICY "Service role read mandi harvest execution log"
ON public.mandi_harvest_execution_log FOR SELECT TO service_role USING (true);

DROP POLICY IF EXISTS "Service role read mandi harvest lifecycle transitions" ON public.mandi_harvest_lifecycle_transitions;
CREATE POLICY "Service role read mandi harvest lifecycle transitions"
ON public.mandi_harvest_lifecycle_transitions FOR SELECT TO service_role USING (true);

DROP POLICY IF EXISTS "Service role read mandi harvest recovery events" ON public.mandi_harvest_recovery_events;
CREATE POLICY "Service role read mandi harvest recovery events"
ON public.mandi_harvest_recovery_events FOR SELECT TO service_role USING (true);

-- Optional dedicated ml_engine_readonly role hardening (applied cleanly whenever role exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'ml_engine_readonly') THEN
    REVOKE ALL ON TABLE public.mandi_harvest_execution_log FROM ml_engine_readonly;
    REVOKE ALL ON TABLE public.mandi_harvest_lifecycle_transitions FROM ml_engine_readonly;
    REVOKE ALL ON TABLE public.mandi_harvest_recovery_events FROM ml_engine_readonly;

    GRANT SELECT ON TABLE public.mandi_harvest_execution_log TO ml_engine_readonly;
    GRANT SELECT ON TABLE public.mandi_harvest_lifecycle_transitions TO ml_engine_readonly;
    GRANT SELECT ON TABLE public.mandi_harvest_recovery_events TO ml_engine_readonly;

    REVOKE ALL ON FUNCTION public.fn_mandi_record_lifecycle_transition(
      VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR,
      INTEGER, INTEGER, VARCHAR, VARCHAR, VARCHAR,
      TEXT, VARCHAR, JSONB, JSONB, TEXT
    ) FROM ml_engine_readonly;

    REVOKE ALL ON FUNCTION public.fn_mandi_update_batch_metadata(
      VARCHAR, INTEGER, TEXT, TEXT
    ) FROM ml_engine_readonly;

    DROP POLICY IF EXISTS "ML readonly read mandi harvest execution log" ON public.mandi_harvest_execution_log;
    CREATE POLICY "ML readonly read mandi harvest execution log"
    ON public.mandi_harvest_execution_log FOR SELECT TO ml_engine_readonly USING (true);

    DROP POLICY IF EXISTS "ML readonly read mandi harvest lifecycle transitions" ON public.mandi_harvest_lifecycle_transitions;
    CREATE POLICY "ML readonly read mandi harvest lifecycle transitions"
    ON public.mandi_harvest_lifecycle_transitions FOR SELECT TO ml_engine_readonly USING (true);

    DROP POLICY IF EXISTS "ML readonly read mandi harvest recovery events" ON public.mandi_harvest_recovery_events;
    CREATE POLICY "ML readonly read mandi harvest recovery events"
    ON public.mandi_harvest_recovery_events FOR SELECT TO ml_engine_readonly USING (true);
  END IF;
END;
$$;
