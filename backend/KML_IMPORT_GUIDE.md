# 📥 KML Import Feature - User Guide

## Overview

The Tour Route Editor now supports importing tour routes from Google My Maps KML files, making it fast and easy to create new tours without manual drawing.

---

## 🚀 Quick Start

### For Tour Organizers/Merchants:

1. **Create your tour in Google My Maps:**
   - Go to [Google My Maps](https://www.google.com/mymaps)
   - Click "Create a new map"
   - Draw your tour route
   - Add stops/waypoints
   - Add descriptions and photos

2. **Export as KML:**
   - Click the **⋮ menu** (three dots)
   - Select **"Export to KML/KMZ"**
   - **UNCHECK** "Export to KMZ" option
   - Click **Download**
   - You'll get a `.kml` file

3. **Send to Admin:**
   - Email the KML file to the admin
   - Include tour details (pricing, category, etc.)

### For Admins:

1. **Go to Tour Editor:**
   - Navigate to `http://localhost:3003/new-route-editor.html`
   - Login as admin

2. **Import KML:**
   - Find the **"Import from Google My Maps"** section
   - Click **"Choose File"**
   - Select the KML file
   - Click **"Import KML"**

3. **Review & Edit:**
   - Route appears on map automatically
   - Stops are numbered
   - Edit as needed (add/remove/move points)
   - Set tour icon, category, pricing

4. **Save:**
   - Click **"Save Route"**
   - Tour is created and ready!

---

## 📋 What Gets Imported

✅ **Tour Name** - From KML document name  
✅ **Description** - From KML document description  
✅ **Route Path** - All LineString coordinates  
✅ **Stops/Waypoints** - All Point placemarks  
✅ **Stop Names** - From placemark names  
✅ **Stop Descriptions** - From placemark descriptions  
✅ **Images** - Embedded images (proxied automatically)

---

## ⚙️ What You Set Manually

After import, admin sets:
- ❌ Tour Category (sightseeing, boat, jeep, etc.)
- ❌ Tour Icon
- ❌ Pricing (adult, child, senior)
- ❌ Duration
- ❌ Max participants
- ❌ Active/inactive status
- ❌ Important info

---

## 🎯 Benefits

| Manual Drawing | KML Import |
|---------------|------------|
| 20-30 minutes | 2-3 minutes |
| Tedious clicking | Automatic |
| Error-prone | GPS-accurate |
| Hard to update | Re-import file |

---

## 🔧 Technical Details

### Supported Files:
- ✅ `.kml` files (XML format)
- ❌ `.kmz` files (not yet supported - use KML instead)

### File Limits:
- Maximum size: **5MB**
- Validation: Coordinates must be within Gozo/Malta area
- Minimum: At least 1 route path (LineString)

### Parsing:
- Reuses the same parser as hiking trails
- Supports Google My Maps format
- Handles CDATA descriptions
- Proxies embedded images

---

## ⚠️ Common Issues

### Issue: "Only KML files allowed"
**Solution:** Export as KML, not KMZ. Uncheck "Export to KMZ" in Google My Maps.

### Issue: "No route coordinates found"
**Solution:** Ensure your Google My Maps has at least one **line/path** drawn, not just pins.

### Issue: "Coordinates outside Gozo/Malta"
**Solution:** Make sure your route is actually in Gozo or Malta (lat: 35.8-36.1, lng: 14.0-14.6).

### Issue: Import button stuck on "Importing..."
**Solution:** Refresh the page and try again. Check backend console for errors.

---

## 📝 Best Practices

1. **Use descriptive names** in Google My Maps - they import as tour/stop names
2. **Add descriptions** to stops - they'll be imported
3. **Keep routes simple** - Very complex routes may need editing
4. **Test in Google My Maps first** - Ensure route looks correct
5. **Review before publishing** - Always check imported data

---

## 🔐 Security

- ✅ Admin authentication required
- ✅ File size limits enforced
- ✅ File type validation (.kml only)
- ✅ Coordinate bounds checking
- ✅ All imports are logged
- ✅ Temporary files cleaned up

---

## 🎓 Example Workflow

**Merchant wants to add "Coastal Boat Tour":**

1. **Merchant:**
   - Creates route in Google My Maps
   - Adds 5 stops (Blue Lagoon, Crystal Lagoon, etc.)
   - Exports as KML
   - Emails to admin: "coastal-boat-tour.kml"

2. **Admin (You):**
   - Opens tour editor
   - Uploads `coastal-boat-tour.kml`
   - Clicks Import
   - Route + 5 stops appear on map ✨
   - Sets: Icon 🚤, Category "Boat Tour", Price €45
   - Clicks Save
   - **Total time: 2 minutes!**

3. **Result:**
   - Tour live in app
   - Customers can book
   - Map shows route and stops

---

## 📊 Import Log Example

When you import, the system logs:
```
Admin: admin@discovergozo.com
Action: KML_IMPORT_PARSE
Description: Parsed KML file: coastal-boat-tour.kml (247 coordinates, 5 stops)
```

All imports are tracked in admin activity logs.

---

## 🆘 Support

If you encounter issues:
1. Check the instructions in the tour editor (expandable section)
2. Verify KML file is from Google My Maps
3. Check backend console for detailed errors
4. Review admin activity logs

---

## 🔮 Future Enhancements

Potential future features:
- KMZ file support (zipped KML)
- URL import (paste Google My Maps link)
- Batch import (multiple files)
- Auto-categorization from keywords
- Update existing tours by re-importing

---

**Version:** 1.0.0  
**Last Updated:** October 18, 2025


