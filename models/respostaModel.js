const { pool } = require('../database/db');
const { paraInteiro, paraDecimal, paraEscalaDor, paraPercentual, paraData } = require('../utils/parse');

function mapearCampos(body) {
  return {
    data_atendimento: paraData(body.data_atendimento),
    numero_prontuario: body.numero_prontuario || null,
    turno: body.turno || null,
    profissional: body.profissional || null,
    paciente_nome: body.paciente_nome || null,
    paciente_telefone: body.paciente_tel || null,
    paciente_nascimento: paraData(body.paciente_nasc),
    paciente_rg: body.paciente_rg || null,
    paciente_ctps: body.paciente_ctps || null,
    paciente_idade: paraInteiro(body.paciente_idade),
    paciente_sexo: body.paciente_sexo || null,
    paciente_cor_etnia: body.paciente_etnia || null,
    paciente_estado_civil: body.paciente_civil || null,
    paciente_funcao: body.paciente_cargo || null,
    paciente_empresa: body.paciente_empresa || null,
    paciente_cidade_uf: body.paciente_cidade || null,
    paciente_setor: body.paciente_setor || null,
    queixa_principal: body.queixa_principal || null,
    pressao_arterial: body.sinal_pa || null,
    frequencia_cardiaca: paraInteiro(body.sinal_fc),
    frequencia_respiratoria: paraInteiro(body.sinal_fr),
    temperatura: paraDecimal(body.sinal_temp),
    spo2: paraPercentual(body.sinal_spo2),
    o2_suplementar: body.sinal_o2 || null,
    glicemia_capilar: paraInteiro(body.sinal_glicemia),
    escala_dor: paraEscalaDor(body.sinal_dor),
    consciencia: body.sinal_consciencia || null,
    mobilidade: body.sinal_mobilidade || null,
    lesao_localizacao: body.lesao_local || null,
    lesao_data_inicio: paraData(body.lesao_inicio),
    lesao_estadiamento: body.lesao_estadio || null,
    lesao_tamanho: body.lesao_tamanho || null,
    lesao_cor_base: body.lesao_cor || null,
    lesao_sinais_infeccao: body.lesao_infeccao || null,
    lesao_exsudato: body.lesao_exsudato || null,
    lesao_debridamento: body.lesao_debridamento || null,
    lesao_cobertura: body.lesao_cobertura || null,
    lesao_observacao: body.lesao_obs || null,
    medicacao: body.med_nome || null,
    medicacao_via: body.med_via || null,
    medicacao_dosagem: body.med_dose || null,
    medicacao_frequencia: body.med_freq || null,
    medicacao_responsavel: body.med_resp || null,
    medicacao_observacao: body.med_obs || null,
    diagnostico_enfermagem: body.conduta_diagnostico || null,
    intervencao_prioritaria: body.conduta_intervencao || null,
    proxima_avaliacao: body.conduta_proxima || null,
    encaminhamento: body.conduta_encaminhamento || null,
    conclusao_clinica: body.conduta_conclusao || null,
    assinatura_aluno: body.assinatura_aluno || null,
    assinatura_professor: body.assinatura_prof || null,
  };
}

async function salvar(body, { aluno_id, historia_id, enviar }) {
  const campos = mapearCampos(body);
  const declaracao_etica = Boolean(body.termo_anamnese);
  const declaracao_responsabilidade = Boolean(body.termo_registro);
  const status = enviar ? 'ENVIADA' : 'RASCUNHO';

  if (enviar && !(declaracao_etica && declaracao_responsabilidade)) {
    const erro = new Error(
      'Para enviar o prontuário é preciso marcar as duas declarações de responsabilidade.'
    );
    erro.status = 400;
    throw erro;
  }

  const colunas = {
    aluno_id,
    historia_id,
    status,
    declaracao_etica,
    declaracao_responsabilidade,
    ...campos,
  };

  const nomesColunas = Object.keys(colunas);
  const valores = Object.values(colunas);
  const placeholders = nomesColunas.map((_, index) => `$${index + 1}`).join(', ');
  const atualizacoes = nomesColunas
    .filter((coluna) => coluna !== 'aluno_id' && coluna !== 'historia_id')
    .map((coluna) => `${coluna} = EXCLUDED.${coluna}`);

  atualizacoes.push('atualizado_em = CURRENT_TIMESTAMP');
  atualizacoes.push(`enviada_em = ${enviar ? 'CURRENT_TIMESTAMP' : 'resposta.enviada_em'}`);

  const sql = `
    INSERT INTO resposta (${nomesColunas.join(', ')}, enviada_em)
    VALUES (${placeholders}, ${enviar ? 'CURRENT_TIMESTAMP' : 'NULL'})
    ON CONFLICT (aluno_id, historia_id) DO UPDATE SET
      ${atualizacoes.join(', ')}
    RETURNING id
  `;

  const { rows } = await pool.query(sql, valores);
  return { id: rows[0].id, status };
}

async function buscarPorAlunoHistoria(aluno_id, historia_id) {
  const { rows } = await pool.query(
    'SELECT * FROM resposta WHERE aluno_id = $1 AND historia_id = $2 LIMIT 1',
    [aluno_id, historia_id]
  );
  return rows[0] || null;
}

async function buscarPorId(id) {
  const { rows } = await pool.query(
    `SELECT r.*, a.nome AS aluno_nome, a.turma AS aluno_turma,
            h.codigo AS historia_codigo, h.titulo AS historia_titulo
     FROM resposta r
     JOIN aluno a ON a.id = r.aluno_id
     JOIN historia h ON h.id = r.historia_id
     WHERE r.id = $1`,
    [id]
  );
  return rows[0] || null;
}

// Se historia_id for informado, traz só as respostas daquela história.
async function listarEnviadas(historia_id = null) {
  const { rows } = await pool.query(
    `SELECT r.*, a.nome AS aluno_nome, a.turma AS aluno_turma,
            h.codigo AS historia_codigo, h.titulo AS historia_titulo,
            (SELECT COUNT(*)::int FROM comentario c WHERE c.resposta_id = r.id) AS total_comentarios
     FROM resposta r
     JOIN aluno a ON a.id = r.aluno_id
     JOIN historia h ON h.id = r.historia_id
     WHERE r.status = 'ENVIADA'
       AND ($1::bigint IS NULL OR r.historia_id = $1::bigint)
     ORDER BY r.enviada_em DESC`,
    [historia_id]
  );
  return rows;
}

async function listarPorAluno(aluno_id) {
  const { rows } = await pool.query(
    `SELECT r.id, r.historia_id, r.status, r.criado_em, r.enviada_em, r.lida_em,
            h.codigo AS historia_codigo, h.titulo AS historia_titulo, h.data_expiracao AS historia_data_expiracao,
            (SELECT COUNT(*)::int FROM comentario c WHERE c.resposta_id = r.id) AS total_comentarios,
            (SELECT COUNT(*)::int FROM comentario c WHERE c.resposta_id = r.id AND c.notificar_aluno) AS total_feedbacks_visiveis
     FROM resposta r
     JOIN historia h ON h.id = r.historia_id
     WHERE r.aluno_id = $1
     ORDER BY r.criado_em DESC`,
    [aluno_id]
  );
  return rows;
}

async function marcarComoLida(id) {
  await pool.query(
    'UPDATE resposta SET lida_em = CURRENT_TIMESTAMP WHERE id = $1 AND lida_em IS NULL',
    [id]
  );
}

module.exports = {
  salvar,
  buscarPorAlunoHistoria,
  buscarPorId,
  listarEnviadas,
  listarPorAluno,
  marcarComoLida,
};
