import main
import sqlite3

# Setup DB
main.setup_database()

conn = sqlite3.connect('cifras_data.sqlite')
c = conn.cursor()
c.execute("INSERT OR IGNORE INTO songs (url, artist_url, title) VALUES ('/as-bahgualadas/amo-voce/', '/as-bahgualadas/', 'Amo Voce')")
conn.commit()
conn.close()

# Testa uma musica especifica
main.process_song('/as-bahgualadas/amo-voce/')

# Verifica resultado
conn = sqlite3.connect('cifras_data.sqlite')
c = conn.cursor()
c.execute("SELECT content_html FROM songs WHERE url='/as-bahgualadas/amo-voce/'")
res = c.fetchone()
conn.close()

print('\n--- RESULTADO DA EXTRAÇÃO ---\n')
if res and res[0]:
    print(res[0])
else:
    print('Nenhum resultado ou erro na extração!')
