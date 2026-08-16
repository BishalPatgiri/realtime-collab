/**
 * Pixel position of a character offset within a textarea.
 *
 * Textareas expose no API for "where would the caret be at index N", so we
 * build a hidden div that mirrors the textarea's text and every layout-relevant
 * style, place a marker span at the offset, and read its position. This is the
 * standard technique behind textarea caret overlays.
 */

const MIRRORED_PROPERTIES = [
  'boxSizing',
  'width',
  'height',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'letterSpacing',
  'lineHeight',
  'textTransform',
  'wordSpacing',
  'tabSize',
  'whiteSpace',
  'wordWrap',
] as const;

export interface CaretPosition {
  top: number;
  left: number;
  height: number;
}

export function getCaretCoordinates(textarea: HTMLTextAreaElement, index: number): CaretPosition {
  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement('div');

  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.overflow = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';
  for (const prop of MIRRORED_PROPERTIES) {
    mirror.style[prop] = style[prop];
  }

  mirror.textContent = textarea.value.slice(0, index);
  const marker = document.createElement('span');
  // A zero-width space gives the marker a measurable box at the caret.
  marker.textContent = textarea.value.slice(index) || '​';
  mirror.appendChild(marker);

  document.body.appendChild(mirror);
  const top = marker.offsetTop - textarea.scrollTop;
  const left = marker.offsetLeft - textarea.scrollLeft;
  const height = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
  document.body.removeChild(mirror);

  return { top, left, height };
}
