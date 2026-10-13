-- Avaliação do feedback docente: nota final, competências e opções do formulário.
-- Pode ser executado mais de uma vez sem erro (só cria o que ainda não existe).

ALTER TABLE public.comentario
    ADD COLUMN IF NOT EXISTS nota_final NUMERIC(3,1),
    ADD COLUMN IF NOT EXISTS criterio_triagem VARCHAR(20),
    ADD COLUMN IF NOT EXISTS criterio_diagnostico VARCHAR(20),
    ADD COLUMN IF NOT EXISTS criterio_conduta VARCHAR(20),
    ADD COLUMN IF NOT EXISTS notificar_aluno BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS liberar_revisao BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP(0) WITHOUT TIME ZONE;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_comentario_nota') THEN
        ALTER TABLE public.comentario
            ADD CONSTRAINT ck_comentario_nota CHECK (nota_final IS NULL OR nota_final BETWEEN 0 AND 10);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_comentario_criterios') THEN
        ALTER TABLE public.comentario
            ADD CONSTRAINT ck_comentario_criterios CHECK (
                (criterio_triagem IS NULL OR criterio_triagem IN ('excelente', 'adequado', 'regular', 'insuficiente')) AND
                (criterio_diagnostico IS NULL OR criterio_diagnostico IN ('excelente', 'adequado', 'regular', 'insuficiente')) AND
                (criterio_conduta IS NULL OR criterio_conduta IN ('excelente', 'adequado', 'regular', 'insuficiente'))
            );
    END IF;
END $$;
