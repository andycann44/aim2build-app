# LEGO Brick Scanner - Aim2Build App

A Progressive Web App (PWA) that allows you to scan LEGO bricks using your phone camera, identify them using AI, and manage your LEGO inventory.

## Features

- 📸 **Camera-Based Scanning**: Use your phone camera to capture LEGO brick images
- 🤖 **AI-Powered Recognition**: Utilizes TensorFlow.js and MobileNet to identify LEGO parts
- 📦 **Inventory Management**: Track all your LEGO bricks in a persistent inventory
- 📱 **Mobile-First Design**: Optimized for smartphone use with a clean, intuitive interface
- 🔌 **Offline Capable**: Works offline after initial load thanks to PWA features
- 🎨 **LEGO-Themed UI**: Beautiful interface inspired by LEGO's iconic design

## How It Works

1. **Open the App**: Launch the app on your phone browser
2. **Grant Camera Access**: Allow the app to access your camera when prompted
3. **Position the Brick**: Place a LEGO brick in the camera frame
4. **Capture & Scan**: Tap the capture button to analyze the brick
5. **Review Results**: See identified parts with confidence scores
6. **Add to Inventory**: Add recognized bricks to your personal inventory
7. **Track Your Collection**: View your complete LEGO collection anytime

## Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **AI/ML**: TensorFlow.js with MobileNet model
- **Storage**: LocalStorage for inventory persistence
- **PWA**: Service Workers for offline functionality
- **Design**: Responsive, mobile-first CSS with LEGO color scheme

## Installation

### Option 1: Direct Use (GitHub Pages or Web Server)

1. Clone this repository:
   ```bash
   git clone https://github.com/andycann44/aim2build-app.git
   cd aim2build-app
   ```

2. Serve the files using any web server:
   ```bash
   # Using Python 3
   python -m http.server 8000
   
   # Using Node.js http-server
   npx http-server
   
   # Using PHP
   php -S localhost:8000
   ```

3. Open your browser and navigate to `http://localhost:8000`

### Option 2: Install as PWA on Mobile

1. Open the app in your mobile browser (Chrome, Safari, etc.)
2. Tap the browser menu
3. Select "Add to Home Screen" or "Install App"
4. The app will now be available as a standalone app on your phone

## Browser Requirements

- **Modern Browser**: Chrome 90+, Safari 14+, Firefox 88+, Edge 90+
- **Camera Access**: Device with camera and browser permission
- **JavaScript**: Must be enabled
- **LocalStorage**: For inventory persistence

## LEGO Parts Database

The app includes a database of common LEGO parts including:
- Basic bricks (2x4, 2x2, 1x4, 1x2)
- Plates (various sizes)
- Slopes (45° angles)
- Special parts (wheels, windows, doors)

The database can be expanded by editing `lego-parts-database.js`.

## How to Extend

### Adding More LEGO Parts

Edit `lego-parts-database.js` and add new parts to the `LEGO_PARTS_DATABASE` object:

```javascript
'brick_1x1': {
    id: '3005',
    name: '1x1 Brick',
    category: 'Basic Brick',
    dimensions: '1x1 studs',
    colors: ['Red', 'Blue', 'Yellow', 'Green'],
    keywords: ['brick', 'small', 'tiny', 'single']
}
```

### Improving Recognition

The current implementation uses MobileNet for general image classification. For better accuracy, you could:

1. Train a custom TensorFlow.js model specifically for LEGO bricks
2. Use a larger dataset of LEGO brick images
3. Implement color detection algorithms
4. Add shape recognition for specific brick types

## Privacy & Security

- All data is stored locally on your device
- No data is sent to external servers
- Camera access is only used for capturing images
- No personal information is collected

## Limitations

- Recognition accuracy depends on lighting and camera quality
- Limited to parts in the database
- Works best with clear, well-lit photos
- Requires internet connection for initial model download

## Future Enhancements

- [ ] Export/import inventory as JSON
- [ ] Share inventory with other users
- [ ] Integration with BrickLink API for pricing
- [ ] Custom trained model for better LEGO recognition
- [ ] Barcode scanning for LEGO set boxes
- [ ] Building instructions integration
- [ ] Multi-brick scanning (detect multiple bricks in one image)

## Contributing

Contributions are welcome! Feel free to:
- Add more LEGO parts to the database
- Improve the recognition algorithms
- Enhance the UI/UX
- Fix bugs or issues
- Add new features

## License

This project is open source and available for educational and personal use.

## Acknowledgments

- LEGO® is a trademark of the LEGO Group
- TensorFlow.js and MobileNet by Google
- This is a fan-made app not affiliated with the LEGO Group

## Support

For issues or questions, please open an issue on the GitHub repository.

---

Built with ❤️ for LEGO enthusiasts
