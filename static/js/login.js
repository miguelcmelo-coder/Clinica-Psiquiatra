/* Página de login: entrar + esqueci minha senha */
(function () {
    'use strict';

    // Quem já está autenticado vai direto para a página de boas-vindas
    if (Auth.sessaoAtual()) {
        window.location.replace('bem-vindo.html');
        return;
    }

    Auth.prepararDemo();

    const $ = function (id) { return document.getElementById(id); };

    const alerta = $('alerta');
    const viewLogin = $('viewLogin');
    const viewRecuperar = $('viewRecuperar');
    const formLogin = $('formLogin');
    const formRecuperar = $('formRecuperar');
    const formRedefinir = $('formRedefinir');
    const btnEntrar = $('btnEntrar');

    let contagem = null;

    /* ---------- utilitários de interface ---------- */

    function mostrarAlerta(tipo, texto) {
        alerta.className = 'alerta' + (tipo ? ' ' + tipo : '');
        alerta.textContent = texto;
        alerta.hidden = false;
    }

    function limparAlerta() {
        alerta.hidden = true;
        alerta.textContent = '';
    }

    function erroCampo(input, mensagem) {
        const span = $('erro-' + input.id);
        if (!span) return; // ex.: checkbox "manter conectado"
        if (mensagem) {
            input.setAttribute('aria-invalid', 'true');
            span.textContent = mensagem;
        } else {
            input.removeAttribute('aria-invalid');
            span.textContent = '';
        }
    }

    function limparErros(form) {
        form.querySelectorAll('input').forEach(function (i) { erroCampo(i, ''); });
    }

    function carregando(botao, ativo, textoOcupado) {
        if (ativo) {
            botao.dataset.texto = botao.textContent;
            botao.textContent = textoOcupado;
            botao.disabled = true;
        } else {
            botao.textContent = botao.dataset.texto || botao.textContent;
            botao.disabled = false;
        }
    }

    function trocarTela(tela) {
        limparAlerta();
        viewLogin.hidden = tela !== 'login';
        viewRecuperar.hidden = tela !== 'recuperar';
        if (tela === 'login') {
            $('email').focus();
        } else {
            formRecuperar.hidden = false;
            formRedefinir.hidden = true;
            limparErros(formRecuperar);
            $('emailRec').focus();
        }
    }

    // Bloqueio temporário após muitas tentativas erradas
    function iniciarContagem(ate) {
        clearInterval(contagem);
        function atualizar() {
            const seg = Math.ceil((ate - Date.now()) / 1000);
            if (seg <= 0) {
                clearInterval(contagem);
                btnEntrar.disabled = false;
                btnEntrar.textContent = 'ENTRAR';
                limparAlerta();
                return;
            }
            btnEntrar.disabled = true;
            btnEntrar.textContent = 'AGUARDE ' + seg + 's';
        }
        atualizar();
        contagem = setInterval(atualizar, 500);
    }

    /* ---------- mensagens vindas de outras páginas ---------- */

    const params = new URLSearchParams(window.location.search);
    if (params.get('cadastro')) {
        mostrarAlerta('sucesso', 'Cadastro criado com sucesso! Entre com seu e-mail e senha.');
    } else if (params.get('saiu')) {
        mostrarAlerta('sucesso', 'Você saiu do sistema com segurança.');
    } else if (params.get('sessao')) {
        mostrarAlerta('', 'Faça login para continuar.');
    }

    /* ---------- mostrar / ocultar senha ---------- */

    document.querySelectorAll('.btn-mostrar').forEach(function (botao) {
        botao.addEventListener('click', function () {
            const campo = $(botao.dataset.alvo);
            const mostrar = campo.type === 'password';
            campo.type = mostrar ? 'text' : 'password';
            botao.textContent = mostrar ? 'OCULTAR' : 'MOSTRAR';
            botao.setAttribute('aria-pressed', String(mostrar));
            botao.setAttribute('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha');
        });
    });

    /* ---------- login ---------- */

    formLogin.addEventListener('submit', async function (evento) {
        evento.preventDefault();
        limparAlerta();
        limparErros(formLogin);

        const email = $('email');
        const senha = $('senha');
        let valido = true;

        if (!email.value.trim()) {
            erroCampo(email, 'Informe seu e-mail.');
            valido = false;
        } else if (!Auth.emailValido(Auth.normalizarEmail(email.value))) {
            erroCampo(email, 'Digite um e-mail válido, como nome@exemplo.com.');
            valido = false;
        }

        if (!senha.value) {
            erroCampo(senha, 'Informe sua senha.');
            valido = false;
        }

        if (!valido) {
            formLogin.querySelector('[aria-invalid="true"]').focus();
            return;
        }

        carregando(btnEntrar, true, 'ENTRANDO...');
        const resultado = await Auth.entrar(email.value, senha.value, $('lembrar').checked);

        if (resultado.ok) {
            window.location.href = 'bem-vindo.html';
            return;
        }

        carregando(btnEntrar, false);
        mostrarAlerta('erro', resultado.erro);
        senha.value = '';

        if (resultado.bloqueadoAte) {
            iniciarContagem(resultado.bloqueadoAte);
        } else {
            senha.focus();
        }
    });

    /* ---------- esqueci minha senha ---------- */

    $('btnEsqueci').addEventListener('click', function () {
        const digitado = $('email').value.trim();
        trocarTela('recuperar');
        if (digitado) $('emailRec').value = digitado;
    });

    $('btnVoltarLogin').addEventListener('click', function () { trocarTela('login'); });

    // Passo 1: pedir o código
    formRecuperar.addEventListener('submit', async function (evento) {
        evento.preventDefault();
        limparAlerta();

        const email = $('emailRec');
        erroCampo(email, '');

        if (!Auth.emailValido(Auth.normalizarEmail(email.value))) {
            erroCampo(email, 'Digite um e-mail válido, como nome@exemplo.com.');
            email.focus();
            return;
        }

        const botao = $('btnEnviarCodigo');
        carregando(botao, true, 'ENVIANDO...');
        const resultado = await Auth.iniciarRecuperacao(email.value);
        carregando(botao, false);

        formRecuperar.hidden = true;
        formRedefinir.hidden = false;

        // Mesma mensagem exista ou não o cadastro (não revela quais e-mails existem)
        const info = $('infoCodigo');
        info.textContent = 'Se o e-mail estiver cadastrado, enviamos um código de 6 dígitos. Ele vale por 10 minutos.';

        if (resultado.codigoDemo) {
            info.appendChild(document.createElement('br'));
            info.appendChild(document.createTextNode('Modo demonstração — seu código é '));
            const codigo = document.createElement('code');
            codigo.textContent = resultado.codigoDemo;
            info.appendChild(codigo);
            info.appendChild(document.createTextNode('.'));
        }

        $('codigo').focus();
    });

    // Passo 2: código + nova senha
    formRedefinir.addEventListener('submit', async function (evento) {
        evento.preventDefault();
        limparAlerta();
        limparErros(formRedefinir);

        const codigo = $('codigo');
        const nova = $('novaSenha');
        const confirmar = $('confirmarNova');
        let valido = true;

        if (!/^\d{6}$/.test(codigo.value.trim())) {
            erroCampo(codigo, 'Digite o código de 6 dígitos.');
            valido = false;
        }

        const erroSenha = Auth.validarSenha(nova.value);
        if (erroSenha) {
            erroCampo(nova, erroSenha);
            valido = false;
        }

        if (nova.value !== confirmar.value) {
            erroCampo(confirmar, 'As senhas não coincidem.');
            valido = false;
        }

        if (!valido) {
            formRedefinir.querySelector('[aria-invalid="true"]').focus();
            return;
        }

        const botao = $('btnRedefinir');
        carregando(botao, true, 'SALVANDO...');
        const resultado = await Auth.redefinirSenha($('emailRec').value, codigo.value, nova.value);
        carregando(botao, false);

        if (!resultado.ok) {
            mostrarAlerta('erro', resultado.erro);
            return;
        }

        formRedefinir.reset();
        $('email').value = $('emailRec').value;
        $('senha').value = '';
        trocarTela('login');
        mostrarAlerta('sucesso', 'Senha alterada com sucesso! Entre com a nova senha.');
        $('senha').focus();
    });
})();
