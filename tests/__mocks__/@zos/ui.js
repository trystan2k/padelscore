const widget = {
  TEXT: 'TEXT',
  BUTTON: 'BUTTON',
  IMG: 'IMG',
  IMG_LEVEL: 'IMG_LEVEL',
  FILL_RECT: 'FILL_RECT',
  STROKE_RECT: 'STROKE_RECT',
  ARC: 'ARC',
  CIRCLE: 'CIRCLE',
  SCROLL_LIST: 'SCROLL_LIST'
}

const align = {
  LEFT: 'left',
  RIGHT: 'right',
  CENTER_H: 'center',
  CENTER_V: 'center'
}

function createWidget(type, config) {
  if (typeof globalThis.hmUI?.createWidget === 'function') {
    return globalThis.hmUI.createWidget(type, config)
  }

  return { type, config }
}

function deleteWidget(widgetInstance) {
  if (typeof globalThis.hmUI?.deleteWidget === 'function') {
    return globalThis.hmUI.deleteWidget(widgetInstance)
  }

  return true
}

function getTextLayout(text, options = {}) {
  if (typeof globalThis.hmUI?.getTextLayout === 'function') {
    return globalThis.hmUI.getTextLayout(text, options)
  }

  return {
    width: String(text ?? '').length * 10,
    height: options.text_size ?? 24
  }
}

function showToast(payload) {
  if (typeof globalThis.hmUI?.showToast === 'function') {
    return globalThis.hmUI.showToast(payload)
  }

  return true
}

function hideToast() {
  if (typeof globalThis.hmUI?.hideToast === 'function') {
    return globalThis.hmUI.hideToast()
  }

  return true
}

export {
  align,
  createWidget,
  deleteWidget,
  getTextLayout,
  hideToast,
  showToast,
  widget
}
export default {
  align,
  createWidget,
  deleteWidget,
  getTextLayout,
  hideToast,
  showToast,
  widget
}
