import os
import time
import random
import sqlite3
import logging
import concurrent.futures
from urllib.parse import urljoin
from typing import List

import requests
from bs4 import BeautifulSoup
from fake_useragent import UserAgent

# Configurações do Scraper
BASE_URL = "https://www.cifraclub.com.br"
MAX_WORKERS = 3 # Paralelismo controlado (não aumentar muito para evitar bloqueios)
DELAY_RANGE = (1.5, 4.0) # Delay entre requisições em segundos
DB_PATH = "cifras_data.sqlite"

# Configuração de Logs
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(threadName)s: %(message)s',
    handlers=[
        logging.FileHandler("scraper.log", encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# User Agent dinâmico
ua = UserAgent()

def get_db_connection():
    """Retorna uma conexão isolada com o SQLite para cada thread."""
    conn = sqlite3.connect(DB_PATH, timeout=20)
    conn.row_factory = sqlite3.Row
    return conn

def setup_database():
    """Cria as tabelas necessárias para controlar o progresso (permitindo pausar e continuar 24/7)."""
    conn = get_db_connection()
    c = conn.cursor()
    # Tabela de letras processadas (A-Z, 0-9)
    c.execute('''CREATE TABLE IF NOT EXISTS letters (
                 letter TEXT PRIMARY KEY,
                 status TEXT DEFAULT 'pending' -- pending, done
                 )''')
    # Tabela de artistas
    c.execute('''CREATE TABLE IF NOT EXISTS artists (
                 url TEXT PRIMARY KEY,
                 name TEXT,
                 status TEXT DEFAULT 'pending' -- pending, done
                 )''')
    # Tabela de músicas
    c.execute('''CREATE TABLE IF NOT EXISTS songs (
                 url TEXT PRIMARY KEY,
                 artist_url TEXT,
                 title TEXT,
                 content_html TEXT,
                 status TEXT DEFAULT 'pending', -- pending, done, error
                 FOREIGN KEY(artist_url) REFERENCES artists(url)
                 )''')
    
    # Inserir letras iniciais se estiver vazio
    c.execute("SELECT COUNT(*) as count FROM letters")
    if c.fetchone()['count'] == 0:
        letters = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ") + ["0"]
        c.executemany("INSERT INTO letters (letter, status) VALUES (?, 'pending')", [(l,) for l in letters])
    
    conn.commit()
    conn.close()

def make_request(url: str) -> BeautifulSoup:
    """Faz a requisição HTTP com delay e tratamento de erro."""
    sleep_time = random.uniform(*DELAY_RANGE)
    time.sleep(sleep_time)
    
    headers = {
        "User-Agent": ua.random,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        "Referer": "https://www.google.com/"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        return BeautifulSoup(response.text, 'html.parser')
    except requests.RequestException as e:
        logger.error(f"Erro ao acessar {url}: {e}")
        return None

def process_letter(letter: str):
    """Passo 1: Extrai todos os artistas de uma letra."""
    logger.info(f"Processando letra: {letter}")
    url = f"{BASE_URL}/letra/{letter}/lista/"
    soup = make_request(url)
    if not soup: return

    conn = get_db_connection()
    c = conn.cursor()
    
    # Encontra os links dos artistas
    # <div class="ZOQ KESFS oV7RP"> ... <p class="primaryLabel">
    # Muitas vezes o link a vai englobar ou estar perto. 
    # De forma genérica na lista, podemos buscar os links que tem /artista/ no href
    # ou buscar de acordo com a class
    artist_links = soup.select('a[href^="/"]')
    
    added = 0
    for a in artist_links:
        href = a.get('href')
        # Filtra para tentar pegar os links raiz de artistas que não sejam páginas fixas
        if href and href.count('/') == 2 and href not in ['/entrar/', '/cadastrar/', '/letra/']:
            name_el = a.select_one('.primaryLabel')
            name = name_el.text.strip() if name_el else href.strip('/').replace('-', ' ').title()
            
            try:
                c.execute("INSERT OR IGNORE INTO artists (url, name) VALUES (?, ?)", (href, name))
                if c.rowcount > 0: added += 1
            except sqlite3.Error as e:
                logger.error(f"Erro no BD ao inserir artista {href}: {e}")
                
    c.execute("UPDATE letters SET status = 'done' WHERE letter = ?", (letter,))
    conn.commit()
    conn.close()
    logger.info(f"Letra {letter} finalizada. Artistas adicionados: {added}")

def process_artist(artist_url: str):
    """Passo 2: Extrai todas as músicas de um artista."""
    logger.info(f"Processando artista: {artist_url}")
    # Usando a flag para listar tudo de uma vez
    url = f"{BASE_URL}{artist_url}musicas.html?order=alphabetical"
    soup = make_request(url)
    if not soup: return

    conn = get_db_connection()
    c = conn.cursor()
    
    # Encontrar links das músicas (data-is-alphabetically)
    # Procurar por links dentro da lista de músicas
    song_links = soup.select('ul.list-links li a.art_music-link, ul#js-a-songs li a')
    if not song_links:
        # Tenta fallback para busca genérica de links contendo o url do artista + algo
        song_links = soup.select(f'a[href^="{artist_url}"]')
    
    added = 0
    for a in song_links:
        href = a.get('href')
        if href and href != artist_url and href.count('/') == 3:
            title = a.text.strip()
            try:
                c.execute("INSERT OR IGNORE INTO songs (url, artist_url, title) VALUES (?, ?, ?)", (href, artist_url, title))
                if c.rowcount > 0: added += 1
            except sqlite3.Error:
                pass
                
    c.execute("UPDATE artists SET status = 'done' WHERE url = ?", (artist_url,))
    conn.commit()
    conn.close()
    logger.info(f"Artista {artist_url} finalizado. Músicas adicionadas: {added}")

def process_song(song_url: str):
    """Passo 3: Extrai a cifra da música."""
    logger.info(f"Extraindo cifra: {song_url}")
    url = f"{BASE_URL}{song_url}"
    soup = make_request(url)
    
    conn = get_db_connection()
    c = conn.cursor()

    if not soup:
        c.execute("UPDATE songs SET status = 'error' WHERE url = ?", (song_url,))
        conn.commit()
        conn.close()
        return

    # Buscar a tag pre
    pre_tag = soup.find('pre')
    
    if pre_tag:
        # Limpar os anúncios que o site as vezes injeta dentro do <pre>
        for ad in pre_tag.select('.pub, [id*="pub"], [class*="ad--"]'):
            ad.decompose()
            
        # Salva o HTML interno exato do <pre>
        content_html = str(pre_tag)
        c.execute("UPDATE songs SET content_html = ?, status = 'done' WHERE url = ?", (content_html, song_url))
        logger.info(f"Sucesso ao extrair cifra: {song_url}")
    else:
        # Caso não seja cifra (seja tablatura sem pre, ou algo diferente)
        c.execute("UPDATE songs SET status = 'error' WHERE url = ?", (song_url,))
        logger.warning(f"Cifra não encontrada em (sem tag <pre>): {song_url}")
        
    conn.commit()
    conn.close()

def orchestrator():
    """Orquestra o fluxo de trabalho pegando tarefas pendentes do SQLite."""
    setup_database()
    logger.info("Iniciando orquestrador do scraper...")
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        while True:
            conn = get_db_connection()
            c = conn.cursor()
            
            # Prioridade 1: Extrair cifras de músicas pendentes
            c.execute("SELECT url FROM songs WHERE status = 'pending' LIMIT ?", (MAX_WORKERS * 2,))
            pending_songs = c.fetchall()
            if pending_songs:
                futures = [executor.submit(process_song, row['url']) for row in pending_songs]
                concurrent.futures.wait(futures)
                conn.close()
                continue
                
            # Prioridade 2: Extrair lista de músicas de artistas pendentes
            c.execute("SELECT url FROM artists WHERE status = 'pending' LIMIT ?", (MAX_WORKERS * 2,))
            pending_artists = c.fetchall()
            if pending_artists:
                futures = [executor.submit(process_artist, row['url']) for row in pending_artists]
                concurrent.futures.wait(futures)
                conn.close()
                continue
                
            # Prioridade 3: Extrair artistas das letras pendentes
            c.execute("SELECT letter FROM letters WHERE status = 'pending' LIMIT 1")
            pending_letter = c.fetchone()
            if pending_letter:
                executor.submit(process_letter, pending_letter['letter']).result() # Aqui rodamos sincrono para gerar lote inicial rápido
                conn.close()
                continue
                
            # Se não há mais nada pendente, terminamos
            c.execute("SELECT COUNT(*) as err_count FROM songs WHERE status = 'error'")
            errors = c.fetchone()['err_count']
            logger.info(f"Scraping concluído! Todas as tarefas processadas. ({errors} músicas com erro/sem <pre>)")
            conn.close()
            break

if __name__ == "__main__":
    try:
        orchestrator()
    except KeyboardInterrupt:
        logger.info("Scraper interrompido pelo usuário.")
