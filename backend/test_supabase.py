from supabase import create_client, Client
from dotenv import load_dotenv
import os

load_dotenv()

# Service Role für full access test
supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

try:
    # Einfache Test-Query (z. B. Count von projects)
    response = supabase.table("projects").select("*", count="exact").limit(1).execute()
    print("Verbindung erfolgreich!")
    print("Anzahl Projekte:", response.count)
    print("Erstes Item (falls da):", response.data)
except Exception as e:
    print("Fehler:", str(e))