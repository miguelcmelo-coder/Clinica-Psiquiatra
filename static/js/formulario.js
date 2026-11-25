/* Formulário de cadastro: validação e criação da conta */
(function () {
    'use strict';

    const formulario = document.getElementById('formCadastro');
    if (!formulario) return;

    const $ = function (id) { return document.getElementById(id); };
    const mensagem = $('mensagem');
    const botao = formulario.querySelector('button[type="submit"]');

    /* ---------- máscaras ---------- */

    $('cpf').addEventListener('input', function (e) {
        let v = e.target.value.replace(/\D/g, '').slice(0, 11);
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        e.target.value = v;
    });

    $('telefone').addEventListener('input', function (e) {
        let v = e.target.value.replace(/\D/g, '').slice(0, 11);
        if (v.length > 10) v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
        else if (v.length > 6) v = v.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
        else if (v.length > 2) v = v.replace(/^(\d{2})(\d{0,5})$/, '($1) $2');
        e.target.value = v;
    });

    /* ---------- validações ---------- */

    // Confere os dígitos verificadores do CPF
    function cpfValido(valor) {
        const n = valor.replace(/\D/g, '');
        if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
        for (let t = 9; t < 11; t++) {
            let soma = 0;
            for (let i = 0; i < t; i++) soma += Number(n[i]) * (t + 1 - i);
            const digito = ((soma * 10) % 11) % 10;
            if (digito !== Number(n[t])) return false;
        }
        return true;
    }

    function idadeValida(data) {
        const nasc = new Date(data + 'T00:00:00');
        const hoje = new Date();
        return !isNaN(nasc) && nasc < hoje && nasc.getFullYear() > 1900;
    }

    function aviso(tipo, texto, campo) {
        mensagem.className = 'mensagem ' + tipo;
        mensagem.style.display = 'block';
        mensagem.textContent = texto;
        if (campo) {
            campo.setAttribute('aria-invalid', 'true');
            campo.focus();
        }
    }

    formulario.addEventListener('input', function (e) {
        e.target.removeAttribute('aria-invalid');
    });

    /* ---------- envio ---------- */

    formulario.addEventListener('submit', async function (evento) {
        evento.preventDefault();
        mensagem.style.display = 'none';
        formulario.querySelectorAll('[aria-invalid]').forEach(function (i) { i.removeAttribute('aria-invalid'); });

        if (!cpfValido($('cpf').value)) {
            return aviso('erro', 'CPF inválido. Confira os números digitados.', $('cpf'));
        }
        if (!idadeValida($('nascimento').value)) {
            return aviso('erro', 'Data de nascimento inválida.', $('nascimento'));
        }
        if ($('telefone').value.replace(/\D/g, '').length < 10) {
            return aviso('erro', 'Informe um telefone com DDD.', $('telefone'));
        }

        const erroSenha = Auth.validarSenha($('senha').value);
        if (erroSenha) return aviso('erro', erroSenha, $('senha'));

        if ($('senha').value !== $('confirmarSenha').value) {
            return aviso('erro', 'As senhas não coincidem. Confira os campos.', $('confirmarSenha'));
        }

        botao.disabled = true;
        const textoOriginal = botao.textContent;
        botao.textContent = 'CRIANDO CADASTRO...';

        // CPF e data de nascimento são validados aqui, mas não ficam salvos no navegador
        const resultado = await Auth.cadastrar({
            nome: $('nome').value,
            email: $('email').value,
            telefone: $('telefone').value,
            senha: $('senha').value
        });

        if (!resultado.ok) {
            botao.disabled = false;
            botao.textContent = textoOriginal;
            return aviso('erro', resultado.erro, resultado.campo ? $(resultado.campo) : null);
        }

        aviso('sucesso', 'Cadastro criado! Redirecionando para o login...');
        setTimeout(function () { window.location.href = 'login.html?cadastro=1'; }, 1200);
    });
})();
