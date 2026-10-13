const express = require('express');
const path = require('path');
const crypto = require('node:crypto');

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
   SESSÃO DO PROFESSOR (cookie assinado)
   Usada para proteger a área de administração. O cookie guarda
   "id.expiração.assinatura"; sem o segredo não dá para forjar.
============================================================ */
// Defina SESSION_SECRET no ambiente; sem ele, um segredo aleatório é gerado
// a cada inicialização (as sessões abertas caem quando o servidor reinicia).
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const COOKIE_SESSAO = 'prof_sessao';
const DURACAO_SESSAO_MS = 12 * 60 * 60 * 1000;

const assinar = (texto) => crypto.createHmac('sha256', SESSION_SECRET).update(texto).digest('hex');

function abrirSessao(req, res, professorId) {
  const conteudo = `${professorId}.${Date.now() + DURACAO_SESSAO_MS}`;
  res.cookie(COOKIE_SESSAO, `${conteudo}.${assinar(conteudo)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure || req.get('x-forwarded-proto') === 'https',
    maxAge: DURACAO_SESSAO_MS,
  });
}

// Devolve o id do professor da sessão, ou null se não houver sessão válida.
function professorDaSessao(req) {
  const cookie = String(req.headers.cookie || '')
    .split(';')
    .map((parte) => parte.trim())
    .find((parte) => parte.startsWith(`${COOKIE_SESSAO}=`));
  if (!cookie) return null;
  const [id, expira, assinatura] = decodeURIComponent(cookie.slice(COOKIE_SESSAO.length + 1)).split('.');
  if (!/^\d+$/.test(id || '') || !/^\d+$/.test(expira || '') || !assinatura) return null;
  const esperada = Buffer.from(assinar(`${id}.${expira}`));
  const recebida = Buffer.from(assinatura);
  if (esperada.length !== recebida.length || !crypto.timingSafeEqual(esperada, recebida)) return null;
  if (Number(expira) < Date.now()) return null;
  return id;
}

// Middleware: só deixa passar o professor administrador logado.
async function exigirAdmin(req, res, next) {
  try {
    const id = professorDaSessao(req);
    const professor = id ? await professorModel.buscarPorId(id) : null;
    if (professor && professor.ativo && professor.admin) {
      req.professor = professor;
      return next();
    }
    if (req.path.startsWith('/api/')) {
      return res.status(professor ? 403 : 401).json({ erro: 'Acesso restrito ao administrador. Entre novamente com a conta administradora.' });
    }
    return res.redirect('/login/professor?erro=admin');
  } catch (err) {
    next(err);
  }
}

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

app.get('/dashboard-professor/usuarios', exigirAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'usuarios-professor.html'));
});

// Encerra a sessão do professor e volta para a tela inicial.
app.get('/sair', (req, res) => {
  res.clearCookie(COOKIE_SESSAO);
  res.redirect('/');
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

// Feedback do professor para o aluno em uma história específica (portal do aluno → "Ver feedback").
app.get('/api/alunos/:id/historias/:historiaId/feedback', async (req, res) => {
  try {
    const { id, historiaId } = req.params;
    if (!/^\d+$/.test(String(id)) || !/^\d+$/.test(String(historiaId))) {
      return res.status(400).json({ erro: 'ID de aluno ou de história inválido.' });
    }
    const resposta = await respostaModel.buscarPorAlunoHistoria(id, historiaId);
    if (!resposta) return res.status(404).json({ erro: 'Você ainda não respondeu esta história.' });
    const historia = await historiaModel.buscarPorId(historiaId);
    const feedbacks = await comentarioModel.listarVisiveisParaAluno(id, historiaId);
    res.json({
      historia_titulo: historia ? historia.titulo : null,
      historia_codigo: historia ? historia.codigo : null,
      status: resposta.status,
      enviada_em: resposta.enviada_em,
      feedbacks,
    });
  } catch (err) {
    console.error('Erro ao buscar feedback do aluno:', err);
    res.status(500).json({ erro: 'Erro ao buscar o feedback.' });
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
   ADMINISTRAÇÃO: CADASTRO DE PROFESSORES
============================================================ */

// Quem está logado (usado no painel para mostrar o atalho de administração).
app.get('/api/sessao', async (req, res) => {
  try {
    const id = professorDaSessao(req);
    const professor = id ? await professorModel.buscarPorId(id) : null;
    if (!professor || !professor.ativo) return res.status(401).json({ erro: 'Sessão não encontrada.' });
    res.json({ id: professor.id, nome: professor.nome, email: professor.email, admin: Boolean(professor.admin) });
  } catch (err) {
    console.error('Erro ao consultar sessão:', err);
    res.status(500).json({ erro: 'Erro ao consultar a sessão.' });
  }
});

app.get('/api/admin/professores', exigirAdmin, async (req, res) => {
  try {
    res.json(await professorModel.listar());
  } catch (err) {
    console.error('Erro ao listar professores:', err);
    res.status(500).json({ erro: 'Erro ao buscar os professores.' });
  }
});

// Cadastra um professor com a senha padrão (Senac123).
app.post('/api/admin/professores', exigirAdmin, async (req, res) => {
  try {
    const nome = String(req.body.nome || '').trim().replace(/\s+/g, ' ');
    const email = String(req.body.email || '').trim().toLowerCase();
    if (nome.length < 3 || nome.length > 120) {
      return res.status(400).json({ erro: 'Informe o nome completo do professor (3 a 120 caracteres).' });
    }
    if (email.length > 160 || !/^[^\s@]+@ms\.senac\.br$/.test(email)) {
      return res.status(400).json({ erro: 'O e-mail precisa ser corporativo, terminando em @ms.senac.br.' });
    }
    const criado = await professorModel.criar(nome, email, professorModel.SENHA_PADRAO);
    res.status(201).json({ ...criado, senha_padrao: professorModel.SENHA_PADRAO });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ erro: 'Já existe um professor cadastrado com este e-mail.' });
    console.error('Erro ao cadastrar professor:', err);
    res.status(500).json({ erro: 'Erro ao cadastrar o professor.' });
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
    const emailNormalizado = String(email || '').trim().toLowerCase();
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

    abrirSessao(req, res, professor.id);
    const q = new URLSearchParams({ id: String(professor.id), email: professor.email, nome: professor.nome });
    res.redirect(`/dashboard-professor?${q.toString()}`);
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
      body: req.body, // competências, conceito_final e checkboxes do formulário
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
      const contaAdmin = await professorModel.garantirAdministrador();
      console.log(`Conta administradora (${professorModel.ADMIN.email}) ${contaAdmin}.`);
    } catch (err) {
      console.error('Erro ao aplicar migrações:', err.message);
    }
  }
});
