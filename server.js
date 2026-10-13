const express = require('express');
const path = require('path');

// O .env é carregado dentro de database/db.js (sempre a partir da raiz do
// projeto, independente de onde o "node" foi executado) — não precisa
// repetir require('dotenv').config() aqui.
const { testConnection } = require('./database/db');
const { aplicarMigracoes } = require('./database/migrate');
const alunoModel = require('./models/alunoModel');
const professorModel = require('./models/professorModel');
const historiaModel = require('./models/historiaModel');
const respostaModel = require('./models/respostaModel');
const comentarioModel = require('./models/comentarioModel');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ============================================================
   ROTAS DE TELAS (GET)
============================================================ */

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login/aluno', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login-aluno.html'));
});

app.get('/login/professor', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login-professor.html'));
});

app.get('/portal-aluno', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'portal-aluno-historias.html'));
});

app.get('/aluno/prontuario', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'prontuario-aluno.html'));
});

app.get('/aluno/historia-professor', (req, res) => {
  const params = new URLSearchParams();
  if (req.query.id) params.set('id', String(req.query.id));
  if (req.query.historia_id) params.set('historia_id', String(req.query.historia_id));
  res.redirect(`/aluno/prontuario${params.size ? `?${params.toString()}` : ''}`);
});

app.get('/aluno/historia-aleatoria', async (req, res) => {
  try {
    const historias = await historiaModel.listarAtivasParaTurma(req.query.turma || null);
    if (!historias.length) return res.status(404).send('Nenhuma história ativa disponível.');
    const historia = historias[Math.floor(Math.random() * historias.length)];
    const params = new URLSearchParams();
    if (req.query.id) params.set('id', String(req.query.id));
    params.set('historia_id', String(historia.id));
    res.redirect(`/aluno/prontuario?${params.toString()}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao selecionar história aleatória.');
  }
});

app.get('/prontuario/sucesso', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sucesso-envio.html'));
});

app.get('/dashboard-professor', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard-professor.html'));
});

app.get('/dashboard-professor/respostas', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'respostas-professor.html'));
});

app.get('/dashboard-professor/feedback', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'feedback-professor.html'));
});

/* ============================================================
   API (JSON)
============================================================ */

app.get('/api/professores/:id/historias', async (req, res) => {
  try {
    if (!/^\d+$/.test(String(req.params.id))) return res.status(400).json({ erro: 'ID de professor inválido.' });
    const historias = await historiaModel.listarPorProfessor(req.params.id);
    res.json(historias);
  } catch (err) {
    console.error('Erro ao listar histórias do professor:', err);
    res.status(500).json({ erro: 'Erro ao buscar histórias publicadas.' });
  }
});

// Uma história específica (usada no prontuário do aluno para exibir o caso escolhido).
app.get('/api/historias/:id', async (req, res) => {
  try {
    if (!/^\d+$/.test(String(req.params.id))) return res.status(400).json({ erro: 'ID de história inválido.' });
    const historia = await historiaModel.buscarPorId(req.params.id);
    if (!historia) return res.status(404).json({ erro: 'História não encontrada.' });
    const { id, codigo, titulo, enunciado, data_expiracao, status } = historia;
    res.json({ id, codigo, titulo, enunciado, data_expiracao, status });
  } catch (err) {
    console.error('Erro ao buscar história:', err);
    res.status(500).json({ erro: 'Erro ao buscar a história.' });
  }
});

// Contagem do que será apagado junto com a história (usado no aviso antes de excluir).
app.get('/api/historias/:id/vinculos', async (req, res) => {
  try {
    const { professor_id } = req.query;
    if (!/^\d+$/.test(String(req.params.id)) || !/^\d+$/.test(String(professor_id || ''))) {
      return res.status(400).json({ erro: 'ID de história ou de professor inválido.' });
    }
    const vinculos = await historiaModel.contarVinculos(req.params.id, professor_id);
    if (!vinculos) return res.status(404).json({ erro: 'História não encontrada para este professor.' });
    res.json(vinculos);
  } catch (err) {
    console.error('Erro ao contar vínculos da história:', err);
    res.status(500).json({ erro: 'Erro ao verificar respostas vinculadas.' });
  }
});

// Exclui uma história do professor e todas as respostas/feedbacks vinculados.
// O front envia quantas respostas mostrou no aviso; se chegaram respostas novas
// depois disso, a exclusão é recusada para o professor confirmar de novo.
app.delete('/api/historias/:id', async (req, res) => {
  try {
    const { professor_id, respostas_confirmadas } = req.body || {};
    if (!/^\d+$/.test(String(req.params.id)) || !/^\d+$/.test(String(professor_id || ''))) {
      return res.status(400).json({ erro: 'ID de história ou de professor inválido.' });
    }

    const excluido = await historiaModel.excluir(req.params.id, professor_id, Number(respostas_confirmadas) || 0);
    if (!excluido) return res.status(404).json({ erro: 'História não encontrada para este professor.' });
    if (excluido.conflito) {
      const vinculos = await historiaModel.contarVinculos(req.params.id, professor_id);
      return res.status(409).json({ erro: 'Novas respostas foram vinculadas a esta história. Confira o aviso e confirme novamente.', vinculos });
    }
    res.json({ ok: true, ...excluido });
  } catch (err) {
    console.error('Erro ao excluir história:', err);
    res.status(500).json({ erro: 'Erro ao excluir a história.' });
  }
});

// Histórias ativas para a turma do aluno (ou todas, se não passar ?turma=)
app.get('/api/historias', async (req, res) => {
  try {
    const { turma } = req.query;
    const historias = turma
      ? await historiaModel.listarAtivasParaTurma(turma)
      : await historiaModel.listarTodas();
    res.json(historias);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar histórias.' });
  }
});

// Histórico do aluno: todas as respostas dele (rascunho/enviada) + se já têm comentário do professor
app.get('/api/alunos/:id/respostas', async (req, res) => {
  try {
    const respostas = await respostaModel.listarPorAluno(req.params.id);
    res.json(respostas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar histórico do aluno.' });
  }
});

// Respostas enviadas pelos alunos (para a tela "respostas do professor").
// Aceita ?historia_id= para listar só as respostas da história selecionada.
app.get('/api/respostas', async (req, res) => {
  try {
    const { historia_id } = req.query;
    if (historia_id && !/^\d+$/.test(String(historia_id))) {
      return res.status(400).json({ erro: 'ID de história inválido.' });
    }
    const respostas = await respostaModel.listarEnviadas(historia_id || null);
    res.json(respostas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar respostas.' });
  }
});

// Detalhe de uma resposta + comentários já feitos. Marca como lida ao abrir.
app.get('/api/respostas/:id', async (req, res) => {
  try {
    if (!/^\d+$/.test(String(req.params.id))) return res.status(400).json({ erro: 'ID de resposta inválido.' });
    const resposta = await respostaModel.buscarPorId(req.params.id);
    if (!resposta) return res.status(404).json({ erro: 'Resposta não encontrada.' });

    await respostaModel.marcarComoLida(req.params.id);
    const comentarios = await comentarioModel.listarPorResposta(req.params.id);
    res.json({ ...resposta, comentarios });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar resposta.' });
  }
});

/* ============================================================
   ROTAS DE ENVIO DE DADOS (POST)
============================================================ */

// Login do Aluno — nome + turma. Se já existir, entra com o histórico;
// se não existir, cria o cadastro na hora.
app.post('/login/aluno', async (req, res) => {
  try {
    const { nome, turma } = req.body;
    if (!nome || !turma) return res.redirect('/login/aluno?erro=campos');

    const aluno = await alunoModel.loginOuCriar(nome.trim(), turma.trim());
    res.redirect(
      `/portal-aluno?id=${aluno.id}&nome=${encodeURIComponent(aluno.nome)}&turma=${encodeURIComponent(aluno.turma)}`
    );
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao processar login do aluno.');
  }
});

// Login do Professor — e-mail corporativo + senha (hash bcrypt na tabela professor).
app.post('/login/professor', async (req, res) => {
  try {
    const { email, senha } = req.body;
    let emailNormalizado = String(email || '').trim().toLowerCase();
    // Compatibilidade com o endereço antigo da conta de demonstração.
    if (emailNormalizado === 'prof.carlos@senac.br') {
      emailNormalizado = 'prof.carlos@ms.senac.br';
    }
    if (!/^[^\s@]+@ms\.senac\.br$/.test(emailNormalizado)) {
      return res.redirect('/login/professor?erro=email-corporativo');
    }
    const professor = await professorModel.buscarPorEmail(emailNormalizado);

    if (!professor) {
      return res.redirect('/login/professor?erro=credenciais');
    }

    const senhaValida = Boolean(senha) && await professorModel.verificarSenha(senha, professor.senha_hash);
    if (!senhaValida) {
      return res.redirect('/login/professor?erro=credenciais');
    }

    res.redirect(
      `/dashboard-professor?id=${professor.id}&email=${encodeURIComponent(professor.email)}`
    );
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao processar login do professor.');
  }
});

// Publicar História (Professor)
app.post('/historias/publicar', async (req, res) => {
  try {
    const { titulo, conteudo, expiracao, turma, professor_id } = req.body;
    if (!professor_id) {
      return res.status(400).send('professor_id é obrigatório (inclua um campo oculto no formulário).');
    }

    await historiaModel.criar({
      professor_id,
      titulo,
      enunciado: conteudo,
      turma: turma || null,
      data_expiracao: expiracao || null,
    });
    res.redirect(`/dashboard-professor?id=${encodeURIComponent(professor_id)}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao publicar história.');
  }
});

// Envio do Prontuário (Aluno) — cria ou atualiza a resposta da dupla aluno+história.
app.post('/prontuario/salvar', async (req, res) => {
  try {
    const { aluno_id, historia_id } = req.body;
    if (!aluno_id || !historia_id) {
      return res
        .status(400)
        .send('aluno_id e historia_id são obrigatórios (inclua campos ocultos no formulário).');
    }

    await respostaModel.salvar(req.body, { aluno_id, historia_id, enviar: true });
    const q = new URLSearchParams();
    q.set('id', String(aluno_id));
    if (req.body.nome_aluno) q.set('nome', String(req.body.nome_aluno));
    if (req.body.turma_aluno) q.set('turma', String(req.body.turma_aluno));
    res.redirect(`/prontuario/sucesso?${q.toString()}`);
  } catch (err) {
    if (err.status === 400) return res.status(400).send(err.message);
    console.error(err);
    res.status(500).send('Erro ao salvar prontuário.');
  }
});

// Envio do Feedback (Professor) — comentário sobre uma resposta específica.
// Se o professor já tiver feedback nessa resposta, ele é atualizado (não duplica).
app.post('/feedback/salvar', async (req, res) => {
  try {
    const { resposta_id, professor_id, comentario_docente } = req.body;
    if (!resposta_id || !professor_id) {
      return res
        .status(400)
        .send('resposta_id e professor_id são obrigatórios (inclua campos ocultos no formulário).');
    }

    await comentarioModel.salvar({
      resposta_id,
      professor_id,
      texto: comentario_docente || '',
      body: req.body, // nota_final, criterios e checkboxes do formulário
    });

    // Volta para a tela de respostas já com a resposta avaliada aberta.
    const resposta = await respostaModel.buscarPorId(resposta_id);
    const q = new URLSearchParams({ id: String(professor_id), resposta_id: String(resposta_id) });
    if (resposta) q.set('historia_id', String(resposta.historia_id));
    res.redirect(`/dashboard-professor/respostas?${q.toString()}`);
  } catch (err) {
    if (err.status === 400) return res.status(400).send(err.message);
    console.error(err);
    res.status(500).send('Erro ao salvar feedback.');
  }
});

/* ============================================================
   INICIALIZAÇÃO DO SERVIDOR
============================================================ */
app.listen(PORT, async () => {
  console.log('====================================================');
  console.log(` Servidor rodando em http://localhost:${PORT}`);
  console.log(` Feedback Docente: http://localhost:${PORT}/dashboard-professor/feedback`);
  console.log('====================================================');
  if (await testConnection()) {
    // Garante as colunas novas (ex.: nota e competências do feedback) em bancos já existentes.
    try {
      await aplicarMigracoes();
    } catch (err) {
      console.error('Erro ao aplicar migrações:', err.message);
    }
  }
});
