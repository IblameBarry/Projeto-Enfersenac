-- Professor administrador: pode cadastrar novos professores.
-- A conta administradora é garantida na inicialização do servidor (professorModel.garantirAdministrador).
-- Pode ser executado mais de uma vez sem erro.

ALTER TABLE public.professor
    ADD COLUMN IF NOT EXISTS admin BOOLEAN NOT NULL DEFAULT FALSE;
