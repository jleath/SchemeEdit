const Editor = (function() {
  const TAB_WIDTH = 2;
  const ARROW_KEYS = ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'];
  const INPUT_ID = 'editor-input';
  const INPUT_TAG = 'textarea';
  const DISPLAY_ID = 'editor-display';
  const DISPLAY_TAG = 'div';
  const SCHEME_KEYWORDS = [
    'access',            'define-syntax',
    'macro',             'and',
    'delay',             'make-environment',
    'begin',             'do',
    'named-lambda',      'bkpt',
    'fluid-let',         'or',
    'case',              'if',
    'quasiquote',        'cond',
    'in-package',        'quote',
    'cons-stream',       'lambda',
    'scode-quote',       'declare',
    'let',               'sequence',
    'default-object?',   'let*',
    'set!',              'define',
    'let-syntax',        'the-environment',
    'define-integrable', 'letrec',
    'unassigned?',       'define-macro',
    'local-declare',     'using-syntax',
    'define-structure',
  ];
  const SCHEME_KEYWORD_REGEX = new RegExp(`^(${SCHEME_KEYWORDS.join('|')})$`, 'i');

  function Editor(editorDiv) {
    this.editorDiv = editorDiv;
    this.display = createComponent(editorDiv, DISPLAY_TAG, DISPLAY_ID, 'editor-panel');
    this.input = createComponent(editorDiv, INPUT_TAG, INPUT_ID, 'editor-panel');
    this.display.innerHTML = "<p>Welcome to SchemeEdit!</p><p>Start typing to dismiss this message.</p>";
    this.input.focus();
    this.inputFocused = true;
    this.keyPressed = false;
    bindEvents(this);
  }

  function createComponent(parent, tag, id, className) {
    let newElement = parent.ownerDocument.createElement(tag);
    newElement.id = id;
    newElement.className = className;
    parent.append(newElement);
    return newElement;
  }

  function bindEvents(context) {
    context.display.addEventListener('click', e => context.input.focus());
    context.input.addEventListener('input', handleInput.bind(context));
    context.input.addEventListener('keydown', handleKeydown.bind(context));
    context.input.addEventListener('keyup', handleKeyup.bind(context));
    context.input.addEventListener('focus', handleFocus.bind(context));
    context.input.addEventListener('blur', handleBlur.bind(context));
  }

  function handleFocus(event) {
    this.inputFocused = true;
    let caret = document.querySelector('#caret');
    if (caret) {
      caret.classList.add('blinking');
    }
  }

  function handleBlur(event) {
    this.inputFocused = false;
    let caret = document.querySelector('#caret');
    if (caret) {
      caret.classList.remove('blinking');
    }
  }

  function handleKeydown(event) {
    if (event.key === 'Tab') {
      event.preventDefault();
      this.input.value += ''.padStart(TAB_WIDTH, ' ');
      updateDisplay(this);
    }
    if (isArrowKey(event.key)) {
      if (!this.keyPressed) {
        this.keyPressed = true;
        setTimeout(() => this.keyPressed = false, 10);
      } else {
        event.preventDefault();
      }
      updateDisplay(this);
    }
  }

  function handleKeyup(event) {
    if (isArrowKey(event.key)) {
      updateDisplay(this);
    }
  }

  function handleInput(event) {
    updateDisplay(this);
  }

  function parseInput(text) {
    if (text.length === 0) {
      return [{ parsed: '', originalText: '', textOffset: 0 }];
    }
    let parsedTokens = [];
    let tokens = text.split(/(\n| +|\(|\))/).filter(token => token);
    let parsedChars = 0;
    tokens.forEach((token) => {
      let originalText = token;
      token = token.replace(new RegExp('<', 'g'), '&lt');
      token = token.replace(new RegExp('>', 'g'), '&gt');
      token = token.replace(SCHEME_KEYWORD_REGEX, '<span class="keyword">$&</span>');
      token = token.replace("\n", '</p><p>');
      if (token && token.match(/\S/) && !Number.isNaN(Number(token))) {
        token = `<span class="number-literal">${token}</span>`;
      }
      parsedTokens.push({ parsed: token, originalText, textOffset: parsedChars });
      parsedChars += originalText.length;
    });
    return parsedTokens;
  }

  function insertCaret(parsedTokens, caretPosition, inputFocused) {
    let token = parsedTokens[0]
    for (let i = 1; i < parsedTokens.length; i += 1) {
      if (token.textOffset + token.originalText.length > caretPosition) {
        token.selected = true;
        break;
      }
      token = parsedTokens[i];
    }
    let endOffset = token.textOffset + token.originalText.length;
    if (token.parsed === '</p><p>') {
      if (endOffset === caretPosition) {
        token.parsed += caretHTML(inputFocused, ' ');
      } else {
        token.parsed = caretHTML(inputFocused, ' ') + token.parsed;
      }
    } else if (endOffset === caretPosition) {
      token.parsed += caretHTML(inputFocused, ' ');
    } else {
      let offset = caretPosition - token.textOffset;
      let wrappedChar = caretHTML(inputFocused, token.originalText[offset] || ' ');
      let left = token.originalText.slice(0, offset);
      let right = token.originalText.slice(offset + 1);
      token.parsed = token.parsed.replace(token.originalText, left + wrappedChar + right);
    }
  }

  function updateDisplay(context) {
    let inputText = context.input.value;
    let parsedTokens = parseInput(inputText);
    let inputSelection = context.input.selectionStart;
    insertCaret(parsedTokens, inputSelection, context.inputFocused);
    let html = '<p>' + parsedTokens.reduce((html, token) => html + token.parsed, '') + '</p>';
    html = html.replace(new RegExp('<p></p>', 'g'), '<p> </p>');
    context.display.innerHTML = html;
    let charAtCaret = getCharAtCaret(context);
    if (charAtCaret && charAtCaret.character === ')') {
      highlightMatchingParen(context, charAtCaret.node);
    }
  }

  function highlightMatchingParen(context, node) {
    let closeParenSpan = document.createElement('span');
    closeParenSpan.classList.add('matched-paren');
    let openParenSpan = closeParenSpan.cloneNode();
    let openParenInfo = findMatchingParen(node, node.textContent.length - 2);
    if (openParenInfo === undefined) {
      closeParenSpan.classList.add('bad-paren');
    }
    wrapContents(context, node, node.textContent.length - 1, node, node.textContent.length, closeParenSpan);
    if (openParenInfo) {
      wrapContents(context, openParenInfo.node, openParenInfo.offset, openParenInfo.node, openParenInfo.offset + 1, openParenSpan);
    }
  }

  function wrapContents(context, startNode, startOffset, endNode, endOffset, wrapNode) {
    let selection = context.display.ownerDocument.getSelection();
    let originalRange = selection.getRangeAt(0);
    let inputSelection = context.input.selectionStart;
    let range = new Range();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    range.surroundContents(wrapNode);
    selection.removeAllRanges();
    selection.addRange(originalRange);
    context.input.selectionStart = inputSelection;
  }

  function findMatchingParen(node, offset) {
    let closeParenCount = 0;
    while (node.id !== DISPLAY_ID) {
      while (offset >= 0) {
        if (node.textContent[offset] === ')') closeParenCount += 1;
        else if (node.textContent[offset] === '(' && closeParenCount > 0) closeParenCount -= 1;
        else if (node.textContent[offset] === '(') return { node, offset };
        offset -= 1;
      }
      if (node.previousSibling) {
        node = node.previousSibling;
      } else if (node.parentNode.previousSibling) {
        node = node.parentNode.previousSibling.lastChild;
      } else {
        return undefined;
      }
      offset = node.textContent.length - 1;
    }
    return undefined;
  }

  function getCharAtCaret(context) {
    let caretNode = context.display.querySelector('#caret');
    if (!caretNode || caretNode.parentElement.childNodes.length === 1) return undefined;
    if (!caretNode.previousSibling) return undefined;
    let text = caretNode.previousSibling.textContent;
    return { node: caretNode.previousSibling, character: text[text.length - 1] };
  }

  function caretHTML(inputFocused, innerText) {
    return `<span id="caret" ${inputFocused ? 'class="blinking"' : ''}>${innerText}</span>`;
  }

  function isArrowKey(key) {
    return ARROW_KEYS.some(keyCode => keyCode === key);
  }

  return Editor;
}());

document.addEventListener('DOMContentLoaded', () => {
  const editor = new Editor(document.querySelector('#editor'));
});