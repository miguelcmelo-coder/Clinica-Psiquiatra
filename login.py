from flask import Blueprint, render_template, request
from flask import redirect, url_for, session, flash
from werkzeug.security import check_password_hash
import mysql.connector
import bcrypt
import os
from dotenv import load_dotenv

load_dotenv()

login_bp = Blueprint("login", __name__)


def conectar_banco():
    return mysql.connector.connect(
        host=os.getenv("MYSQL_HOST"),
        user=os.getenv("MYSQL_USER"),
        password=os.getenv("MYSQL_PASSWORD"),
        database=os.getenv("MYSQL_DATABASE"),
    )


def senha_confere(senha_digitada: str, hash_salvo: str) -> bool:
    """Aceita hashes bcrypt ($2a/$2b/$2y) e hashes do Werkzeug."""
    try:
        if hash_salvo.startswith("$2"):
            return bcrypt.checkpw(
                senha_digitada.encode("utf-8"), hash_salvo.encode("utf-8")
            )
        return check_password_hash(hash_salvo, senha_digitada)
    except ValueError:
        return False


@login_bp.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form["email"].strip().lower()
        senha = request.form["senha"]

        conexao = conectar_banco()
        cursor = conexao.cursor(dictionary=True)
        try:
            cursor.execute(
                "SELECT id, nome, senha, ativo FROM usuario WHERE email = %s",
                (email,),
            )
            usuario = cursor.fetchone()
        finally:
            cursor.close()
            conexao.close()

        # Mensagem única: não revela se o e-mail existe ou se a senha está errada
        if usuario and senha_confere(senha, usuario["senha"]):
            if not usuario["ativo"]:
                flash("Conta inativa. Procure a administração da clínica.", "erro")
            else:
                session.clear()
                session["usuario_id"] = usuario["id"]
                session["usuario_nome"] = usuario["nome"]
                return redirect(url_for("login.painel"))
        else:
            flash("E-mail ou senha incorretos.", "erro")

    return render_template("login.html")


@login_bp.route("/painel")
def painel():
    if "usuario_id" not in session:
        flash("Faça login para continuar.", "erro")
        return redirect(url_for("login.login"))
    return render_template("painel.html", nome=session["usuario_nome"])


@login_bp.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login.login"))
