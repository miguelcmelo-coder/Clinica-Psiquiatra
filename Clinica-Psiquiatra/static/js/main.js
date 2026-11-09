/* Comportamento comum a todas as páginas do site */
document.addEventListener('DOMContentLoaded', function () {
    if (!window.Auth) return;

    // Se houver sessão, "ENTRAR" vira "MINHA ÁREA"
    const sessao = Auth.sessaoAtual();
    if (!sessao) return;

    document.querySelectorAll('[data-auth-link]').forEach(function (link) {
        link.textContent = 'MINHA ÁREA';
        link.setAttribute('href', link.getAttribute('data-area-href'));
    });
});
