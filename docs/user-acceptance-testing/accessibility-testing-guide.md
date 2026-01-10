# Accessibility Testing Guide

**Feature: mobile-first-ui-enhancements, Task 15.3: User acceptance testing preparation**

This guide provides comprehensive instructions for testing accessibility compliance with assistive technologies.

## Overview

This document outlines the procedures for testing the mobile-first UI enhancements with various assistive technologies to ensure WCAG AA compliance and inclusive design.

## Assistive Technologies

### Screen Readers

#### iOS - VoiceOver
- **Activation**: Settings > Accessibility > VoiceOver > On
- **Gestures**:
  - Single tap: Select item
  - Double tap: Activate item
  - Swipe right: Next item
  - Swipe left: Previous item
  - Two-finger swipe up: Read all from current position
  - Three-finger swipe left/right: Navigate by page

#### Android - TalkBack
- **Activation**: Settings > Accessibility > TalkBack > On
- **Gestures**:
  - Single tap: Select item
  - Double tap: Activate item
  - Swipe right: Next item
  - Swipe left: Previous item
  - Swipe down then right: Read from top
  - Two-finger swipe up/down: Scroll

#### Desktop - NVDA (Windows)
- **Download**: https://www.nvaccess.org/download/
- **Key Commands**:
  - Tab: Next focusable element
  - Shift+Tab: Previous focusable element
  - Enter/Space: Activate element
  - Arrow keys: Navigate content
  - H: Next heading
  - Shift+H: Previous heading

#### Desktop - JAWS (Windows)
- **Key Commands**:
  - Tab: Next focusable element
  - Shift+Tab: Previous focusable element
  - Enter/Space: Activate element
  - Arrow keys: Navigate content
  - H: Next heading
  - Shift+H: Previous heading

#### macOS - VoiceOver
- **Activation**: System Preferences > Accessibility > VoiceOver > Enable
- **Key Commands**:
  - VO+Arrow keys: Navigate
  - VO+Space: Activate
  - VO+A: Read all
  - VO+H: Next heading
  - VO+Shift+H: Previous heading

### Switch Control

#### iOS Switch Control
- **Activation**: Settings > Accessibility > Switch Control > On
- **Setup**: Configure external switch or use screen switches
- **Navigation**: Automatic scanning or manual selection

#### Android Switch Access
- **Activation**: Settings > Accessibility > Switch Access > On
- **Setup**: Configure external switches
- **Navigation**: Point scanning or linear scanning

### Voice Control

#### iOS Voice Control
- **Activation**: Settings > Accessibility > Voice Control > On
- **Commands**:
  - "Tap [element name]"
  - "Show numbers" (displays clickable numbers)
  - "Show grid" (displays coordinate grid)

#### Android Voice Access
- **Activation**: Download from Play Store, enable in Accessibility settings
- **Commands**:
  - "Open [app name]"
  - "Tap [element]"
  - "Show numbers"

## Testing Procedures

### Pre-Testing Setup

1. **Device Configuration**
   - Enable assistive technology
   - Adjust speech rate to comfortable level
   - Configure gesture sensitivity
   - Set up external switches if needed

2. **Browser Settings**
   - Disable auto-play media
   - Enable high contrast if available
   - Set appropriate zoom level
   - Clear cache and cookies

3. **Environment Setup**
   - Quiet testing environment
   - Good lighting conditions
   - Stable internet connection
   - Backup testing method available

### Screen Reader Testing Protocol

#### Test 1: Page Structure and Navigation

**Objective**: Verify proper heading structure and landmark navigation.

**Steps**:
1. Navigate to application homepage
2. Use heading navigation (H key or swipe gestures)
3. Verify logical heading hierarchy (H1 → H2 → H3)
4. Test landmark navigation (main, nav, aside, footer)
5. Check skip links functionality

**Expected Results**:
- [ ] Headings follow logical hierarchy
- [ ] All major page sections have landmarks
- [ ] Skip links are announced and functional
- [ ] Page title is descriptive and unique

**Common Issues**:
- Missing or incorrect heading levels
- Unlabeled page regions
- Non-functional skip links
- Generic page titles

#### Test 2: Form Accessibility

**Objective**: Ensure all form elements are properly labeled and accessible.

**Steps**:
1. Navigate to forms (login, project creation, etc.)
2. Tab through all form controls
3. Verify each input has associated label
4. Test error message announcements
5. Check required field indicators
6. Test form submission feedback

**Expected Results**:
- [ ] All inputs have descriptive labels
- [ ] Required fields are clearly indicated
- [ ] Error messages are announced immediately
- [ ] Success messages are communicated
- [ ] Form instructions are available

**Common Issues**:
- Unlabeled form controls
- Missing required field indicators
- Error messages not associated with inputs
- Placeholder text used as labels

