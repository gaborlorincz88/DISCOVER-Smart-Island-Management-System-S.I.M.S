import requests
import json
import os
import time
import sys

def reverse_geocode(lat, lon):
    """Gets the nearest address or place name from coordinates."""
    url = "https://nominatim.openstreetmap.org/reverse"
    params = {
        "lat": lat,
        "lon": lon,
        "format": "json",
        "addressdetails": 1,
        "extratags": 1, # Include extra tags which might have amenity names
        "namedetails": 1 # Include alternative names
    }
    headers = {"User-Agent": "DiscoverGozoApp/1.0 (https://discovergozo.app)"}
    
    try:
        response = requests.get(url, params=params, headers=headers, timeout=10)
        response.raise_for_status()  # Raise an exception for bad status codes
        data = response.json()
        
        # --- Find the most relevant name ---
        # Prioritize specific features like bus stops, amenities, or roads.
        if data.get("extratags", {}).get("amenity") == "bus_stop" and data.get("name"):
             return data["name"]
        if data.get("address", {}).get("bus_stop"):
            return data["address"]["bus_stop"]
        if data.get("address", {}).get("amenity"):
            return data["address"]["amenity"]
        if data.get("address", {}).get("road"):
            return f"Stop on {data['address']['road']}"
        if data.get("display_name"):
            # As a fallback, use the first part of the display name
            return data["display_name"].split(',')[0]
            
        return "Unknown Bus Stop"

    except requests.exceptions.RequestException as e:
        log(f"Error fetching data for ({lat}, {lon}): {e}")
        return None
    except (KeyError, IndexError) as e:
        log(f"Error parsing data for ({lat}, {lon}): {e}")
        return "Unnamed Stop"


def process_route_file(filename):
    """
    Processes a single bus route JSON file to add descriptions to stops.
    """
    filepath = os.path.join(os.path.dirname(__file__), filename)
    
    if not os.path.exists(filepath):
        log(f"Skipping {filename}: File not found.")
        return

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            route_data = json.loads(content)
            
            if not isinstance(route_data, dict) or "points" not in route_data:
                log(f"Skipping {filename}: Invalid format.")
                return

            updated = False
            for point in route_data.get("points", []):
                # Process only stops
                if point and point.get("type") == "stop":
                    log(f"Processing stop in {filename} at ({point['lat']}, {point['lng']})...")
                    
                    # Fetch the description from Nominatim
                    description = reverse_geocode(point['lat'], point['lng'])
                    
                    if description:
                        point['description'] = description
                        log(f"  -> Found description: {description}")
                        updated = True
                    else:
                        point['description'] = f"A bus stop on the Gozo public transport network"
                        log("  -> Could not find a specific description.")
                    
                    # Respect API rate limits
                    time.sleep(1.5) # Nominatim's usage policy requires a max of 1 req/sec

            # If any changes were made, write them back to the file
            if updated:
                new_content = json.dumps(route_data, indent=2, ensure_ascii=False)
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                log(f"Successfully updated {filename}")
            else:
                log(f"No changes needed for {filename}.")

    except FileNotFoundError:
        log(f"Error: {filename} not found.")
    except json.JSONDecodeError:
        log(f"Error: Could not decode JSON from {filename}.")
    except Exception as e:
        log(f"An unexpected error occurred with {filename}: {e}")

def log(message):
    """Appends a message to a log file."""
    print(message)
    try:
        with open("fix_bus_routes.log", "a", encoding="utf-8") as log_file:
            log_file.write(f"{message}\n")
    except Exception as e:
        with open("fix_bus_routes.log", "a", encoding="utf-8") as log_file:
            log_file.write(f"Error writing to log: {e}\n")

if __name__ == "__main__":
    # Clear the log file at the beginning of the run
    if os.path.exists("fix_bus_routes.log"):
        os.remove("fix_bus_routes.log")

    # Get the directory where the script is located
    script_dir = os.path.dirname(__file__)
    
    # List all JSON files in that directory
    files_to_process = [f for f in os.listdir(script_dir) if f.endswith('.json') and f not in ['301.json', '302.json']]
    
    for filename in files_to_process:
        process_route_file(filename)

    log("\nProcessing complete.")