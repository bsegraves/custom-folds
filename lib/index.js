"use babel";

import {CompositeDisposable, Point, Range, TextBuffer} from 'atom';

// option to auto fold on file open
// custom highlighting for regions
//    on file load, add highlighting
//    on debounced text edit, recalc highlighting ... (ugh)
//       on check for changed lines? For this to work, need to keep catalog of Prefix and Postfix lines.
//       if those didn't change, look for new tags in changed lines
//       no, this is a rabbit hole - abandon
//    ok, new attempt
//       on debounced text edit, just recalc on all lines
// clickable region headers, perhaps using block content?
var CustomFolds =
	module.exports = {
		subscriptions: null,

		config: {
			prefix: {
				title: 'Start of fold marker',
				description: 'The first line of the folding block must start with this string literal (not counting leading white space).',
				type: 'string',
				default: '// <editor-fold'
			},
			postfix: {
				title: 'End of fold marker',
				description: 'The last line of the folding block must start with this string literal (not counting leading white space).',
				type: 'string',
				default: '// </editor-fold>'
			}
		},

		prefix: '',
		postfix: '',

		// <editor-fold> LIFE **************************************************
		activate() {
			this.subscriptions = new CompositeDisposable();
			this.subscriptions.add(
				atom.commands.add('atom-workspace', {
					'custom-folds:fold-top-level': CustomFolds.foldTopLevel,
					'custom-folds:fold-all': CustomFolds.foldAll,
					'custom-folds:unfold-all': CustomFolds.unfoldAll,
					'custom-folds:fold-here': CustomFolds.foldHere,
					'custom-folds:unfold-here': CustomFolds.unfoldHere
				}));

			CustomFolds.prefix = atom.config.get('custom-folds.prefix');
			atom.config.onDidChange('custom-folds.prefix', (newValue, oldValue) => {
				CustomFolds.prefix = newValue;
			});

			CustomFolds.postfix = atom.config.get('custom-folds.postfix');
			atom.config.onDidChange('custom-folds.postfix', (newValue, oldValue) => {
				CustomFolds.postfix = newValue;
			});
		},

		deactivate() {
			this.subscriptions.dispose();
		},
		// </editor-fold>

		// <editor-fold> RESPONDERS ********************************************
		foldTopLevel() {
			var editor = atom.workspace.getActiveTextEditor();
			var lineCount = editor.getLineCount();

			for (var c=0, cLen=lineCount; c<cLen; ++c) {
				var line = editor.lineTextForBufferRow(c).trim();

				if (line.startsWith(CustomFolds.prefix)) {
					var endRow = CustomFolds._rowOfEndTag(editor, c);
					if (c < endRow) {
						CustomFolds._fold(editor, c, endRow);
						c = endRow + 1;
					}
				}
			}
		},

		foldAll() {
			var editor = atom.workspace.getActiveTextEditor();
			var lineCount = editor.getLineCount();

			var startPrefixStack = [];
			for (var c=0, cLen=lineCount; c<cLen; ++c) {
				var line = editor.lineTextForBufferRow(c).trim();
				if (line.startsWith(CustomFolds.prefix)) {
					startPrefixStack.push(c);
				} else if (line.startsWith(CustomFolds.postfix)) {
					if (startPrefixStack.length) {
						var startRow = startPrefixStack.pop();
						CustomFolds._fold(editor, startRow, c);
					} else {
						atom.notifications.addWarning(`Extra closing fold tag found at line ${c + 1}.`);
					}
				}
			}

			if (startPrefixStack.length) {
				atom.notifications.addWarning(`Extra opening fold tag found at line ${startPrefixStack.pop() + 1}.`);
			}
		},

		unfoldAll() {
			var editor = atom.workspace.getActiveTextEditor();
			var lineCount = editor.getLineCount();

			for (var c=0, cLen=lineCount; c<cLen; ++c) {
				var line = editor.lineTextForBufferRow(c).trim();

				if (line.startsWith(CustomFolds.prefix)) {
					editor.unfoldBufferRow(c)
				}
			}
		},

		// TODO: do this for each cursor
		foldHere() {
			var editor = atom.workspace.getActiveTextEditor();
			var row = editor.getCursorBufferPosition().row;

			while (row >= 0) {
				var line = editor.lineTextForBufferRow(row).trim();
				if (line.startsWith(CustomFolds.prefix)) {
					const endRow = CustomFolds._rowOfEndTag(editor, row);
					if (row < endRow) {
						CustomFolds._fold(editor, row, endRow);
					}
					break;
				}

				--row;
			}
		},

		unfoldHere() {
			var editor = atom.workspace.getActiveTextEditor();
			editor.unfoldBufferRow(editor.getCursorBufferPosition().row)
		},
		// </editor-fold> RESPONDERS

		// <editor-fold> HELPERS ***********************************************
		// takes nesting into account
		_rowOfEndTag(editor, startRow) {
			let result = -1;

			let startTagCount = 1;
			let c = startRow + 1;
			const cLen = editor.getLineCount();
			for (; c<cLen; ++c) {
				const line = editor.lineTextForBufferRow(c).trim();
				if (line.startsWith(CustomFolds.prefix)) {
					++startTagCount;
				} else if (line.startsWith(CustomFolds.postfix)) {
					if (--startTagCount === 0) {
						break;
					}
				}
			}

			if (c === cLen) {
				atom.notifications.addWarning(`No end marker found for folding tag that starts on line ${startRow + 1}.`);
			} else {
				result = c;
			}

			return result;
		},

		_fold(editor, startRow, endRow) {
			editor.setSelectedBufferRange(new Range(new Point(startRow, 0), new Point(endRow, 0)));
			editor.foldSelectedLines();
			editor.moveUp();
		}
		// </editor-fold> HELPERS
	};
