# Contributing to LEGO Brick Scanner

Thank you for your interest in contributing! This guide will help you add value to the project.

## Ways to Contribute

1. **Add LEGO Parts** - Expand the parts database
2. **Improve Recognition** - Enhance matching algorithms
3. **Fix Bugs** - Report and fix issues
4. **Add Features** - Implement new functionality
5. **Improve Documentation** - Make guides clearer
6. **Test & Report** - Test on different devices

## Adding LEGO Parts (Easiest Contribution)

### Step 1: Research the Part

Find information about the LEGO part:
- Part ID (e.g., "3001")
- Part Name (e.g., "2x4 Brick")
- Category (Basic Brick, Plate, Slope, etc.)
- Dimensions (e.g., "2x4 studs")
- Common colors
- Identifying keywords

Resources:
- [BrickLink](https://www.bricklink.com/)
- [Rebrickable](https://rebrickable.com/)
- [LEGO Pick a Brick](https://www.lego.com/pick-a-brick)

### Step 2: Add to Database

Edit `lego-parts-database.js` and add your part:

```javascript
// Add to LEGO_PARTS_DATABASE object
'brick_1x1': {
    id: '3005',                    // Official LEGO part ID
    name: '1x1 Brick',             // Descriptive name
    category: 'Basic Brick',       // Category
    dimensions: '1x1 studs',       // Size
    colors: ['Red', 'Blue', 'Yellow', 'Green', 'White', 'Black'],
    keywords: ['brick', 'small', 'tiny', 'single', 'cube']
}
```

### Step 3: Test the Addition

1. Save the file
2. Refresh the browser
3. Try scanning a matching brick
4. Verify it appears in results

### Example: Adding a Technic Pin

```javascript
'technic_pin': {
    id: '3673',
    name: 'Technic Pin',
    category: 'Technic',
    dimensions: 'Standard pin length',
    colors: ['Black', 'Gray', 'Blue', 'Red'],
    keywords: ['pin', 'technic', 'connector', 'axle', 'cylindrical', 'rod']
}
```

### Keywords Tips

Good keywords help matching:
- **Shape**: rectangular, square, round, cylindrical, curved
- **Size**: small, large, long, short, thin, wide
- **Type**: brick, plate, tile, slope, wedge
- **Features**: studded, smooth, angled, hinged
- **Use**: connector, wheel, door, window, panel

## Improving Recognition Algorithms

### Understanding the Current System

1. **Image Classification** (app.js)
   - Uses MobileNet to classify the captured image
   - Returns predictions with confidence scores

2. **Part Matching** (lego-parts-database.js)
   - `analyzeForLegoParts()` matches predictions to parts
   - `findMatchingParts()` searches database by keywords

### Enhancement Ideas

#### 1. Add Color Detection

```javascript
// Example: Extract dominant colors from image
function getDominantColor(imageData) {
    // Analyze pixel data
    // Return closest LEGO color
}
```

#### 2. Improve Keyword Matching

```javascript
// Example: Add fuzzy matching
function fuzzyMatch(keyword, partKeywords) {
    // Use Levenshtein distance
    // Allow partial matches
}
```

#### 3. Add Shape Recognition

```javascript
// Example: Detect rectangular vs square shapes
function analyzeShape(predictions) {
    // Look for shape indicators
    // Improve category detection
}
```

## Code Style Guidelines

### JavaScript

- Use ES6+ features (const, let, arrow functions)
- Use descriptive variable names
- Add comments for complex logic
- Follow existing code structure

```javascript
// Good
const capturedImage = canvas.toDataURL('image/jpeg');
const results = await analyzeImage(capturedImage);

// Avoid
var img = canvas.toDataURL();
var r = await analyze(img);
```

### CSS

- Use CSS variables for colors
- Mobile-first approach
- Follow existing naming conventions

```css
/* Good */
.inventory-item {
    background: var(--bg-color);
    padding: 16px;
}

/* Avoid */
.item {
    background: #f5f5f5;
    padding: 10px;
}
```

### HTML

- Use semantic HTML5 elements
- Include accessibility attributes
- Keep structure clean

## Testing Your Changes

### 1. Syntax Check
```bash
node --check app.js
node --check lego-parts-database.js
```

### 2. Manual Testing
- Test on mobile device
- Try various lighting conditions
- Verify all views work
- Check inventory persistence

### 3. Browser Testing
Test on:
- Chrome (desktop & mobile)
- Safari (iOS)
- Firefox
- Edge

## Submitting Changes

### 1. Fork the Repository
```bash
git clone https://github.com/andycann44/aim2build-app.git
cd aim2build-app
```

### 2. Create a Branch
```bash
git checkout -b add-new-lego-parts
```

### 3. Make Changes
- Edit files
- Test thoroughly
- Add documentation if needed

### 4. Commit Changes
```bash
git add lego-parts-database.js
git commit -m "Add 15 new Technic parts to database"
```

### 5. Push and Create PR
```bash
git push origin add-new-lego-parts
```
Then create a Pull Request on GitHub

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] New LEGO parts
- [ ] Documentation
- [ ] Performance improvement

## Changes Made
- Added 15 Technic parts
- Improved keyword matching
- Updated documentation

## Testing Done
- [x] Tested on Chrome mobile
- [x] Tested on Safari iOS
- [x] Verified parts are recognized
- [x] Checked no console errors

## Screenshots (if applicable)
[Add screenshots of new features]
```

## Feature Requests

Before implementing major features:

1. Open an issue to discuss
2. Get feedback from maintainers
3. Ensure it aligns with project goals
4. Consider backward compatibility

### Requested Features

- [ ] Export/import inventory as JSON
- [ ] Barcode scanning for set boxes
- [ ] Cloud sync across devices
- [ ] BrickLink price integration
- [ ] Custom categories/tags
- [ ] Search within inventory
- [ ] Statistics and analytics
- [ ] Multiple inventory collections

## Documentation Contributions

### README Improvements
- Clarify installation steps
- Add more examples
- Fix typos
- Add diagrams/screenshots

### Code Documentation
- Add JSDoc comments
- Explain complex algorithms
- Document function parameters
- Add usage examples

## Reporting Bugs

### Bug Report Template

```markdown
**Bug Description**
Clear description of the bug

**To Reproduce**
1. Go to camera view
2. Click capture button
3. Error appears

**Expected Behavior**
What should happen

**Actual Behavior**
What actually happens

**Environment**
- Browser: Chrome 120
- OS: iOS 17
- Device: iPhone 14

**Screenshots**
[Add screenshots if applicable]

**Console Errors**
[Paste any browser console errors]
```

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn
- Focus on the code, not the person

## Recognition

Contributors will be:
- Listed in contributors section
- Credited in release notes
- Mentioned in documentation

## Questions?

- Open an issue for questions
- Tag with "question" label
- Be specific and provide context

## License

By contributing, you agree that your contributions will be under the same license as the project.

## Getting Help

- Review existing issues
- Check documentation files
- Ask in discussions
- Tag maintainers if urgent

---

Thank you for contributing to LEGO Brick Scanner! 🧱

Every contribution, no matter how small, helps make this project better!
