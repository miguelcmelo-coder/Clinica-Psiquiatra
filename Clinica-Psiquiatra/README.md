# Clínica Psiquiátrica — Barra Funda

Site institucional com área de autenticação (HTML, CSS e JavaScript puros).

## Páginas de autenticação

| Página | Descrição |
| --- | --- |
| `templates/login.html` | Login (e-mail e senha), "Manter conectado" e **Esqueci minha senha** |
| `templates/bem-vindo.html` | Boas-vindas com o nome do usuário autenticado e botão **Sair do sistema** |
| `templates/cadastro.html` | Cadastro (agora cria a conta de verdade) |
| `templates/privacidade.html` | Política de privacidade (texto-base, revisar) |

Arquivos: `static/js/auth.js` (núcleo), `login.js`, `bem-vindo.js`, `formulario.js`, `main.js` e `static/css/auth.css`.

## Como testar

Abra `index.html` (ou sirva a pasta com `python -m http.server`) e clique em **ENTRAR**.

Conta de demonstração: `paciente@exemplo.com` / `Clinica@123`

## Importante

Sem servidor, as contas ficam no `localStorage` do navegador (senhas com PBKDF2 + salt, nunca em texto).
Isso serve para a atividade e demonstração. Em produção a autenticação deve ser feita em um back-end com HTTPS,
e o código de recuperação enviado por e-mail (aqui ele aparece na tela, em "modo demonstração").
Remova também o bloco "Conta de demonstração" do `login.html`.
