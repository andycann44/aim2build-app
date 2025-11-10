# Testing Guide for LEGO Brick Scanner

## Manual Testing Checklist

### Setup & Prerequisites
- [ ] Modern web browser (Chrome 90+, Safari 14+, Firefox 88+)
- [ ] Device with camera (smartphone or computer with webcam)
- [ ] HTTPS connection or localhost (required for camera access)
- [ ] Well-lit environment for better scanning results

### Test Scenarios

#### 1. Initial Load
- [ ] Open `index.html` in a web browser
- [ ] Verify the page loads without errors
- [ ] Check browser console for any JavaScript errors
- [ ] Verify LEGO-themed UI is displayed correctly
- [ ] Confirm "LEGO Brick Scanner" header is visible

#### 2. Camera Access
- [ ] Click on the camera view (should be default view)
- [ ] Browser prompts for camera permission
- [ ] Grant camera access
- [ ] Verify video feed appears in the camera container
- [ ] Check that the scan frame overlay is visible
- [ ] Confirm "Position LEGO brick in frame" instruction shows

**Expected Result**: Live camera feed displays with yellow scan frame overlay

#### 3. AI Model Loading
- [ ] Monitor status messages during load
- [ ] Verify "Loading AI model..." appears
- [ ] Wait for "AI model loaded! Ready to scan LEGO bricks" message
- [ ] Check browser console for TensorFlow.js load messages

**Expected Result**: Model loads successfully within 5-10 seconds

#### 4. Brick Scanning
- [ ] Position a LEGO brick in the camera frame
- [ ] Click "📸 Capture & Scan" button
- [ ] Verify image is captured
- [ ] Wait for analysis to complete (2-5 seconds)
- [ ] Check that results view appears

**Expected Result**: App switches to results view showing captured image

#### 5. Results Display
- [ ] Verify captured image is displayed
- [ ] Check that analysis results show:
  - Part name
  - Part ID
  - Category (Basic Brick, Plate, Slope, etc.)
  - Dimensions
  - Common colors
  - Confidence percentage with bar
- [ ] Verify "Best Match" indicator on top result
- [ ] Check that multiple potential matches are shown

**Expected Result**: 1-5 potential LEGO parts displayed with confidence scores

#### 6. Adding to Inventory
- [ ] Click "✅ Add to Inventory" button
- [ ] Verify success message appears
- [ ] Wait for automatic transition to inventory view
- [ ] Check that the part appears in inventory list

**Expected Result**: Part added with quantity of 1

#### 7. Inventory Management
- [ ] View inventory stats:
  - [ ] Total parts count is correct
  - [ ] Unique parts count is correct
- [ ] Verify inventory list shows:
  - [ ] Part name and details
  - [ ] Quantity badge
- [ ] Scan and add the same brick again
- [ ] Confirm quantity increments to 2

**Expected Result**: Inventory updates correctly with quantities

#### 8. Navigation
- [ ] From camera view, click "📦 View Inventory"
- [ ] Verify inventory view appears
- [ ] Click "📷 Back to Scanner"
- [ ] Confirm return to camera view
- [ ] From results view, click "🔄 Scan Again"
- [ ] Verify return to camera view

**Expected Result**: Smooth navigation between views

#### 9. Clear Inventory
- [ ] In inventory view, click "🗑️ Clear All"
- [ ] Verify confirmation dialog appears
- [ ] Cancel the dialog
- [ ] Confirm inventory is unchanged
- [ ] Click "🗑️ Clear All" again
- [ ] Accept the confirmation
- [ ] Verify inventory is emptied
- [ ] Check stats show 0 total and 0 unique parts

**Expected Result**: Inventory cleared with confirmation

#### 10. Persistence
- [ ] Add several parts to inventory
- [ ] Note the inventory contents
- [ ] Refresh the page
- [ ] Verify inventory persists after reload

**Expected Result**: Inventory data survives page refresh

#### 11. PWA Features
- [ ] Check for service worker registration in console
- [ ] Verify offline capability (if supported)
- [ ] Test "Add to Home Screen" functionality (mobile)

**Expected Result**: PWA installs and works offline

#### 12. Responsive Design
- [ ] Test on different screen sizes:
  - [ ] Mobile (320px width)
  - [ ] Tablet (768px width)
  - [ ] Desktop (1024px+ width)
- [ ] Verify layout adapts appropriately
- [ ] Check that all buttons are accessible

**Expected Result**: UI is usable on all screen sizes

### Browser Compatibility Testing

Test the app on multiple browsers:
- [ ] Chrome/Chromium
- [ ] Safari (iOS/macOS)
- [ ] Firefox
- [ ] Edge
- [ ] Mobile browsers

### Performance Testing
- [ ] Measure initial load time
- [ ] Check scan/analysis time (should be < 5 seconds)
- [ ] Verify smooth animations and transitions
- [ ] Monitor memory usage during extended use

### Error Handling
- [ ] Deny camera access - verify error message
- [ ] Try scanning in low light - check results quality
- [ ] Scan non-LEGO objects - verify graceful handling
- [ ] Test with network disconnected (after initial load)

## Known Limitations

1. **Recognition Accuracy**: The current implementation uses a general-purpose image classification model (MobileNet), not trained specifically for LEGO bricks. Results may vary.

2. **Lighting Dependency**: Good lighting is essential for accurate results.

3. **Database Size**: Limited to 13 common LEGO parts. Can be expanded.

4. **Camera Requirements**: Requires browser camera access permission and HTTPS (or localhost).

5. **Color Detection**: Current implementation doesn't detect brick colors accurately.

## Reporting Issues

When reporting issues, please include:
- Browser name and version
- Device type (mobile/desktop)
- Operating system
- Screenshot of the issue
- Browser console errors (if any)
- Steps to reproduce

## Test Results Template

```
Date: [YYYY-MM-DD]
Tester: [Name]
Browser: [Browser Name] [Version]
Device: [Device Type]
OS: [Operating System]

Test Results:
- Initial Load: [PASS/FAIL]
- Camera Access: [PASS/FAIL]
- AI Model Loading: [PASS/FAIL]
- Brick Scanning: [PASS/FAIL]
- Results Display: [PASS/FAIL]
- Add to Inventory: [PASS/FAIL]
- Inventory Management: [PASS/FAIL]
- Navigation: [PASS/FAIL]
- Clear Inventory: [PASS/FAIL]
- Persistence: [PASS/FAIL]
- PWA Features: [PASS/FAIL]
- Responsive Design: [PASS/FAIL]

Notes: [Any additional observations]
```
