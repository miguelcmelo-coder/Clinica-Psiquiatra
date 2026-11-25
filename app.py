from flask import Flask, render_template, redirect, url_for, session, request, flash
from dotenv import load_dotenv
from pathlib import Path
import os
import mysql.connector
import bcrypt

load_dotenv(Path(__file__).with_name(".env"))

from login import login_bp
from esqueceu_senha import recuperacao_bp

app = Flask(__name__, static_folder="static", template_folder="templates")
secret = os.getenv("FLASK_SECRET_KEY")
if not secret:
    raise RuntimeError("FLASK_SECRET_KEY não está configurada no arquivo .env")
app.secret_key = secret
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.getenv("COOKIE_SECURE", "false").lower() == "true",
    PERMANENT_SESSION_LIFETIME=__import__("datetime").timedelta(days=7),
)

app.register_blueprint(login_bp)
app.register_blueprint(recuperacao_bp)

@app.route("/")
def inicio():
    return render_template("index.html")

@app.route("/templates/<pagina>.html")
def paginas(pagina):
    permitidas = {"sobre", "especialidades", "medicos", "contato", "privacidade"}
    if pagina not in permitidas:
        return redirect(url_for("login.login"))
    return render_template(f"{pagina}.html")

@app.route("/cadastro", methods=["GET", "POST"])
def cadastro():
    if request.method == "POST":
        nome = request.form.get("nome", "").strip()
        email = request.form.get("email", "").strip().lower()
        telefone = request.form.get("telefone", "").strip()
        senha = request.form.get("senha", "")
        confirmar = request.form.get("confirmarSenha", "")
        if len(nome) < 3 or "@" not in email:
            flash("Confira seu nome e seu e-mail.", "erro")
        elif len(senha) < 8:
            flash("A senha deve ter pelo menos 8 caracteres.", "erro")
        elif senha != confirmar:
            flash("As senhas não coincidem.", "erro")
        elif not request.form.get("aceite"):
            flash("É necessário aceitar a política de privacidade.", "erro")
        else:
            conexao = None
            cursor = None
            try:
                conexao = mysql.connector.connect(host=os.getenv("MYSQL_HOST"), user=os.getenv("MYSQL_USER"), password=os.getenv("MYSQL_PASSWORD"), database=os.getenv("MYSQL_DATABASE"))
                cursor = conexao.cursor()
                cursor.execute("INSERT INTO usuario (nome, email, senha, ativo) VALUES (%s, %s, %s, 1)", (nome, email, bcrypt.hashpw(senha.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")))
                conexao.commit()
                flash("Cadastro realizado! Agora você já pode entrar.", "sucesso")
                return redirect(url_for("login.login"))
            except mysql.connector.IntegrityError:
                flash("Já existe uma conta cadastrada com esse e-mail.", "erro")
            except mysql.connector.Error:
                app.logger.exception("Falha ao cadastrar usuário")
                flash("Não foi possível concluir o cadastro. Verifique a conexão com o banco de dados.", "erro")
            finally:
                if cursor: cursor.close()
                if conexao and conexao.is_connected(): conexao.close()
    return render_template("cadastro.html")

@app.route("/bem-vindo")
def bem_vindo():
    if "usuario_id" not in session:
        return redirect(url_for("login.login"))
    return render_template("bem-vindo.html", nome=session.get("usuario_nome", "Paciente"))

@app.errorhandler(404)
def pagina_nao_encontrada(_erro):
    return redirect(url_for("inicio"))

if __name__ == "__main__":
    app.run(debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")
