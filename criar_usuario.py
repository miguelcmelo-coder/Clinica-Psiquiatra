"""Cria um usuário de teste com senha em bcrypt.
Uso: python criar_usuario.py "Nome" email@exemplo.com SenhaForte123
"""
import sys
import bcrypt
from login import conectar_banco

if len(sys.argv) != 4:
    sys.exit('Uso: python criar_usuario.py "Nome" email senha')

nome, email, senha = sys.argv[1], sys.argv[2].lower(), sys.argv[3]
hash_senha = bcrypt.hashpw(senha.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

conexao = conectar_banco()
cursor = conexao.cursor()
cursor.execute(
    "INSERT INTO usuario (nome, email, senha) VALUES (%s, %s, %s)",
    (nome, email, hash_senha),
)
conexao.commit()
print("Usuário criado:", email)
