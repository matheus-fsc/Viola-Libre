import os
import sys
import subprocess

# Ensure paramiko is installed
try:
    import paramiko
except ImportError:
    print("Biblioteca 'paramiko' não encontrada. Instalando paramiko...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "paramiko"])
        import paramiko
    except Exception as e:
        print(f"Erro ao instalar 'paramiko': {e}")
        sys.exit(1)

def load_env():
    env_data = {}
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    if not os.path.exists(env_path):
        print("Erro: Arquivo .env não encontrado!")
        sys.exit(1)
        
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                key, val = line.split('=', 1)
                env_data[key.strip()] = val.strip()
    return env_data

def main():
    env = load_env()
    
    ip = env.get('ORANGEPI_IP')
    user = env.get('ORANGEPI_USER')
    password = env.get('ORANGEPI_PASS')
    dest_path = env.get('ORANGEPI_DEST_PATH', '~/scrapper')
    
    if not all([ip, user, password]):
        print("Erro: Verifique IP, USER e PASS no arquivo .env!")
        sys.exit(1)
        
    # SFTP não entende '~' de forma nativa sempre, vamos resolver:
    if dest_path.startswith('~'):
        dest_path = dest_path.replace('~', f'/home/{user}' if user != 'root' else '/root', 1)

    print(f"Conectando ao Orange Pi em {ip} como '{user}'...")
    
    try:
        # Create SSH client
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(ip, username=user, password=password, timeout=10)
        
        print(f"Conectado! Verificando pasta destino {dest_path}...")
        
        # Create folder if it doesn't exist
        ssh.exec_command(f"mkdir -p {dest_path}")
        
        # Start SFTP client
        sftp = ssh.open_sftp()
        
        # Deploy files
        files_to_deploy = [
            'main.py',
            'requirements.txt'
        ]
            
        for file_name in files_to_deploy:
            local_path = os.path.join(os.path.dirname(__file__), file_name)
            remote_path = f"{dest_path}/{file_name}"
            
            if os.path.exists(local_path):
                print(f"Enviando {file_name} -> {remote_path}...")
                sftp.put(local_path, remote_path)
            else:
                print(f"Aviso: Arquivo local {file_name} não encontrado, pulando...")
                
        sftp.close()
        
        print("\nInstalando dependências via SSH no Orange Pi...")
        stdin, stdout, stderr = ssh.exec_command(f"cd {dest_path} && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt")
        exit_status = stdout.channel.recv_exit_status()
        if exit_status == 0:
            print("Dependências instaladas com sucesso no Orange Pi!")
        else:
            print(f"Aviso ao instalar dependências: {stderr.read().decode('utf-8')}")

        ssh.close()
        print("\nDeploy concluído com sucesso!")
        print("--------------------------------------------------")
        print(f"Para iniciar o scraper 24/7 de forma invisível, acesse SSH e rode:")
        print(f"  cd {dest_path}")
        print(f"  source venv/bin/activate")
        print(f"  nohup python main.py > scraper.log 2>&1 &")
        print("--------------------------------------------------")
        
    except Exception as e:
        print(f"\nErro durante o deploy: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
