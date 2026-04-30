
import requests
from supabase import create_client

# Supabase credentials
SUPABASE_URL = "https://your_supabase_url"
SUPABASE_KEY = "your_supabase_key"

# Creating the Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Your API key for Football-Data.org
API_KEY = 'your_football_api_key'

# The API URL to fetch matches
url = "https://api.football-data.org/v4/matches"

# Headers for authentication
headers = {
    "X-Auth-Token": API_KEY
}

# Function to fetch matches from the Football-Data.org API
def fetch_matches():
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        matches = response.json()
        upcoming_matches = [
            {
                "match_id": match["id"],
                "home_team": match["homeTeam"]["name"],
                "away_team": match["awayTeam"]["name"],
                "match_time": match["utcDate"],
                "ai_score": 85.5  # Sample AI prediction score
            }
            for match in matches['matches'] if match['status'] in ['LIVE', 'SCHEDULED']
        ]
        return upcoming_matches
    else:
        print("Error fetching matches:", response.status_code)
        return []

# Function to insert matches into Supabase
def insert_matches(matches):
    for match in matches:
        # Insert match data into Supabase
        supabase.table('matches').insert(match).execute()

# Fetch matches and insert them into Supabase
matches = fetch_matches()
if matches:
    insert_matches(matches)
    print(f"Inserted {len(matches)} matches into Supabase.")
else:
    print("No matches to insert.")
