import os
import requests
from dotenv import load_dotenv, set_key

# Load existing .env variables
dotenv_path = "./config/api.js"
load_dotenv(dotenv_path)

# Ngrok API endpoint to get tunnel details
NGROK_API_URL = "http://127.0.0.1:4040/api/tunnels"

try:
    response = requests.get(NGROK_API_URL)
    response.raise_for_status()  # Raise error for HTTP issues
    data = response.json()

    # Find the tunnel running on port 5000
    public_url = None
    for tunnel in data.get("tunnels", []):
        if "https" in tunnel["public_url"]:  # Prioritize HTTPS
            public_url = tunnel["public_url"]
            break

    if not public_url:
        raise ValueError("No active Ngrok tunnel found for port 5000.")

    # Update .env file with the new URL
    set_key(dotenv_path, "const API_URL", public_url)

    print(f"Updated .env with Ngrok URL: {public_url}")

except requests.RequestException as e:
    print(f"Error fetching Ngrok URL: {e}")
except ValueError as e:
    print(e)
