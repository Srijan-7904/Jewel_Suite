/**
 * Tally Software Style Keyboard Navigation System
 *
 * Emulates the classic Tally ERP data-entry workflow:
 * - [Enter] Key: Moves FORWARD to the next input/select field (and auto-selects existing value for instant overwrite)
 * - [Esc] Key: Moves BACKWARD to the previous input field (like Shift+Tab in browsers)
 *              If an autocomplete/dropdown is open, Esc closes the dropdown first.
 *              If at the top of a modal dialog, Esc closes the modal.
 */

export interface TallyNavigationOptions {
  scopeRef?: React.RefObject<HTMLElement | null>;
  scopeElement?: HTMLElement | null;
  isDropdownOpen?: boolean;
  onCloseDropdown?: () => void;
  onModalClose?: () => void;
  onEnterAtEnd?: (lastElement: HTMLElement) => void;
  enabled?: boolean;
}

const FOCUSABLE_SELECTOR = [
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"]):not([readonly])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  'button[type="submit"]:not([disabled]):not([tabindex="-1"])',
  'button.btn-primary:not([disabled]):not([tabindex="-1"])',
  'button.pos-save-btn:not([disabled]):not([tabindex="-1"])',
  'button.tally-nav-target:not([disabled]):not([tabindex="-1"])',
].join(', ');

/**
 * Finds all visible, enabled focusable elements in logical DOM order
 */
export function getTallyFocusableElements(scope: HTMLElement): HTMLElement[] {
  const elements = Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return elements.filter((el) => {
    // Check if element is visible and not hidden
    if (el.offsetParent === null && el.offsetWidth === 0 && el.offsetHeight === 0) {
      return false;
    }
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    // Skip small inline buttons like close/unlink icons unless explicitly marked
    if (el.tagName === 'BUTTON' && (el.classList.contains('tag-unlink-btn') || el.classList.contains('tag-flyout-close'))) {
      return false;
    }
    return true;
  });
}

/**
 * Focuses an element and selects its text if it is a text/number input
 */
export function focusAndSelectTally(el: HTMLElement | null): boolean {
  if (!el) return false;
  try {
    el.focus();
    if (el instanceof HTMLInputElement) {
      const type = (el.type || '').toLowerCase();
      if (['text', 'number', 'tel', 'email', 'search'].includes(type)) {
        // Defer select slightly so focus event doesn't deselect
        setTimeout(() => {
          try {
            el.select();
          } catch {
            // Ignored for input types that don't support select
          }
        }, 10);
      }
    }
    return true;
  } catch (err) {
    console.warn('[TallyNav] Focus failed:', err);
    return false;
  }
}

/**
 * Finds the nearest container scope: modal dialog if open, else pos-container or document.body
 */
export function getTallyScope(activeEl: HTMLElement): HTMLElement {
  const modal = activeEl.closest<HTMLElement>(
    '.customer-modal-dialog, .customer-modal-dialog-wide, [role="dialog"], .modal-dialog, .modal-content'
  );
  if (modal) return modal;

  const activeModalOnPage = document.querySelector<HTMLElement>(
    '.customer-modal-dialog:not([hidden]), [role="dialog"]:not([hidden])'
  );
  if (activeModalOnPage && activeModalOnPage.offsetParent !== null) {
    return activeModalOnPage;
  }

  const pageContainer = activeEl.closest<HTMLElement>('.pos-container, .page-container, form');
  if (pageContainer) return pageContainer;

  return document.body;
}

/**
 * Main keydown handler implementing Tally Enter/Esc behavior
 */
export function handleTallyKeyDown(
  e: KeyboardEvent | React.KeyboardEvent,
  options?: TallyNavigationOptions
): boolean {
  if (options?.enabled === false) return false;

  const key = e.key;
  if (key !== 'Enter' && key !== 'Escape') {
    return false;
  }

  const activeEl = document.activeElement as HTMLElement | null;
  if (!activeEl) return false;

  // Let multiline textareas receive normal Enter unless user holds Ctrl
  if (activeEl.tagName === 'TEXTAREA' && key === 'Enter' && !e.ctrlKey && !e.metaKey) {
    return false;
  }

  // Determine current active container scope
  const scope =
    options?.scopeElement ||
    options?.scopeRef?.current ||
    getTallyScope(activeEl);

  const focusables = getTallyFocusableElements(scope);
  const currentIndex = focusables.indexOf(activeEl);

  // =========================================================================
  // ESCAPE KEY: Move to PREVIOUS Field (or close active popup / modal)
  // =========================================================================
  if (key === 'Escape') {
    // 1. If an active dropdown/flyout was open, close it first
    if (options?.isDropdownOpen && options.onCloseDropdown) {
      e.preventDefault();
      e.stopPropagation();
      options.onCloseDropdown();
      return true;
    }

    // Check if an open suggestion flyout is present in DOM
    const openFlyout = document.querySelector<HTMLElement>('.tag-suggestions-flyout, .item-flyout-portal');
    if (openFlyout && options?.onCloseDropdown) {
      e.preventDefault();
      e.stopPropagation();
      options.onCloseDropdown();
      return true;
    }

    // 2. Move to PREVIOUS focusable element (Tally Shift+Tab backward step)
    if (currentIndex > 0) {
      e.preventDefault();
      e.stopPropagation();
      const prevEl = focusables[currentIndex - 1];
      focusAndSelectTally(prevEl);
      return true;
    }

    // 3. At the very first field: if inside a modal dialog, close/exit dialog
    if (currentIndex === 0 || currentIndex === -1) {
      if (options?.onModalClose) {
        e.preventDefault();
        e.stopPropagation();
        options.onModalClose();
        return true;
      }
    }
    return false;
  }

  // =========================================================================
  // ENTER KEY: Move to NEXT Field (Tally forward step)
  // =========================================================================
  if (key === 'Enter') {
    // If user is currently focused on an action button, let normal click proceed
    if (activeEl.tagName === 'BUTTON' && !activeEl.classList.contains('styled-select')) {
      // Let standard Enter press button
      return false;
    }

    // If dropdown select list is currently expanded or navigating, do not hijack
    if (activeEl.getAttribute('aria-expanded') === 'true') {
      return false;
    }

    if (currentIndex !== -1 && currentIndex + 1 < focusables.length) {
      if (options?.onCloseDropdown) {
        options.onCloseDropdown();
      }
      e.preventDefault();
      e.stopPropagation();
      const nextEl = focusables[currentIndex + 1];
      focusAndSelectTally(nextEl);
      return true;
    }

    // If at the last field in the scope
    if (currentIndex !== -1 && currentIndex + 1 === focusables.length) {
      if (options?.onEnterAtEnd) {
        e.preventDefault();
        e.stopPropagation();
        options.onEnterAtEnd(activeEl);
        return true;
      }
    }
  }

  return false;
}

