/* =====================================================
   AUTENTICAÇÃO — Clínica Psiquiátrica (front-end)

   ATENÇÃO: sem servidor, os dados ficam no navegador
   (localStorage/sessionStorage). Serve para a atividade
   e para demonstração. Em produção, a autenticação
   precisa ser feita em um back-end com HTTPS.
===================================================== */
(function (global) {
    'use strict';

    const K = {
        usuarios: 'clinica.usuarios',
        sessao: 'clinica.sessao',
        tentativas: 'clinica.tentativas',
        recuperacao: 'clinica.recuperacao',
        demo: 'clinica.demo'
    };

    const CFG = {
        maxTentativas: 5,                      // falhas antes de bloquear
        bloqueioMs: 30 * 1000,                 // tempo de bloqueio
        inatividadeMs: 30 * 60 * 1000,         // sessão sem "lembrar-me"
        lembrarMs: 7 * 24 * 60 * 60 * 1000,    // sessão com "lembrar-me"
        codigoMs: 10 * 60 * 1000,              // validade do código de recuperação
        iteracoes: 100000                      // PBKDF2
    };

    const CONTA_DEMO = {
        nome: 'Maria Souza',
        email: 'paciente@exemplo.com',
        senha: 'Clinica@123'
    };

    /* ---------- armazenamento seguro ---------- */

    function ler(tipo, chave, padrao) {
        try {
            const valor = global[tipo].getItem(chave);
            return valor ? JSON.parse(valor) : padrao;
        } catch (e) {
            return padrao;
        }
    }

    function gravar(tipo, chave, valor) {
        try {
            global[tipo].setItem(chave, JSON.stringify(valor));
            return true;
        } catch (e) {
            return false;
        }
    }

    function remover(tipo, chave) {
        try { global[tipo].removeItem(chave); } catch (e) { /* ignora */ }
    }

    /* ---------- criptografia da senha ---------- */

    const encoder = new TextEncoder();

    function paraHex(buffer) {
        return Array.from(new Uint8Array(buffer))
            .map(function (b) { return b.toString(16).padStart(2, '0'); })
            .join('');
    }

    function aleatorios(qtd) {
        const bytes = new Uint8Array(qtd);
        if (global.crypto && global.crypto.getRandomValues) {
            global.crypto.getRandomValues(bytes);
        } else {
            for (let i = 0; i < qtd; i++) bytes[i] = Math.floor(Math.random() * 256);
        }
        return bytes;
    }

    function gerarSalt() {
        return paraHex(aleatorios(16));
    }

    // A senha nunca é guardada: só o resultado do PBKDF2 + salt.
    async function derivar(texto, salt) {
        if (global.crypto && global.crypto.subtle) {
            const chave = await global.crypto.subtle.importKey(
                'raw', encoder.encode(texto), 'PBKDF2', false, ['deriveBits']
            );
            const bits = await global.crypto.subtle.deriveBits(
                { name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations: CFG.iteracoes },
                chave, 256
            );
            return paraHex(bits);
        }
        // Alternativa fraca, apenas se o navegador não tiver crypto.subtle
        let h = 5381;
        const s = salt + texto;
        for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
        return 'f' + (h >>> 0).toString(16);
    }

    /* ---------- validações ---------- */

    function normalizarEmail(email) {
        return String(email || '').trim().toLowerCase();
    }

    function emailValido(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
    }

    // Retorna a mensagem de erro ou '' se a senha for válida
    function validarSenha(senha) {
        if (!senha || senha.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
        if (!/[A-Za-zÀ-ÿ]/.test(senha) || !/\d/.test(senha)) {
            return 'Use letras e números na senha.';
        }
        return '';
    }

    function primeiroNome(nome) {
        return String(nome || '').trim().split(/\s+/)[0] || '';
    }

    /* ---------- usuários ---------- */

    function listarUsuarios() {
        return ler('localStorage', K.usuarios, []);
    }

    function salvarUsuarios(lista) {
        return gravar('localStorage', K.usuarios, lista);
    }

    async function cadastrar(dados) {
        const email = normalizarEmail(dados.email);
        const nome = String(dados.nome || '').trim().replace(/\s+/g, ' ');

        if (nome.length < 3) return { ok: false, campo: 'nome', erro: 'Informe seu nome completo.' };
        if (!emailValido(email)) return { ok: false, campo: 'email', erro: 'Informe um e-mail válido.' };

        const erroSenha = validarSenha(dados.senha);
        if (erroSenha) return { ok: false, campo: 'senha', erro: erroSenha };

        const usuarios = listarUsuarios();
        if (usuarios.some(function (u) { return u.email === email; })) {
            return { ok: false, campo: 'email', erro: 'Já existe um cadastro com este e-mail.' };
        }

        const salt = gerarSalt();
        usuarios.push({
            id: Date.now().toString(36) + paraHex(aleatorios(4)),
            nome: nome,
            email: email,
            telefone: dados.telefone || '',
            salt: salt,
            hash: await derivar(dados.senha, salt),
            criadoEm: Date.now(),
            ultimoAcesso: null
        });

        if (!salvarUsuarios(usuarios)) {
            return { ok: false, erro: 'Não foi possível salvar o cadastro neste navegador.' };
        }
        return { ok: true };
    }

    // Cria uma conta de teste na primeira visita
    async function prepararDemo() {
        if (ler('localStorage', K.demo, false)) return;
        gravar('localStorage', K.demo, true);
        await cadastrar(CONTA_DEMO);
    }

    /* ---------- bloqueio por tentativas ---------- */

    function bloqueadoAte(email) {
        const registro = ler('localStorage', K.tentativas, {})[email];
        return registro && registro.ate > Date.now() ? registro.ate : 0;
    }

    function registrarFalha(email) {
        const todos = ler('localStorage', K.tentativas, {});
        let r = todos[email] || { n: 0 };
        if (r.ate && r.ate <= Date.now()) r = { n: 0 };
        r.n += 1;
        if (r.n >= CFG.maxTentativas) {
            r.ate = Date.now() + CFG.bloqueioMs;
            r.n = 0;
        }
        todos[email] = r;
        gravar('localStorage', K.tentativas, todos);
    }

    function limparFalhas(email) {
        const todos = ler('localStorage', K.tentativas, {});
        delete todos[email];
        gravar('localStorage', K.tentativas, todos);
    }

    /* ---------- sessão ---------- */

    function criarSessao(usuario, acessoAnterior, lembrar) {
        remover('sessionStorage', K.sessao);
        remover('localStorage', K.sessao);
        gravar(lembrar ? 'localStorage' : 'sessionStorage', K.sessao, {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            ultimoAcesso: acessoAnterior,
            lembrar: !!lembrar,
            expira: Date.now() + (lembrar ? CFG.lembrarMs : CFG.inatividadeMs)
        });
    }

    function sessaoAtual() {
        const tipos = ['sessionStorage', 'localStorage'];
        for (let i = 0; i < tipos.length; i++) {
            const s = ler(tipos[i], K.sessao, null);
            if (!s) continue;
            if (s.expira > Date.now()) return s;
            remover(tipos[i], K.sessao);
        }
        return null;
    }

    // Reinicia o tempo de inatividade (sessões sem "lembrar-me")
    function renovarSessao() {
        const s = sessaoAtual();
        if (!s || s.lembrar) return;
        s.expira = Date.now() + CFG.inatividadeMs;
        gravar('sessionStorage', K.sessao, s);
    }

    // Use no topo de páginas protegidas
    function exigirLogin(destino) {
        const s = sessaoAtual();
        if (!s) {
            global.location.replace((destino || 'login.html') + '?sessao=expirada');
            return null;
        }
        return s;
    }

    function sair() {
        remover('sessionStorage', K.sessao);
        remover('localStorage', K.sessao);
    }

    async function entrar(email, senha, lembrar) {
        email = normalizarEmail(email);

        const ate = bloqueadoAte(email);
        if (ate) {
            return { ok: false, bloqueadoAte: ate, erro: 'Muitas tentativas. Aguarde um pouco para tentar novamente.' };
        }

        const usuarios = listarUsuarios();
        const usuario = usuarios.find(function (u) { return u.email === email; });

        // Calcula o hash mesmo sem usuário, para não revelar se o e-mail existe pelo tempo de resposta
        const hash = await derivar(senha, usuario ? usuario.salt : 'sem-usuario');

        if (!usuario || hash !== usuario.hash) {
            registrarFalha(email);
            return { ok: false, bloqueadoAte: bloqueadoAte(email), erro: 'E-mail ou senha incorretos.' };
        }

        limparFalhas(email);
        const anterior = usuario.ultimoAcesso;
        usuario.ultimoAcesso = Date.now();
        salvarUsuarios(usuarios);
        criarSessao(usuario, anterior, lembrar);
        return { ok: true };
    }

    /* ---------- recuperação de senha (simulada) ---------- */

    function codigoAleatorio() {
        const n = new Uint32Array(1);
        if (global.crypto && global.crypto.getRandomValues) global.crypto.getRandomValues(n);
        else n[0] = Math.floor(Math.random() * 4294967295);
        return String(100000 + (n[0] % 900000));
    }

    // Resposta igual exista ou não a conta, para não revelar quais e-mails estão cadastrados.
    // Só o modo demonstração devolve o código (em produção ele iria por e-mail).
    async function iniciarRecuperacao(email) {
        email = normalizarEmail(email);
        const usuario = listarUsuarios().find(function (u) { return u.email === email; });
        if (!usuario) return { ok: true };

        const codigo = codigoAleatorio();
        gravar('sessionStorage', K.recuperacao, {
            email: email,
            codigoHash: await derivar(codigo, usuario.salt),
            expira: Date.now() + CFG.codigoMs,
            tentativas: 0
        });
        return { ok: true, codigoDemo: codigo };
    }

    async function redefinirSenha(email, codigo, novaSenha) {
        email = normalizarEmail(email);
        const falha = { ok: false, erro: 'Código inválido ou expirado. Solicite um novo código.' };

        const r = ler('sessionStorage', K.recuperacao, null);
        if (!r || r.email !== email || r.expira < Date.now() || r.tentativas >= 5) return falha;

        const usuarios = listarUsuarios();
        const usuario = usuarios.find(function (u) { return u.email === email; });
        if (!usuario) return falha;

        if ((await derivar(String(codigo).trim(), usuario.salt)) !== r.codigoHash) {
            r.tentativas += 1;
            gravar('sessionStorage', K.recuperacao, r);
            return falha;
        }

        const erroSenha = validarSenha(novaSenha);
        if (erroSenha) return { ok: false, campo: 'senha', erro: erroSenha };

        usuario.salt = gerarSalt();
        usuario.hash = await derivar(novaSenha, usuario.salt);
        salvarUsuarios(usuarios);
        remover('sessionStorage', K.recuperacao);
        limparFalhas(email);
        return { ok: true };
    }

    global.Auth = {
        CONTA_DEMO: CONTA_DEMO,
        cadastrar: cadastrar,
        entrar: entrar,
        sair: sair,
        sessaoAtual: sessaoAtual,
        renovarSessao: renovarSessao,
        exigirLogin: exigirLogin,
        iniciarRecuperacao: iniciarRecuperacao,
        redefinirSenha: redefinirSenha,
        prepararDemo: prepararDemo,
        emailValido: emailValido,
        normalizarEmail: normalizarEmail,
        validarSenha: validarSenha,
        primeiroNome: primeiroNome
    };
})(window);
