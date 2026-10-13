'use strict';

const { pool } = require('./db');
const { aplicarMigracoes } = require('./migrate');
const historiaModel = require('../models/historiaModel');
const professorModel = require('../models/professorModel');

const TITULO_HISTORIA = 'Lesão por pressão em paciente têxtil';

async function seed() {
  try {
    await aplicarMigracoes(); // garante a coluna professor.admin
    // Conta administradora (Nathan). Converte a antiga conta de demonstração do Carlos, se existir.
    const acao = await professorModel.garantirAdministrador();
    console.log(`Conta administradora (${professorModel.ADMIN.email}) ${acao}.`);
    const professor = await professorModel.buscarPorEmail(professorModel.ADMIN.email);

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
