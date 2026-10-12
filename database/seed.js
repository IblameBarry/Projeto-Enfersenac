'use strict';

const { pool } = require('./db');
const bcrypt = require('bcrypt');
const historiaModel = require('../models/historiaModel');

const EMAIL_TESTE = 'prof.carlos@ms.senac.br';
const EMAIL_ANTIGO = 'prof.carlos@senac.br';
const SENHA_TESTE = 'Senac123';
const NOME_PROFESSOR = 'Carlos Souza';
const TITULO_HISTORIA = 'Lesão por pressão em paciente têxtil';

async function seed() {
  try {
    const senha_hash = await bcrypt.hash(SENHA_TESTE, 10);

    // Migra a conta de demonstração antiga e garante credenciais válidas.
    const existente = await pool.query(
      'SELECT id FROM professor WHERE lower(email) IN ($1, $2) ORDER BY id LIMIT 1',
      [EMAIL_TESTE, EMAIL_ANTIGO]
    );

    let professor;
    if (existente.rows.length) {
      const atualizado = await pool.query(
        `UPDATE professor
         SET nome = $1, email = $2, senha_hash = $3, ativo = TRUE
         WHERE id = $4
         RETURNING id, nome, email`,
        [NOME_PROFESSOR, EMAIL_TESTE, senha_hash, existente.rows[0].id]
      );
      professor = atualizado.rows[0];
      // Remove eventual conta de demonstração duplicada, sem tocar em outros professores.
      await pool.query(
        'DELETE FROM professor WHERE lower(email) = $1 AND id <> $2',
        [EMAIL_ANTIGO, professor.id]
      );
      console.log('Conta de demonstração atualizada:', EMAIL_TESTE);
    } else {
      const criado = await pool.query(
        `INSERT INTO professor (nome, email, senha_hash, ativo)
         VALUES ($1, $2, $3, TRUE)
         RETURNING id, nome, email`,
        [NOME_PROFESSOR, EMAIL_TESTE, senha_hash]
      );
      professor = criado.rows[0];
      console.log('Conta de demonstração criada:', EMAIL_TESTE);
    }

    const { rows } = await pool.query(
      `SELECT id, codigo, titulo FROM historia
       WHERE professor_id = $1 AND titulo = $2 LIMIT 1`,
      [professor.id, TITULO_HISTORIA]
    );

    if (rows.length) {
      console.log('História de exemplo já existe:', rows[0].codigo, '-', rows[0].titulo);
      return;
    }

    const historia = await historiaModel.criar({
      professor_id: professor.id,
      titulo: TITULO_HISTORIA,
      enunciado: 'Paciente encaminhada pelo ambulatório da empresa com queixa de dor e sinais de lesão por pressão na região sacral. Realize a anamnese e preencha o prontuário completo.',
      turma: null,
      data_expiracao: null,
    });
    console.log('História de exemplo criada:', historia.codigo, '-', historia.titulo);
  } catch (err) {
    console.error('Erro ao executar seed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seed();
