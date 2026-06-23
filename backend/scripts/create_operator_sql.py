import argparse
import getpass
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app.security import hash_password  # noqa: E402


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def main() -> None:
    parser = argparse.ArgumentParser(description="Gera SQL para criar o operador unico do HydroSys.")
    parser.add_argument("--email", required=True, help="E-mail do operador.")
    parser.add_argument("--name", default="Operador HydroSys", help="Nome exibido para o operador.")
    args = parser.parse_args()

    password = getpass.getpass("Senha do operador: ")
    confirmation = getpass.getpass("Confirme a senha do operador: ")
    if password != confirmation:
        raise SystemExit("As senhas nao conferem.")
    if len(password) < 8:
        raise SystemExit("Use uma senha com pelo menos 8 caracteres.")

    password_hash = hash_password(password)
    email = args.email.strip().lower()
    name = args.name.strip()

    print(
        "insert into public.app_users (name, email, password_hash, role, active)\n"
        f"values ({sql_literal(name)}, {sql_literal(email)}, {sql_literal(password_hash)}, 'OPERATOR', true);"
    )


if __name__ == "__main__":
    main()
