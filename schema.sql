-- Execute no banco definido por MYSQL_DATABASE no arquivo .env.

CREATE TABLE IF NOT EXISTS usuario (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    email VARCHAR(180) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    ativo TINYINT(1) DEFAULT 1
);

CREATE TABLE IF NOT EXISTS recuperacao_senha (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    codigo_hash VARCHAR(64) NOT NULL,
    validade DATETIME NOT NULL,
    tentativas INT DEFAULT 0,
    utilizado TINYINT(1) DEFAULT 0,
    FOREIGN KEY (id_usuario) REFERENCES usuario(id)
);
