import requests, time, json

def geocode(name, city="Gozo, Malta"):
    url = "https://nominatim.openstreetmap.org/search"
    params = {"q": f"{name}, {city}", "format": "json", "limit": 1}
    r = requests.get(url, params=params, headers={"User-Agent": "DIYGIS/1.0"})
    return r.json()[0] if r.json() else None

stops = ["Victoria Bay 2", "Olivier", "Borg", "Ghonq", "Biccerija", "Xewkija", "Industrijali", "Universita", "Hniena", "Heliport", "Cilja", "Lelluxa", "Ghajnsielem", "Cordina", "Chambray", "Mgarr", "Vapur"]
output = {"id": "301", "name": "Route 301", "stops": []}

for stop in stops:
    geo = geocode(stop)
    if geo:
        output["stops"].append({"name": stop, "lat": float(geo["lat"]), "lng": float(geo["lon"])})
    else:
        print("Not found:", stop)
    time.sleep(1)

print(json.dumps(output, indent=2))
