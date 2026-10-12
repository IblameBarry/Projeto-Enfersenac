'use strict';

const { pool } = require('./db');
const professorModel = require('../models/professorModel');
const historiaModel = require('../models/historiaModel');

const EMAIL_TESTE = 'prof.carlos@senac.br';
const NOME_PROFESSOR = 'Carlos Souza';
const TITULO_HISTORIA = 'Lesão por pressão em paciente têxtil';

async function seed() {
  try {
    let professor = await professorModel.buscarPorEmail(EMAIL_TESTE);

    if (!professor) {
      professor = await professorModel.criar(NOME_PROFESSOR, EMAIL_TESTE);
      console.log('Professor de teste criado:', EMAIL_TESTE);
    } else {
      console.log('Professor de teste já existe:', EMAIL_TESTE);
    }

    const { rows } = await pool.query(
      `SELECT id, codigo, titulo
       FROM historia
       WHERE professor_id = $1 AND titulo = $2
       LIMIT 1`,
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
