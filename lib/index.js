'use babel';

import {CompositeDisposable, Point, Range, TextEditor} from 'atom';

const PREFIX_COUNT = 3;

// option to auto fold on file open
// clickable region headers, perhaps using block content?
var CustomFolds =
module.exports = {
	subscriptions: null,

	config: {
		prefix_0: {
			title: 'Beginning of first foldable region pair',
			description: 'The comment that marks the start of the foldable region must begin with this string literal (not counting leading white space or comment characters).',
			type: 'string',
			default: '<editor-fold',
			order: 1
		},
		postfix_0: {
			title: 'End of first foldable region pair',
			description: 'The comment that marks the end of the foldable region must begin with this string literal (not counting leading white space or comment characters).',
			type: 'string',
			default: '</editor-fold>',
			order: 2
		},
		prefix_1: {
			title: 'Beginning of second foldable region pair',
			description: 'The comment that marks the start of the foldable region must begin with this string literal (not counting leading white space or comment characters).',
			type: 'string',
			default: '#region',
			order: 3
		},
		postfix_1: {
			title: 'End of second foldable region pair',
			description: 'The comment that marks the end of the foldable region must begin with this string literal (not counting leading white space or comment characters).',
			type: 'string',
			default: '#endregion',
			order: 4
		},
		prefix_2: {
			title: 'Beginning of third foldable region pair',
			description: 'The comment that marks the start of the foldable region must begin with this string literal (not counting leading white space or comment characters).',
			type: 'string',
			default: '',
			order: 5
		},
		postfix_2: {
			title: 'End of third foldable region pair',
			description: 'The comment that marks the end of the foldable region must begin with this string literal (not counting leading white space or comment characters).',
			type: 'string',
			default: '',
			order: 6
		},
		areRegionsFoldedOnLoad: {
			title: 'Auto fold on file open?',
			description: 'If checked, regions start in their folded state when a file is opened.',
			type: 'boolean',
			default: false,
			order: 7
		},
		areRegionsHighlighted: {
			title: 'Enable region highlighting?',
			description: 'If checked, the beginning and end of foldable regions are highlighted.',
			type: 'boolean',
			default: true,
			order: 8
		}
	},

	prefix: [],
	postfix: [],
	areRegionsFoldedOnLoad: false,
	areRegionsHighlighted: true,

	editors: [],
	editorIdToMarkers: {},

 	//<editor-fold> yes

	//</editor-fold> no

	//#region
	//#endregion

	// blah
	// halb

	// <editor-fold> LIFE **************************************************
	activate() {
		this.subscriptions = new CompositeDisposable();
		this.subscriptions.add(
			atom.commands.add('atom-workspace', {
				'custom-folds:fold-top-level': CustomFolds.foldTopLevel,
				'custom-folds:fold-all': CustomFolds.foldAll,
				'custom-folds:unfold-all': CustomFolds.unfoldAll,
				'custom-folds:fold-here': CustomFolds.foldHere,
				'custom-folds:unfold-here': CustomFolds.unfoldHere,
				'custom-folds:toggle-fold': CustomFolds.toggleFold
			}));

		for (let c=0; c<PREFIX_COUNT; ++c) {
			const prefixPath = `custom-folds.prefix_${c}`;
			const postfixPath = `custom-folds.postfix_${c}`;
			const prefix = atom.config.get(prefixPath);
			const postfix = atom.config.get(postfixPath);

			const index = CustomFolds.prefix.length;
			CustomFolds.prefix.push(prefix);
			atom.config.onDidChange(prefixPath, change => {
				CustomFolds.prefix[index] = change.newValue;
				CustomFolds._updateHighlightsAcrossEditors();
			});

			CustomFolds.postfix.push(postfix);
			atom.config.onDidChange(postfixPath, change => {
				CustomFolds.postfix[index] = change.newValue;
				CustomFolds._updateHighlightsAcrossEditors();
			});
		}

		CustomFolds.areRegionsFoldedOnLoad = atom.config.get('custom-folds.areRegionsFoldedOnLoad');
		atom.config.onDidChange('custom-folds.areRegionsFoldedOnLoad', change => {
			CustomFolds.areRegionsFoldedOnLoad = change.newValue;
		});

		CustomFolds.areRegionsHighlighted = atom.config.get('custom-folds.areRegionsHighlighted');
		atom.config.onDidChange('custom-folds.areRegionsHighlighted', change => {
			CustomFolds.areRegionsHighlighted = change.newValue;
			CustomFolds._updateHighlightsAcrossEditors();
		});

		this.subscriptions.add(atom.workspace.observeTextEditors(editor => {
			CustomFolds.editors.push(editor);
			CustomFolds.editorIdToMarkers[editor.id] = [];

			if (CustomFolds.areRegionsHighlighted) {
				window.requestAnimationFrame(() => {
					CustomFolds._updateHighlights(editor);
				});
			}

			// It's easier just to always subscribe to this.
			editor.onDidStopChanging(() => CustomFolds._updateHighlights(editor));
		}));

		this.subscriptions.add(atom.workspace.onDidAddTextEditor(event => {
			if (CustomFolds.areRegionsFoldedOnLoad) {
				// This is terrible. What's the proper way to do this in Atom? How can I tell when it's safe to fold stuff?
				// This timeout was added so that 'fold on load' would work with Atom 1.6.x.
				window.setTimeout(() => {
					CustomFolds.foldAll();
				}, 500);
			}
		}));
	},

	deactivate() {
		this.subscriptions.dispose();
	},
	// </editor-fold> life

	// <editor-fold> RESPONDERS ********************************************
	foldTopLevel() {
		let editor = CustomFolds._getEditor();

		for (let c=0, cLen=editor.getLineCount(); c<cLen; ++c) {
			const line = editor.lineTextForBufferRow(c).trim();

			if (editor.isBufferRowCommented(c)) {
				CustomFolds.prefix.forEach((prefix, index) => {
					const postfix = CustomFolds.postfix[index];
					if (!prefix || !prefix.length || !postfix || !postfix.length) { return; }

					if (line.replace(CustomFolds.commentChars,'').trim().startsWith(prefix)) {
						const endRow = CustomFolds._rowOfEndTag(prefix, postfix, editor, c);
						if (c < endRow) {
							CustomFolds._fold(editor, c, endRow);
							c = endRow + 1;
						}
					}
				});
			}
		}
	},

	foldAll() {
		let editor = CustomFolds._getEditor();

		let startPrefixStack = [];
		for (let c=0, cLen=editor.getLineCount(); c<cLen; ++c) {
			const line = editor.lineTextForBufferRow(c).trim();
			if (editor.isBufferRowCommented(c)) {
				CustomFolds.prefix.forEach((prefix, index) => {
					const postfix = CustomFolds.postfix[index];
					if (!prefix || !prefix.length || !postfix || !postfix.length) { return; }

					if (line.replace(CustomFolds.commentChars,'').trim().startsWith(prefix)) {
						startPrefixStack.push(c);
					} else if (line.replace(CustomFolds.commentChars,'').trim().startsWith(postfix)) {
						if (startPrefixStack.length) {
							const startRow = startPrefixStack.pop();
							CustomFolds._fold(editor, startRow, c);
						} else {
							atom.notifications.addWarning(`Extra closing fold tag found at line ${c + 1}.`);
						}
					}
				});
			}
		}

		if (startPrefixStack.length) {
			atom.notifications.addWarning(`Extra opening fold tag found at line ${startPrefixStack.pop() + 1}.`);
		}
	},

	unfoldAll() {
		let editor = CustomFolds._getEditor();

		for (let c=0, cLen=editor.getLineCount(); c<cLen; ++c) {
			const line = editor.lineTextForBufferRow(c).trim();

			if (editor.isBufferRowCommented(c)) {
				CustomFolds.prefix.forEach(prefix => {
					if (!prefix || !prefix.length) { return; }

					if (line.replace(CustomFolds.commentChars,'').trim().startsWith(prefix)) {
						editor.unfoldBufferRow(c);
					}
				});
			}
		}
	},

	// TODO: do this for each cursor
	foldHere() {
		let editor = CustomFolds._getEditor();

		for (let row=editor.getCursorBufferPosition().row; row>=0; --row) {
			const line = editor.lineTextForBufferRow(row).trim();
			if (editor.isBufferRowCommented(row)) {
				for (let c=0, cLen=CustomFolds.prefix.length; c<cLen; ++c) {
					const prefix = CustomFolds.prefix[c];
					const postfix = CustomFolds.postfix[c];
					if (!prefix || !prefix.length || !postfix || !postfix.length) { continue; }

					if (line.replace(CustomFolds.commentChars,'').trim().startsWith(prefix)) {
						const endRow = CustomFolds._rowOfEndTag(prefix, postfix, editor, row);
						if (row < endRow) {
							CustomFolds._fold(editor, row, endRow);
						}

						return;
					}
				}
			}
		}
	},

	unfoldHere() {
		let editor = CustomFolds._getEditor();
		editor.unfoldBufferRow(editor.getCursorBufferPosition().row);
	},

	toggleFold() {
		let editor = CustomFolds._getEditor();
		const row = editor.getCursorBufferPosition().row;
		if (editor.isFoldedAtBufferRow(row)) {
			CustomFolds.unfoldHere();
		} else {
			CustomFolds.foldHere();
		}
	},
	// </editor-fold> responders

	// <editor-fold> HELPERS ***********************************************
	_fold(editor, startRow, endRow) {
		editor.setSelectedBufferRange(new Range(new Point(startRow, 0), new Point(endRow, 0)));
		editor.foldSelectedLines();
		// editor.moveUp();
	},

	// save off the commentchar and trim it
	_getEditor() {
		const editor = atom.workspace.getActiveTextEditor();
		if (editor) {
			CustomFolds.commentChars = (atom.config.get('editor.commentStart', {scope: editor.getRootScopeDescriptor()}) || '').trim();
		}
		return editor;
	},

	// takes nesting into account
	_rowOfEndTag(prefix, postfix, editor, startRow) {
		let result = -1;

		let startTagCount = 1;
		let c = startRow + 1;
		const cLen = editor.getLineCount();
		for (; c<cLen; ++c) {
			const line = editor.lineTextForBufferRow(c).trim();
			if (editor.isBufferRowCommented(c)) {
				if (line.replace(CustomFolds.commentChars,'').trim().startsWith(prefix)) {
					++startTagCount;
				} else if (line.replace(CustomFolds.commentChars,'').trim().startsWith(postfix)) {
					if (--startTagCount === 0) {
						break;
					}
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

	_updateHighlights(editor) {
		if (!editor.isAlive()) {
			return;
		}

		CustomFolds.commentChars = (atom.config.get('editor.commentStart', {scope: editor.getRootScopeDescriptor()}) || '').trim();

		let markers = CustomFolds.editorIdToMarkers[editor.id];
		markers.forEach(m => m.destroy());

		if (!CustomFolds.areRegionsHighlighted) {
			return;
		}

		for (let c=0, cLen=editor.getLineCount(); c<cLen; ++c) {
			const line = editor.lineTextForBufferRow(c).trim();

			CustomFolds.prefix.forEach((prefix, index) => {
				const postfix = CustomFolds.postfix[index];
				if (!prefix || !prefix.length || !postfix || !postfix.length) { return; }

				let cls;
				if (line.replace(CustomFolds.commentChars,'').trim().startsWith(prefix)) {
					cls = 'custom-folds-start';
				} else if (line.replace(CustomFolds.commentChars,'').trim().startsWith(postfix)) {
					cls = 'custom-folds-stop';
				}

				if (cls) {
					let range = [[c,0],[c,0]];
					let marker = editor.markBufferRange(range);
					markers.push(marker);
					editor.decorateMarker(marker, {type: 'line', class: cls});
				}
			});
		}
	},

	_updateHighlightsAcrossEditors() {
		CustomFolds.editors.forEach(CustomFolds._updateHighlights);
	}
	// </editor-fold> helpers
};
