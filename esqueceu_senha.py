from flask import Blueprint, render_template, request, flash
from flask import redirect, url_for, session
import mysql.connector
import resend
import bcrypt
import os
import secrets
import hashlib
import hmac
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

recuperacao_bp = Blueprint("recuperacao", __name__)
resend.api_key = os.getenv("RESEND_API_KEY")

VALIDADE_MINUTOS = 10
MAX_TENTATIVAS = 5
TAMANHO_MIN_SENHA = 8


def conectar_banco():
    return mysql.connector.connect(
        host=os.getenv("MYSQL_HOST"),
        user=os.getenv("MYSQL_USER"),
        password=os.getenv("MYSQL_PASSWORD"),
        database=os.getenv("MYSQL_DATABASE"),
    )


def hash_codigo(codigo: str) -> str:
    return hashlib.sha256(codigo.encode("utf-8")).hexdigest()


def enviar_codigo(email: str, nome: str) -> None:
    """Gera o código, grava o hash no banco e envia o e-mail. Só chamar para usuário existente."""
    codigo = f"{secrets.randbelow(1000000):06d}"
    validade = datetime.now() + timedelta(minutes=VALIDADE_MINUTOS)

    conexao = conectar_banco()
    cursor = conexao.cursor()
    try:
        # Invalida códigos anteriores ainda abertos deste usuário
        cursor.execute(
            """UPDATE recuperacao_senha r
               JOIN usuario u ON u.id = r.id_usuario
               SET r.utilizado = 1
               WHERE u.email = %s AND r.utilizado = 0""",
            (email,),
        )
        cursor.execute(
            """INSERT INTO recuperacao_senha (id_usuario, codigo_hash, validade)
               SELECT id, %s, %s FROM usuario WHERE email = %s""",
            (hash_codigo(codigo), validade, email),
        )
        conexao.commit()
    finally:
        cursor.close()
        conexao.close()

    resend.Emails.send({
        "from": os.getenv("EMAIL_FROM"),
        "to": [email],
        "subject": "Recuperação de senha - Clínica",
        "html": f"""
            <h2>Recuperação de senha</h2>
            <p>Olá, {nome}. Seu código de recuperação é:</p>
            <h1>{codigo}</h1>
            <p>Este código expira em {VALIDADE_MINUTOS} minutos.</p>
            <p>Se você não solicitou, ignore este e-mail.</p>
        """,
    })


def solicitar(email: str) -> None:
    """Busca o usuário e envia o código; erros são registrados, nunca mostrados ao visitante."""
    conexao = conectar_banco()
    cursor = conexao.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT nome FROM usuario WHERE email = %s AND ativo = 1", (email,)
        )
        usuario = cursor.fetchone()
    finally:
        cursor.close()
        conexao.close()

    if usuario:
        try:
            enviar_codigo(email, usuario["nome"])
        except Exception as erro:
            print(f"[ERRO] Falha ao enviar código: {erro}")


MSG_ENVIO = "Se o e-mail estiver cadastrado, você receberá um código em instantes."


@recuperacao_bp.route("/esqueceu-senha", methods=["GET", "POST"])
def esqueceu_senha():
    if request.method == "POST":
        email = request.form["email"].strip().lower()
        solicitar(email)
        # Resposta idêntica exista o e-mail ou não
        session.pop("rec_id", None)
        session["rec_email"] = email
        flash(MSG_ENVIO, "info")
        return redirect(url_for("recuperacao.verificar_codigo"))
    return render_template("esqueceu_senha.html")


@recuperacao_bp.route("/reenviar-codigo", methods=["POST"])
def reenviar_codigo():
    email = session.get("rec_email")
    if not email:
        return redirect(url_for("recuperacao.esqueceu_senha"))
    solicitar(email)
    flash(MSG_ENVIO, "info")
    return redirect(url_for("recuperacao.verificar_codigo"))


@recuperacao_bp.route("/verificar-codigo", methods=["GET", "POST"])
def verificar_codigo():
    email = session.get("rec_email")
    if not email:
        return redirect(url_for("recuperacao.esqueceu_senha"))

    if request.method == "POST":
        codigo = request.form["codigo"].strip()

        conexao = conectar_banco()
        cursor = conexao.cursor(dictionary=True)
        try:
            cursor.execute(
                """SELECT r.id, r.codigo_hash, r.validade, r.tentativas
                   FROM recuperacao_senha r
                   JOIN usuario u ON u.id = r.id_usuario
                   WHERE u.email = %s AND r.utilizado = 0
                   ORDER BY r.id DESC LIMIT 1""",
                (email,),
            )
            reg = cursor.fetchone()

            valido = (
                reg is not None
                and reg["validade"] > datetime.now()
                and reg["tentativas"] < MAX_TENTATIVAS
            )

            if valido:
                cursor.execute(
                    "UPDATE recuperacao_senha SET tentativas = tentativas + 1 WHERE id = %s",
                    (reg["id"],),
                )
                conexao.commit()

                if hmac.compare_digest(hash_codigo(codigo), reg["codigo_hash"]):
                    session["rec_id"] = reg["id"]
                    return redirect(url_for("recuperacao.nova_senha"))

            flash("Código inválido, expirado ou limite de tentativas atingido.", "erro")
        finally:
            cursor.close()
            conexao.close()

    return render_template("verificar_codigo.html", email=email)


@recuperacao_bp.route("/nova-senha", methods=["GET", "POST"])
def nova_senha():
    rec_id = session.get("rec_id")
    if not rec_id:
        return redirect(url_for("recuperacao.esqueceu_senha"))

    if request.method == "POST":
        senha = request.form["senha"]
        confirmar = request.form["confirmar"]

        if senha != confirmar:
            flash("A senha e a confirmação não são iguais.", "erro")
            return render_template("nova_senha.html")
        if len(senha) < TAMANHO_MIN_SENHA:
            flash(f"A senha deve ter pelo menos {TAMANHO_MIN_SENHA} caracteres.", "erro")
            return render_template("nova_senha.html")

        conexao = conectar_banco()
        cursor = conexao.cursor(dictionary=True)
        try:
            # Revalida o código no momento da troca
            cursor.execute(
                """SELECT id, id_usuario FROM recuperacao_senha
                   WHERE id = %s AND utilizado = 0 AND validade > %s""",
                (rec_id, datetime.now()),
            )
            reg = cursor.fetchone()
            if not reg:
                session.pop("rec_id", None)
                flash("Sessão de recuperação expirada. Solicite um novo código.", "erro")
                return redirect(url_for("recuperacao.esqueceu_senha"))

            nova_senha_hash = bcrypt.hashpw(
                senha.encode("utf-8"), bcrypt.gensalt()
            ).decode("utf-8")

            cursor.execute(
                "UPDATE usuario SET senha = %s WHERE id = %s",
                (nova_senha_hash, reg["id_usuario"]),
            )
            cursor.execute(
                "UPDATE recuperacao_senha SET utilizado = 1 WHERE id = %s",
                (reg["id"],),
            )
            conexao.commit()
        finally:
            cursor.close()
            conexao.close()

        session.pop("rec_id", None)
        session.pop("rec_email", None)
        flash("Senha alterada com sucesso! Faça login com a nova senha.", "sucesso")
        return redirect(url_for("login.login"))

    return render_template("nova_senha.html")
