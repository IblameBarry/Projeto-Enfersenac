-- Avaliação no modelo pedagógico Senac: cada competência (indicador) e o conceito
-- final passam a ser Atendido / Parcialmente atendido / Não atendido.
-- Os valores antigos (excelente, adequado, regular, insuficiente) continuam aceitos
-- nas competências para não invalidar feedbacks registrados antes desta mudança.
-- Pode ser executado mais de uma vez sem erro.

ALTER TABLE public.comentario
    ADD COLUMN IF NOT EXISTS conceito_final VARCHAR(20);

DO $$ BEGIN
    -- Recria a regra das competências só se ela ainda não conhecer os valores novos.
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_comentario_criterios'
          AND pg_get_constraintdef(oid) LIKE '%nao_atendido%'
    ) THEN
        ALTER TABLE public.comentario DROP CONSTRAINT IF EXISTS ck_comentario_criterios;
        ALTER TABLE public.comentario
            ADD CONSTRAINT ck_comentario_criterios CHECK (
                (criterio_triagem IS NULL OR criterio_triagem IN ('atendido', 'parcial', 'nao_atendido', 'excelente', 'adequado', 'regular', 'insuficiente')) AND
                (criterio_diagnostico IS NULL OR criterio_diagnostico IN ('atendido', 'parcial', 'nao_atendido', 'excelente', 'adequado', 'regular', 'insuficiente')) AND
                (criterio_conduta IS NULL OR criterio_conduta IN ('atendido', 'parcial', 'nao_atendido', 'excelente', 'adequado', 'regular', 'insuficiente'))
            );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_comentario_conceito') THEN
        ALTER TABLE public.comentario
            ADD CONSTRAINT ck_comentario_conceito CHECK (
                conceito_final IS NULL OR conceito_final IN ('atendido', 'parcial', 'nao_atendido')
            );
    END IF;
END $$;
