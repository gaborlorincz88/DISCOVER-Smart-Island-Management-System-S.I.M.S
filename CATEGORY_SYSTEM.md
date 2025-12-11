# Tour Category Management System

## Overview

The tour category management system allows administrators to create, edit, and manage tour categories with images, descriptions, and metadata. This system integrates with the existing tour route editor and frontend excursions page.

## Features

### Category Management
- **Create Categories**: Add new tour categories with custom names, descriptions, icons, and colors
- **Upload Images**: Each category can have a representative image
- **Edit Categories**: Modify existing categories including their images
- **Delete Categories**: Remove categories (only if they have no associated tours)
- **Active/Inactive Status**: Toggle category visibility
- **Display Order**: Control the order in which categories appear

### Integration
- **Route Editor**: Categories automatically populate the route type selector
- **Frontend Display**: Categories with images are displayed in the excursions page
- **API Endpoints**: Full REST API for category management

## File Structure

```
backend/
├── routes-data/
│   └── categories.json          # Category data storage
├── uploads/
│   └── categories/              # Category images storage
├── routes/
│   └── tours.js                 # Category API endpoints
└── public/
    ├── category-editor.html     # Category management UI
    └── category-editor.js       # Category editor functionality
```

## API Endpoints

### GET /api/tour-categories
Returns all active tour categories.

**Response:**
```json
[
  {
    "id": "sightseeing",
    "name": "Sightseeing Routes",
    "description": "Explore Gozo's most beautiful landmarks",
    "image": "/uploads/categories/sightseeing.jpg",
    "icon": "🏛️",
    "color": "#3b82f6",
    "active": true,
    "order": 1
  }
]
```

### POST /api/tour-categories
Creates a new tour category.

**Request:** Multipart form data
- `name` (required): Category name
- `description`: Category description
- `icon`: Emoji icon
- `color`: Hex color code
- `order`: Display order number
- `active`: Boolean status
- `image`: Image file (optional)

### PUT /api/tour-categories/:id
Updates an existing category.

**Request:** Multipart form data (same as POST)

### DELETE /api/tour-categories/:id
Deletes a category (only if no tours exist in that category).

## Usage

### Accessing the Category Editor
1. Navigate to the admin panel
2. Click "Category Editor" in the navigation menu
3. Or go directly to `/category-editor.html`

### Creating a New Category
1. Click "Add New Category"
2. Fill in the category details:
   - **Name**: Required, will generate a unique ID
   - **Description**: Optional description
   - **Icon**: Choose from emoji options
   - **Color**: Pick a color for the category
   - **Image**: Upload a representative image
   - **Order**: Set display order
   - **Active**: Toggle category visibility
3. Click "Save Category"

### Editing a Category
1. Click the "Edit" button on any category card
2. Modify the desired fields
3. Upload a new image if needed
4. Click "Save Category"

### Deleting a Category
1. Click the "Delete" button on a category card
2. Confirm the deletion
3. Note: Categories with existing tours cannot be deleted

## Frontend Integration

### Excursions Page
The frontend excursions page automatically displays categories with:
- Category images as backgrounds
- Icons and names
- Descriptions
- Hover effects and selection states

### Route Editor
The tour route editor automatically loads categories into the route type selector, allowing users to create tours within specific categories.

## Category Data Structure

```json
{
  "id": "unique-category-id",
  "name": "Category Display Name",
  "description": "Category description for frontend display",
  "image": "/uploads/categories/filename.jpg",
  "icon": "🏛️",
  "color": "#3b82f6",
  "active": true,
  "order": 1
}
```

## Image Requirements

- **Format**: JPG, PNG, GIF
- **Size**: Maximum 5MB
- **Dimensions**: Recommended 800x600 or larger
- **Storage**: Images are stored in `/backend/uploads/categories/`

## Security Notes

- Only image files are allowed for uploads
- File size is limited to 5MB
- Categories with existing tours cannot be deleted
- All API endpoints require proper authentication (implement as needed)

## Troubleshooting

### Common Issues

1. **Categories not loading**: Check if the categories.json file exists and is valid JSON
2. **Images not displaying**: Verify the uploads/categories directory exists and has proper permissions
3. **API errors**: Check server logs for detailed error messages
4. **Frontend not updating**: Clear browser cache and reload the page

### File Permissions
Ensure the following directories have write permissions:
- `/backend/uploads/categories/`
- `/backend/routes-data/`

## Future Enhancements

- Category-specific tour limits
- Category analytics and reporting
- Bulk category operations
- Category templates
- Advanced image optimization
- Category-specific pricing rules





