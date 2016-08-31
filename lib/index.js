'use babel';

import {CompositeDisposable, Point, Range, TextEditor} from 'atom';

// option to auto fold on file open
// clickable region headers, perhaps using block content?
var CustomFolds =
module.exports = {
	subscriptions: null,

	config: {
		prefix: {
			title: 'Beginning of foldable region',
			description: 'The comment that marks the start of the foldable region must begin with this string literal (not counting leading white space or comment characters).',
			type: 'string',
			default: '<editor-fold',
			order: 1
		},
		postfix: {
			title: 'End of foldable region',
			description: 'The comment that marks the end of the foldable region must begin with this string literal (not counting leading white space or comment characters).',
			type: 'string',
			default: '</editor-fold>',
			order: 2
		},
		areRegionsFoldedOnLoad: {
			title: 'Auto fold on file open?',
			description: 'If checked, regions start in their folded state when a file is opened.',
			type: 'boolean',
			default: false,
			order: 3
		},
		areRegionsHighlighted: {
			title: 'Enable region highlighting?',
			description: 'If checked, the beginning and end of foldable regions are highlighted.',
			type: 'boolean',
			default: true,
			order: 4
		}
	},

	prefix: '',
	postfix: '',
	areRegionsFoldedOnLoad: false,
	areRegionsHighlighted: true,

	editors: [],
	editorIdToMarkers: {},

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

		CustomFolds.prefix = atom.config.get('custom-folds.prefix');
		atom.config.onDidChange('custom-folds.prefix', (change) => {
			CustomFolds.prefix = change.newValue;
			CustomFolds._updateHighlightsAcrossEditors();
		});

		CustomFolds.postfix = atom.config.get('custom-folds.postfix');
		atom.config.onDidChange('custom-folds.postfix', (change) => {
			CustomFolds.postfix = change.newValue;
			CustomFolds._updateHighlightsAcrossEditors();
		});

		CustomFolds.areRegionsFoldedOnLoad = atom.config.get('custom-folds.areRegionsFoldedOnLoad');
		atom.config.onDidChange('custom-folds.areRegionsFoldedOnLoad', (change) => {
			CustomFolds.areRegionsFoldedOnLoad = change.newValue;
		});

		CustomFolds.areRegionsHighlighted = atom.config.get('custom-folds.areRegionsHighlighted');
		atom.config.onDidChange('custom-folds.areRegionsHighlighted', (change) => {
			CustomFolds.areRegionsHighlighted = change.newValue;
			CustomFolds._updateHighlightsAcrossEditors();
		});

		this.subscriptions.add(atom.workspace.observeTextEditors((editor) => {
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

		this.subscriptions.add(atom.workspace.onDidAddTextEditor((event) => {
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
				if (line.replace(CustomFolds.commentChars,'').trim().startsWith(CustomFolds.prefix)) {
					const endRow = CustomFolds._rowOfEndTag(editor, c);
					if (c < endRow) {
						CustomFolds._fold(editor, c, endRow);
						c = endRow + 1;
					}
				}
			}
		}
	},

	foldAll() {
		let editor = CustomFolds._getEditor();

		let startPrefixStack = [];
		for (let c=0, cLen=editor.getLineCount(); c<cLen; ++c) {
			const line = editor.lineTextForBufferRow(c).trim();
			if (editor.isBufferRowCommented(c)) {
				if (line.replace(CustomFolds.commentChars,'').trim().startsWith(CustomFolds.prefix)) {
					startPrefixStack.push(c);
				} else if (line.replace(CustomFolds.commentChars,'').trim().startsWith(CustomFolds.postfix)) {
					if (startPrefixStack.length) {
						const startRow = startPrefixStack.pop();
						CustomFolds._fold(editor, startRow, c);
					} else {
						atom.notifications.addWarning(`Extra closing fold tag found at line ${c + 1}.`);
					}
				}
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
				if (line.replace(CustomFolds.commentChars,'').trim().startsWith(CustomFolds.prefix)) {
					editor.unfoldBufferRow(c);
				}
			}
		}
	},

	// TODO: do this for each cursor
	foldHere() {
		let editor = CustomFolds._getEditor();

		for (let row=editor.getCursorBufferPosition().row; row>=0; --row) {
			const line = editor.lineTextForBufferRow(row).trim();
			if (editor.isBufferRowCommented(row)) {

				if (line.replace(CustomFolds.commentChars,'').trim().startsWith(CustomFolds.prefix)) {
					const endRow = CustomFolds._rowOfEndTag(editor, row);
					if (row < endRow) {
						CustomFolds._fold(editor, row, endRow);
					}
					break;
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
		editor.setCursorBufferPosition(new Point(startRow, 512)); // show up to 512 characters of the start region tag
		editor.selectDown(endRow-startRow);
		editor.foldSelectedLines();
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
	_rowOfEndTag(editor, startRow) {
		let result = -1;

		let startTagCount = 1;
		let c = startRow + 1;
		const cLen = editor.getLineCount();
		for (; c<cLen; ++c) {
			const line = editor.lineTextForBufferRow(c).trim();
			if (editor.isBufferRowCommented(c)) {
				if (line.replace(CustomFolds.commentChars,'').trim().startsWith(CustomFolds.prefix)) {
					++startTagCount;
				} else if (line.replace(CustomFolds.commentChars,'').trim().startsWith(CustomFolds.postfix)) {
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
		markers.forEach((m) => m.destroy());

		if (!CustomFolds.areRegionsHighlighted) {
			return;
		}

		for (let c=0, cLen=editor.getLineCount(); c<cLen; ++c) {
			const line = editor.lineTextForBufferRow(c).trim();

			let cls;

			if (line.replace(CustomFolds.commentChars,'').trim().startsWith(CustomFolds.prefix)) {
				cls = 'custom-folds-start';
			} else if (line.replace(CustomFolds.commentChars,'').trim().startsWith(CustomFolds.postfix)) {
				cls = 'custom-folds-stop';
			}

			if (cls) {
				let range = [[c,0],[c,0]];
				let marker = editor.markBufferRange(range);
				markers.push(marker);
				editor.decorateMarker(marker, {type: 'line', class: cls});
			}
		}
	},

	_updateHighlightsAcrossEditors() {
		CustomFolds.editors.forEach(CustomFolds._updateHighlights);
	}
	// </editor-fold> helpers
};
