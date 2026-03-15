import os
import yaml
import requests

# The Repositories to scan for "Intelligence"
PICTURE_REPOS = [
    "KJumpmaster/Aircraft-Pics",
    "KJumpmaster/Real_Life_Aircraft_Pics"
]

DATA_FILE = '_data/aircraft_list.yml'
# This grabs the token you found in your secrets
GITHUB_TOKEN = os.getenv('GH_TOKEN')

def get_repo_files(repo_full_name):
    """Fetches the file list from a GitHub repository via API."""
    url = f"https://api.github.com/repos/{repo_full_name}/contents/"
    headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json"
    }
    
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        return response.json()
    else:
        print(f"Failed to scan {repo_full_name}: {response.status_code}")
        return []

def update_inventory():
    aircraft_list = []
    seen_names = set()

    for repo in PICTURE_REPOS:
        print(f"Scanning {repo}...")
        files = get_repo_files(repo)
        
        for file in files:
            # We only want the files, not folders
            if file['type'] == 'file':
                filename = file['name']
                if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
                    # Clean up the filename: remove extension, dots, and underscores
                    clean_name = os.path.splitext(filename)[0].replace('_', ' ').replace('..', '.').upper()
                    
                    if clean_name not in seen_names:
                        aircraft_list.append({
                            'name': clean_name,
                            'rank': 'RECON',
                            'br': 'PENDING',
                            'source': repo.split('/')[-1]
                        })
                        seen_names.add(clean_name)

    # Ensure the _data directory exists
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    
    # Save the consolidated list
    with open(DATA_FILE, 'w') as f:
        yaml.dump(aircraft_list, f, default_flow_style=False)
    
    print(f"Success: Synced {len(aircraft_list)} aircraft from remote feeds.")

if __name__ == "__main__":
    update_inventory()
