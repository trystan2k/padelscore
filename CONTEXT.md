# Project Context - Zepp OS v1.0

> ⚠️ **MANDATORY** - Do not deviate from this document.

## API Version

- **Target**: Zepp OS v1.0 (API_LEVEL 1.0)
- **Reference**: https://docs.zepp.com/docs/1.0/intro/
- **DO NOT** use features from v2.0, v3.0, v4.0, or later versions

---

## Page Lifecycle (v1.0 Only)

These are the **only** valid page lifecycle methods in v1.0:

```js
Page({
  onInit(params) {
    // Initialize page - called when page loads
  },
  
  build() {
    // Draw UI - called to render the page
  },
  
  onDestroy() {
    // Cleanup - called when page is destroyed
  }
})
```

### ❌ NOT Available in v1.0

The following methods **DO NOT EXIST** in v1.0 and will cause runtime errors:

| Method | Status | Notes |
|--------|--------|-------|
| `onShow` | ❌ Not available | Exists in v2.0+ |
| `onHide` | ❌ Not available | Exists in v2.0+ |
| `onResume` | ❌ Not available | Exists in v3.0+ |
| `onPause` | ❌ Not available | Exists in v3.0+ |

---

## Valid APIs for v1.0

### File System
- `hmFS.open(path, flags)` - Open file in `/data` directory
- `hmFS.read(fd, buffer, pos, len)` - Read file
- `hmFS.write(fd, buffer, pos, len)` - Write file
- `hmFS.close(fd)` - Close file
- `hmFS.stat(path)` - Get file info
- `hmFS.remove(path)` - Delete file

### UI
- `hmUI.createWidget(type, props)` - Create UI widgets
- Widget types: `TEXT`, `BUTTON`, `FILL_RECT`, `SCROLL_LIST`, `IMG`, etc.

### Navigation
- `hmApp.gotoPage({ url: 'page/name' })` - Navigate to page
- `hmApp.reloadPage()` - Reload current page

### Device Info
- `hmSetting.getDeviceInfo()` - Get screen dimensions

---

## Common Mistakes to Avoid

1. **Using `onShow` for data loading** → Use `onInit` instead
2. **Using newer API methods** → Check docs for v1.0 compatibility
3. **Assuming async file I/O** → Zepp OS v1.0 uses synchronous `hmFS` APIs

---

## Quick Reference Links

- [Life Cycle](https://docs.zepp.com/docs/1.0/guides/framework/device/life-cycle/)
- [Registration Page](https://docs.zepp.com/docs/1.0/guides/framework/device/page/)
- [hmFS API](https://docs.zepp.com/docs/1.0/reference/device-app-api/hmFS/open/)
- [UI Widgets](https://docs.zepp.com/docs/1.0/reference/device-app-api/hmUI/)

---

## Enforcement

Before implementing any page logic:
1. Verify all lifecycle methods are in the v1.0 list above
2. Check API references use `/docs/1.0/` paths
3. Run tests and verify on real device before assuming it works

---

## Version Management

This project maintains version consistency across three files:
- `package.json` - npm package version
- `app.json` - Zepp OS app version
- `utils/version.js` - Runtime version constant

Current version is tracked in `package.json`, `app.json`, and `utils/version.js`.

Version updates are handled automatically by the release workflow. 
See [RELEASE.md](RELEASE.md) for details.

---

## Related Documentation

- [RELEASE.md](RELEASE.md) - Release process and version management
- [CHANGELOG.md](CHANGELOG.md) - Version history
- [PRD Files](docs/) - Product requirements documents:
  - [Main PRD](docs/PRD.md) - Core product requirements
  - [QA Remediation PRD v1.1](docs/PRD-QA-Remediation-v1.1.md) - Quality assurance improvements
  - [Refactor Layout PRD](docs/PRD-Refactor-Layout.md) - UI layout refactoring requirements
  - [Finish Match PRD](docs/PRD-Finish-Match.md) - Match completion flow requirements
  - [Review PRD](docs/PRD-Review.md) - Code review and quality requirements
- [Zepp OS v1.0 Documentation](https://docs.zepp.com/docs/1.0/intro/) - Official API reference
