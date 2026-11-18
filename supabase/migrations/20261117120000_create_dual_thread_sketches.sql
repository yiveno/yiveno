-- 暗线匿名汇总草图（ADR-027）
-- 仅计数 JSON；不含线索原文 / 标题 / 链接。扩展经 Worker service role 写入。

CREATE TABLE IF NOT EXISTS public.dual_thread_sketches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sketch_date DATE NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  adaptation_config_version TEXT NOT NULL,
  telemetry_event_count INTEGER NOT NULL,
  result_outcome_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  confirm_label_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  failure_stage_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  timing_total_ms JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_dual_thread_sketches_user_date UNIQUE (user_id, sketch_date)
);

COMMENT ON TABLE public.dual_thread_sketches IS '暗线研究：用户同意后每日最多一行的匿名汇总草图';
COMMENT ON COLUMN public.dual_thread_sketches.user_id IS '账号 ID（auth.users.id）';
COMMENT ON COLUMN public.dual_thread_sketches.sketch_date IS '服务端 UTC 日期；同日 upsert 覆盖';
COMMENT ON COLUMN public.dual_thread_sketches.timing_total_ms IS '耗时分位 JSON（n/p50/p90）；可空';

CREATE INDEX IF NOT EXISTS idx_dual_thread_sketches_user_date_desc
  ON public.dual_thread_sketches (user_id, sketch_date DESC);

ALTER TABLE public.dual_thread_sketches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own dual thread sketches"
  ON public.dual_thread_sketches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own dual thread sketches"
  ON public.dual_thread_sketches FOR DELETE
  USING (auth.uid() = user_id);

-- INSERT/UPDATE 仅经 Worker service role（与 memory-sync 同模式）；不开放用户直写。
