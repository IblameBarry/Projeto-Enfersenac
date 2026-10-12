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

`DB_SSL=true` habilita TLS. `DB_SSL_REJECT_UNAUTHORIZED=false` é uma opção de compatibilidade com conexões cujo certificado não é reconhecido pelo Node.js; a conexão continua criptografada, mas a identidade do certificado não é validada. Prefira `true` quando a cadeia de certificados do sistema estiver configurada corretamente.
