# Prontuário Online — PostgreSQL / Supabase

## Configuração

1. No Supabase, abra Connect e copie a URL do Session Pooler (porta 5432).
2. Copie `.env.example` para `.env` e substitua `PROJECT_REF` e `SUA_SENHA` pelos dados reais.
3. Se a senha tiver caracteres especiais, aplique URL encoding nela antes de inseri-la na URL.
4. Não envie `.env` ao GitHub nem compartilhe a URL com senha.

## Executar

```bash
npm install
npm run db:test
npm run dev
```

Abra http://localhost:3000.

## Dados de demonstração

```bash
npm run db:seed
```

O seed garante a conta administradora e cria uma história de exemplo apenas se ainda não existir.

## Conta administradora e cadastro de professores

- Administrador: **Nathan Fusinato Sacaramal** — `nathan.sacaramal@ms.senac.br`, senha inicial `Senac123`.
- A conta é garantida automaticamente quando o servidor inicia. Se ainda existir a antiga conta de demonstração do Carlos, ela é convertida na conta do Nathan (as histórias e feedbacks publicados continuam no painel); o e-mail do Carlos deixa de entrar.
- Logado como administrador, o painel mostra o botão **Professores** (`/dashboard-professor/usuarios`), onde é possível cadastrar novos professores com nome e e-mail `@ms.senac.br`. Todos recebem a senha padrão `Senac123`.
- O acesso à administração é validado no servidor por um cookie de sessão assinado. Configure `SESSION_SECRET` (texto longo e aleatório) no Render; sem ele, as sessões caem sempre que o servidor reinicia.
- O fuso usado para o "dia de hoje" (prazo das histórias) é `APP_TIMEZONE`, padrão `America/Campo_Grande`.

## Banco

O banco precisa ter recebido o schema PostgreSQL no SQL Editor do Supabase antes de iniciar a aplicação. Não execute um schema MySQL neste projeto. O aplicativo usa `DATABASE_URL` quando definida; também aceita a configuração dividida `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` e `DB_NAME`.

### Migrações

Alterações de banco posteriores ao schema inicial ficam em `database/migrations/*.sql` (ex.: nota final e competências do feedback docente). Elas são aplicadas automaticamente quando o servidor inicia e podem rodar várias vezes sem erro. Para aplicar manualmente:

```bash
npm run db:migrate
```

Também é possível colar o conteúdo do arquivo `.sql` no SQL Editor do Supabase.

`DB_SSL=true` habilita TLS. `DB_SSL_REJECT_UNAUTHORIZED=false` é uma opção de compatibilidade com conexões cujo certificado não é reconhecido pelo Node.js; a conexão continua criptografada, mas a identidade do certificado não é validada. Prefira `true` quando a cadeia de certificados do sistema estiver configurada corretamente.

## Correções de deploy (outubro de 2026)

- Os caminhos do logotipo foram padronizados para corresponder exatamente ao nome `public/img/logo_SenacF.png` (Linux diferencia maiúsculas e minúsculas).
- O login docente aceita somente endereços terminados em `@ms.senac.br`.
- O seed (`npm run db:seed`) cria uma história de exemplo no banco apontado por `DATABASE_URL`. Não execute sem confirmar o banco.
- Configure `DATABASE_URL`, `DB_SSL=true` e `DB_SSL_REJECT_UNAUTHORIZED=false` separadamente no Render. Nunca coloque credenciais reais em `.env.example` ou no repositório.


teste