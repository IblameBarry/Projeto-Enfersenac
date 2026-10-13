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

O seed cria o professor de teste e uma história apenas se ainda não existirem. A senha padrão depende do valor `DEFAULT` da coluna `professor.senha_hash` definido no schema instalado.

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
- A conta de demonstração só é criada/atualizada ao executar `npm run db:seed` com `DATABASE_URL` apontando para o banco correto. Não execute o seed sem confirmar o banco, pois ele altera a conta de demonstração e cria uma história de exemplo.
- Configure `DATABASE_URL`, `DB_SSL=true` e `DB_SSL_REJECT_UNAUTHORIZED=false` separadamente no Render. Nunca coloque credenciais reais em `.env.example` ou no repositório.


teste