#### Test 3: Interactive Elements

**Objective**: Verify all interactive elements are accessible and properly labeled.

**Steps**:
1. Navigate through all buttons and links
2. Test custom controls (sliders, toggles, etc.)
3. Verify button purposes are clear
4. Test modal dialog accessibility
5. Check tooltip and help text availability

**Expected Results**:
- [ ] All buttons have descriptive labels
- [ ] Link purposes are clear from context
- [ ] Custom controls have proper roles
- [ ] Modal dialogs trap focus appropriately
- [ ] Help text is available when needed

**Common Issues**:
- Generic button labels ("Click here", "Submit")
- Unlabeled icon buttons
- Custom controls without proper ARIA
- Modal dialogs that don't manage focus

#### Test 4: Dynamic Content

**Objective**: Ensure dynamic content updates are announced to screen readers.

**Steps**:
1. Trigger AI recommendations
2. Test real-time data updates
3. Verify loading state announcements
4. Test error state communications
5. Check progress indicator accessibility

**Expected Results**:
- [ ] Loading states are announced
- [ ] Content updates are communicated
- [ ] Error states are clearly announced
- [ ] Progress is communicated appropriately
- [ ] Live regions work correctly

**Common Issues**:
- Silent content updates
- Missing loading announcements
- Unclear error messages
- Progress not communicated

### Keyboard Navigation Testing

#### Test 1: Focus Management

**Objective**: Verify proper focus management throughout the application.

**Steps**:
1. Navigate using only Tab and Shift+Tab
2. Verify focus indicators are visible
3. Test focus trap in modal dialogs
4. Check focus restoration after interactions
5. Test skip links functionality

**Expected Results**:
- [ ] All interactive elements are focusable
- [ ] Focus indicators are clearly visible
- [ ] Tab order is logical and intuitive
- [ ] Focus is trapped in modal dialogs
- [ ] Focus is restored appropriately

**Focus Indicator Checklist**:
- [ ] Minimum 2px outline or border
- [ ] High contrast against background
- [ ] Visible on all interactive elements
- [ ] Not removed by CSS

#### Test 2: Keyboard Shortcuts

**Objective**: Test keyboard shortcuts and alternative navigation methods.

**Steps**:
1. Test application-specific shortcuts
2. Verify standard browser shortcuts work
3. Test escape key functionality
4. Check arrow key navigation where appropriate
5. Test Enter and Space key activation

**Expected Results**:
- [ ] Keyboard shortcuts are documented
- [ ] Standard shortcuts are not overridden
- [ ] Escape key closes dialogs/menus
- [ ] Arrow keys work for navigation
- [ ] Enter/Space activate elements appropriately

### High Contrast Testing

#### Test 1: Visual Accessibility

**Objective**: Verify application works in high contrast mode.

**Steps**:
1. Enable system high contrast mode
2. Navigate through all pages
3. Verify all content is visible
4. Test color-dependent information
5. Check focus indicators in high contrast

**Expected Results**:
- [ ] All text is readable in high contrast
- [ ] Icons and graphics are visible
- [ ] Color is not the only way to convey information
- [ ] Focus indicators work in high contrast
- [ ] Interactive elements are distinguishable

**Color Contrast Requirements**:
- Normal text: 4.5:1 minimum ratio
- Large text (18pt+): 3:1 minimum ratio
- Non-text elements: 3:1 minimum ratio
- Focus indicators: 3:1 minimum ratio

### Touch and Gesture Testing

#### Test 1: Touch Target Accessibility

**Objective**: Verify touch targets meet accessibility standards.

**Steps**:
1. Measure all interactive elements
2. Test with different finger sizes
3. Verify adequate spacing between targets
4. Test gesture alternatives
5. Check touch feedback

**Expected Results**:
- [ ] All touch targets are minimum 44px × 44px
- [ ] Adequate spacing between targets (8px minimum)
- [ ] Visual feedback on touch
- [ ] Gesture alternatives available
- [ ] No accidental activations

#### Test 2: Gesture Accessibility

**Objective**: Ensure complex gestures have alternatives.

**Steps**:
1. Test all swipe gestures
2. Verify pinch-zoom alternatives
3. Test long-press alternatives
4. Check multi-finger gesture alternatives
5. Test gesture customization options

**Expected Results**:
- [ ] All gestures have button alternatives
- [ ] Complex gestures can be disabled
- [ ] Gesture help is available
- [ ] Accidental gestures are prevented
- [ ] Gesture feedback is provided

## Automated Testing Tools

### axe-core Integration

