import os
import re
import json
import pdfplumber

def parse_timetable(text):
    """
    Parses the text extracted from a single page of a timetable PDF.
    Returns a dictionary with stop names as keys and a list of times as values.
    """
    lines = text.split('\n')
    timetable = {}
    current_stop = None

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Regex to find times (e.g., 05:29, 12:33)
        time_pattern = re.compile(r'\b\d{2}:\d{2}\b')
        times = time_pattern.findall(line)

        # Regex to identify potential stop names (words that are not times)
        # This assumes stop names are at the beginning of the line.
        stop_name_match = re.match(r'([A-Za-z\s\d\-\']+?)\s+(?=\d{2}:\d{2})', line)

        if stop_name_match and times:
            # This is likely a new stop line
            current_stop = stop_name_match.group(1).strip()
            if current_stop not in timetable:
                timetable[current_stop] = []
            timetable[current_stop].extend(times)
        elif times and current_stop:
            # This is a continuation of times for the previous stop
            timetable[current_stop].extend(times)
        # Ignore lines without times, as they are likely headers or footers

    return timetable

def convert_pdfs_to_json(pdf_dir, json_dir):
    """
    Converts all PDF timetables in a directory to JSON format.
    """
    if not os.path.exists(json_dir):
        print(f"Creating directory: {json_dir}")
        os.makedirs(json_dir)

    for filename in os.listdir(pdf_dir):
        if filename.lower().endswith('.pdf'):
            pdf_path = os.path.join(pdf_dir, filename)
            print(f"Processing {filename}...")

            full_timetable = {}
            try:
                with pdfplumber.open(pdf_path) as pdf:
                    for page in pdf.pages:
                        text = page.extract_text()
                        if text:
                            page_timetable = parse_timetable(text)
                            for stop, times in page_timetable.items():
                                if stop in full_timetable:
                                    full_timetable[stop].extend(times)
                                else:
                                    full_timetable[stop] = times
            except Exception as e:
                print(f"  -> Error reading PDF {filename}: {e}")
                continue

            if not full_timetable:
                print(f"  -> No data extracted from {filename}. Skipping.")
                continue

            # Clean up and sort times
            for stop in full_timetable:
                # Remove duplicates and sort
                full_timetable[stop] = sorted(list(set(full_timetable[stop])))

            # Generate a clean JSON filename
            json_filename = os.path.splitext(filename)[0]
            json_filename = json_filename.replace("Timetable for Route ", "route_")
            json_filename = json_filename.replace(" ", "_") + '.json'
            json_path = os.path.join(json_dir, json_filename)

            try:
                with open(json_path, 'w', encoding='utf-8') as f:
                    json.dump(full_timetable, f, indent=2, ensure_ascii=False)
                print(f"  -> Successfully created {json_filename}")
            except Exception as e:
                print(f"  -> Error writing JSON for {filename}: {e}")


if __name__ == '__main__':
    # Assuming the script is in 'backend/bus-routes'
    script_dir = os.path.dirname(os.path.abspath(__file__))
    pdf_directory = os.path.join(script_dir, 'timetables')
    json_directory = os.path.join(script_dir, 'timetables-json')
    
    print("Starting PDF to JSON conversion...")
    convert_pdfs_to_json(pdf_directory, json_directory)
    print("\nConversion complete.")