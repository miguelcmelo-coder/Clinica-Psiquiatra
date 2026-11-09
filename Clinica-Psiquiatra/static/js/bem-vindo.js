/* Página de boas-vindas: protegida, mostra o usuário e permite sair */
(function () {
    'use strict';

    const sessao = Auth.exigirLogin('login.html');
    if (!sessao) return;

    const $ = function (id) { return document.getElementById(id); };

    /* ---------- dados do usuário (textContent evita injeção de HTML) ---------- */

    const hora = new Date().getHours();
    const saudacao = hora < 12 ? 'BOM DIA' : hora < 18 ? 'BOA TARDE' : 'BOA NOITE';

    $('saudacao').textContent = saudacao + ' · ÁREA DO PACIENTE';
    $('nomeUsuario').textContent = Auth.primeiroNome(sessao.nome);
    $('dadoNome').textContent = sessao.nome;
    $('dadoEmail').textContent = sessao.email;
    $('dadoAcesso').textContent = sessao.ultimoAcesso
        ? new Date(sessao.ultimoAcesso).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })
        : 'Este é o seu primeiro acesso';

    document.title = 'Bem-vindo(a), ' + Auth.primeiroNome(sessao.nome) + ' | Clínica Psiquiátrica';
    document.body.classList.remove('carregando');

    /* ---------- sair ---------- */

    function sair() {
        Auth.sair();
        window.location.replace('login.html?saiu=1');
    }

    $('btnSair').addEventListener('click', sair);

    /* ---------- segurança da sessão ---------- */

    // Renova o tempo de inatividade quando a pessoa usa a página
    let ultimaRenovacao = Date.now();
    ['click', 'keydown', 'scroll', 'touchstart'].forEach(function (tipo) {
        window.addEventListener(tipo, function () {
            if (Date.now() - ultimaRenovacao > 15000) {
                Auth.renovarSessao();
                ultimaRenovacao = Date.now();
            }
        }, { passive: true });
    });

    // Encerra automaticamente quando a sessão expira
    setInterval(function () {
        if (!Auth.sessaoAtual()) window.location.replace('login.html?sessao=expirada');
    }, 30000);

    // Voltar pelo histórico depois de sair não deve mostrar a página em cache
    window.addEventListener('pageshow', function (evento) {
        if (evento.persisted && !Auth.sessaoAtual()) {
            window.location.replace('login.html?sessao=expirada');
        }
    });

    // Se sair em outra aba, sai aqui também
    window.addEventListener('storage', function () {
        if (!Auth.sessaoAtual()) window.location.replace('login.html?saiu=1');
    });
})();
