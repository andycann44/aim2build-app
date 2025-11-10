# Quick Start Guide

Get the LEGO Brick Scanner running in 5 minutes!

## For Users (Non-Technical)

### Option 1: Use the Deployed App
1. Open the app URL in your mobile browser (will be provided after deployment)
2. Allow camera access when prompted
3. Wait for "Ready to scan" message
4. Point camera at a LEGO brick
5. Tap "Capture & Scan"
6. View results and add to inventory

### Option 2: Install as App
1. Open the app in your mobile browser
2. Tap the browser menu (⋮ or ⋯)
3. Select "Add to Home Screen" or "Install App"
4. Tap the new icon on your home screen to launch

## For Developers

### Prerequisites
- Modern web browser
- Python 3 (or Node.js with http-server)
- Git

### Setup in 3 Steps

**1. Clone the repository:**
```bash
git clone https://github.com/andycann44/aim2build-app.git
cd aim2build-app
```

**2. Start a local server:**

Using Python:
```bash
python3 -m http.server 8000
```

Using Node.js:
```bash
npx http-server -p 8000
```

Using PHP:
```bash
php -S localhost:8000
```

**3. Open in browser:**
```
http://localhost:8000
```

That's it! The app should now be running.

## Testing the Scanner

### With a Real LEGO Brick:
1. Grant camera permission
2. Position a LEGO brick in the yellow frame
3. Ensure good lighting
4. Click "Capture & Scan"
5. Wait for AI analysis (2-5 seconds)
6. Review the identified part
7. Add to inventory

### Without LEGO Bricks:
The scanner will still work with any object! It uses general image recognition, so it will attempt to match objects to LEGO parts based on shape and features.

## Common First-Time Issues

### Camera Not Working
- **Cause:** Browser needs HTTPS for camera access
- **Solution:** Use `localhost` (works without HTTPS) or deploy with HTTPS

### Model Taking Long to Load
- **Cause:** TensorFlow.js downloading from CDN (45MB)
- **Solution:** Wait 10-20 seconds on first load; it's faster after caching

### Recognition Not Accurate
- **Cause:** Using general AI model, not LEGO-specific
- **Solution:** This is expected! Good lighting and clear positioning help

## Project Structure

```
aim2build-app/
├── index.html              # Main app page
├── styles.css              # LEGO-themed styling
├── app.js                  # Main application logic
├── lego-parts-database.js  # LEGO parts catalog
├── service-worker.js       # PWA offline support
├── manifest.json           # PWA configuration
├── icon-192.svg            # App icon (small)
├── icon-512.svg            # App icon (large)
├── README.md               # Full documentation
├── TESTING.md              # Testing guide
├── DEPLOYMENT.md           # Deployment guide
└── QUICKSTART.md           # This file
```

## Key Files Explained

- **index.html**: The app interface with camera view, results, and inventory
- **app.js**: Handles camera, AI model, scanning, and inventory
- **lego-parts-database.js**: Contains LEGO parts info and matching logic
- **styles.css**: Mobile-first responsive design with LEGO colors

## Customization Quick Tips

### Add More LEGO Parts
Edit `lego-parts-database.js`:
```javascript
'brick_1x1': {
    id: '3005',
    name: '1x1 Brick',
    category: 'Basic Brick',
    dimensions: '1x1 studs',
    colors: ['Red', 'Blue', 'Yellow'],
    keywords: ['brick', 'small', 'single']
}
```

### Change Colors
Edit `styles.css` CSS variables:
```css
:root {
    --lego-blue: #0055BF;
    --lego-red: #D11013;
    --lego-yellow: #FFD700;
}
```

### Adjust Camera Frame
Edit `styles.css`:
```css
.scan-frame {
    width: 250px;  /* Make frame bigger */
    height: 250px;
}
```

## Development Tips

### Debug Mode
Open browser DevTools (F12) to see:
- Model loading status
- Image predictions
- Recognition matches
- Inventory changes

### Test Without Camera
You can test the inventory features without a camera by temporarily skipping camera initialization.

### Reload Changes
After editing code:
1. Save the file
2. Refresh the browser (Ctrl+R)
3. For service worker changes: Hard refresh (Ctrl+Shift+R)

## What to Test

- ✅ Camera access and video feed
- ✅ Capture button creates snapshot
- ✅ AI model analyzes image
- ✅ Results display with confidence scores
- ✅ Add to inventory button
- ✅ Inventory persists after refresh
- ✅ Clear inventory confirmation
- ✅ Navigation between views

## Next Steps

1. ✅ Get the app running locally
2. 📸 Test scanning some objects
3. 📦 Build an inventory
4. 🔧 Customize the parts database
5. 🚀 Deploy to production

## Need Help?

- **Check**: Browser console for errors (F12)
- **Read**: README.md for full documentation
- **Test**: TESTING.md for test scenarios
- **Deploy**: DEPLOYMENT.md for hosting options
- **Issues**: Open an issue on GitHub

## Browser Compatibility Quick Check

| Feature | Chrome | Safari | Firefox | Edge |
|---------|--------|--------|---------|------|
| Camera | ✅ | ✅ | ✅ | ✅ |
| PWA | ✅ | ✅ | ✅ | ✅ |
| AI Model | ✅ | ✅ | ✅ | ✅ |
| Storage | ✅ | ✅ | ✅ | ✅ |

All modern browsers (released in last 2 years) should work!

## Performance Notes

- **First load**: 10-20 seconds (downloading AI model)
- **Subsequent loads**: 2-3 seconds (model cached)
- **Scan time**: 2-5 seconds per brick
- **Storage**: ~50MB for AI model + small inventory data

## Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Camera black screen | Check browser permissions |
| "Loading model" stuck | Check internet connection |
| Can't add to inventory | Check browser localStorage is enabled |
| PWA won't install | Use HTTPS or localhost |
| Scans are inaccurate | Improve lighting and brick positioning |

---

Happy scanning! 🧱📸

**Time to first scan:** < 5 minutes  
**Total files:** 10 files  
**Total size:** < 50KB (plus 45MB cached AI model)  
**Dependencies:** None (all via CDN)