```javascript
// Example automated accessibility test
import { injectAxe, checkA11y } from 'axe-playwright'

test('Accessibility compliance', async ({ page }) => {
  await page.goto('/')
  await injectAxe(page)
  
  await checkA11y(page, null, {
    rules: {
      'color-contrast': { enabled: true },
      'keyboard-navigation': { enabled: true },
      'focus-management': { enabled: true },
      'aria-labels': { enabled: true },
      'heading-structure': { enabled: true },
      'landmark-roles': { enabled: true }
    }
  })
})
```

### Lighthouse Accessibility Audit

```bash
# Run Lighthouse accessibility audit
lighthouse https://your-app.com --only-categories=accessibility --output=json --output-path=./accessibility-report.json
```

### Pa11y Command Line Tool

```bash
# Install Pa11y
npm install -g pa11y

# Run accessibility test
pa11y https://your-app.com --standard WCAG2AA --reporter cli
```

## Testing Checklist

### Screen Reader Compatibility

- [ ] All content is announced correctly
- [ ] Navigation is logical and efficient
- [ ] Form controls are properly labeled
- [ ] Dynamic content updates are announced
- [ ] Error messages are clear and helpful
- [ ] Instructions are available when needed

### Keyboard Navigation

- [ ] All functionality available via keyboard
- [ ] Focus indicators are clearly visible
- [ ] Tab order is logical
- [ ] Keyboard shortcuts work as expected
- [ ] Focus is managed properly in dynamic content

### Visual Accessibility

- [ ] Sufficient color contrast throughout
- [ ] Information not conveyed by color alone
- [ ] Text can be resized to 200% without loss of functionality
- [ ] High contrast mode is supported
- [ ] Focus indicators work in all visual modes

### Touch and Motor Accessibility

- [ ] Touch targets meet minimum size requirements
- [ ] Adequate spacing between interactive elements
- [ ] Complex gestures have alternatives
- [ ] Timeout options are available
- [ ] Motion can be disabled if needed

### Cognitive Accessibility

- [ ] Clear and consistent navigation
- [ ] Error messages are helpful and specific
- [ ] Instructions are provided when needed
- [ ] Complex processes are broken into steps
- [ ] Help and documentation are available

## Issue Reporting Template

### Accessibility Issue Report

**Issue ID**: [Unique identifier]
**Date**: [Date found]
**Tester**: [Name]
**Assistive Technology**: [Screen reader, keyboard, etc.]
**Device/Browser**: [Details]

**Issue Summary**: [Brief description]

**WCAG Guideline**: [Which guideline is violated]
**Severity**: Critical / High / Medium / Low

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Behavior**: [What should happen]
**Actual Behavior**: [What actually happens]

**Impact**: [How this affects users]

**Suggested Fix**: [Recommended solution]

**Screenshots/Videos**: [Attached files]

**Additional Notes**: [Any other relevant information]

## Success Criteria

### WCAG 2.1 AA Compliance

- [ ] **Perceivable**: Information and UI components must be presentable to users in ways they can perceive
- [ ] **Operable**: UI components and navigation must be operable
- [ ] **Understandable**: Information and the operation of UI must be understandable
- [ ] **Robust**: Content must be robust enough to be interpreted by a wide variety of user agents, including assistive technologies

### Assistive Technology Support

- [ ] Screen readers (VoiceOver, TalkBack, NVDA, JAWS)
- [ ] Voice control (iOS Voice Control, Android Voice Access)
- [ ] Switch control (iOS Switch Control, Android Switch Access)
- [ ] Keyboard-only navigation
- [ ] High contrast mode
- [ ] Zoom up to 200%

### Performance with Assistive Technology

- [ ] Screen reader navigation is efficient
- [ ] Voice commands are recognized accurately
- [ ] Switch control scanning is appropriately paced
- [ ] Keyboard navigation is smooth
- [ ] No significant performance degradation

## Training Resources

### For Testers

1. **WebAIM Screen Reader Testing**: https://webaim.org/articles/screenreader_testing/
2. **NVDA User Guide**: https://www.nvaccess.org/files/nvda/documentation/userGuide.html
3. **VoiceOver User Guide**: https://support.apple.com/guide/voiceover/
4. **WCAG 2.1 Guidelines**: https://www.w3.org/WAI/WCAG21/quickref/

### For Developers

1. **ARIA Authoring Practices**: https://www.w3.org/WAI/ARIA/apg/
2. **WebAIM Articles**: https://webaim.org/articles/
3. **A11y Project**: https://www.a11yproject.com/
4. **Inclusive Design Principles**: https://inclusivedesignprinciples.org/

## Conclusion

This accessibility testing guide ensures comprehensive evaluation of the mobile-first UI enhancements for users with disabilities. Regular testing with real assistive technologies and users is essential for maintaining accessibility compliance and providing an inclusive user experience.

Remember: Automated tools can catch about 30% of accessibility issues. Manual testing with assistive technologies and user feedback are crucial for comprehensive accessibility validation.