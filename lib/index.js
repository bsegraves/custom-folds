﻿'use babel';

import {CompositeDisposable, Point, Range, TextEditor} from 'atom';
import {$} from 'atom-space-pen-views';
//_ref = require('space-pen'), $ = _ref.$, View = _ref.View;	//same error;

const PREFIX_COUNT = 0;

// option to auto fold on file open
// clickable region headers, perhaps using block content?
var CustomFolds =
module.exports = {
	subscriptions: null,

	config: {
		teZprefixes: {
			title: 'Beginning of first foldable region pair',
			description: 'The comment that marks the start of the foldable region must begin with this string literal (not counting leading white space or comment characters).',
			type: 'string',
			default: '<editor-fold',
			order: 1
		},
		teZpostfixes: {
			title: 'End of first foldable region pair',
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
			order: 7
		},
		areRegionsHighlighted: {
			title: 'Enable region highlighting?',
			description: 'If checked, the beginning and end of foldable regions are highlighted.',
			type: 'boolean',
			default: true,
			order: 8
		},
		teZtextFilePrefixes: {
			title: 'Beginning of first foldable region pair in text file',
			description: `The text that identifies the start of a foldable region in a text file (or any file type that doesn't support comments).`,
			type: 'string',
			default: '<editor-fold',
			order: 9
		},
		teZtextFilePostfixes: {
			title: 'End of first foldable region pair in text file',
			description: `The text that identifies the end of a foldable region in a text file (or any file type that doesn't support comments).`,
			type: 'string',
			default: '</editor-fold>',
			order: 10
		},
	},

	prefixes: [],
	postfixes: [],
	textFilePrefixes: [],
	textFilePostfixes: [],
	areRegionsFoldedOnLoad: false,
	areRegionsHighlighted: true,

	editors: [],
	editorIdToMarkers: {},

	// <editor-fold> LIFE ******************************************************
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


  			const prefixPath = 'custom-folds.teZprefixes';
			const lZteZprefixes = atom.config.get(prefixPath);
			CustomFolds.prefixes = lZteZprefixes.split(';;');

			atom.config.onDidChange(prefixPath, change => {
				CustomFolds.prefixes = change.newValue.split(';;');
				CustomFolds._updateHighlightsAcrossEditors();
			});

  			const postfixPath = `custom-folds.teZpostfixes`;
  			const lZteZpostfixes = atom.config.get(postfixPath);
			CustomFolds.postfixes = lZteZpostfixes.split(';;');

  			atom.config.onDidChange(postfixPath, change => {
  				CustomFolds.postfixes = change.newValue.split(';;');
  				CustomFolds._updateHighlightsAcrossEditors();
  			});

			const textFilePrefixPath = 'custom-folds.teZtextFilePrefixes';
			const lZteZtextFilePrefixes = atom.config.get(textFilePrefixPath);
			CustomFolds.textFilePrefixes = lZteZtextFilePrefixes.split(';;');

			atom.config.onDidChange(textFilePrefixPath, change => {
				CustomFolds.textFilePrefixes = change.newValue.split(';;');
				CustomFolds._updateHighlightsAcrossEditors();
			});

  			const textFilePostfixPath = `custom-folds.teZtextFilePostfixes`;
  			const lZteZtextFilePostfixes = atom.config.get(textFilePostfixPath);
     		        CustomFolds.textFilePostfixes = lZteZtextFilePostfixes.split(';;');

     		        atom.config.onDidChange(textFilePostfixPath, change => {
                		CustomFolds.textFilePostfixes = change.newValue.split(';;');
  				CustomFolds._updateHighlightsAcrossEditors();
  			});


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

			// Delaying two animation frames seems to fix the issue of the empty comment chars.
			// This is a really stupid fix. Would prefer an event to properly signal this but I can't find such an event in the atom api.
			window.requestAnimationFrame(() => {
				window.requestAnimationFrame(() => {
					CustomFolds._updateHighlights(editor);
				});
			});
			CustomFolds._addClickEvent(editor);

			// It's easier just to always subscribe to this.
			editor.onDidStopChanging(() => CustomFolds._updateHighlights(editor));
		}));

		this.subscriptions.add(atom.workspace.onDidAddTextEditor(event => {
				if (CustomFolds.areRegionsFoldedOnLoad) {
					event.textEditor.tokenizedBuffer.onDidTokenize(() => {
						CustomFolds.foldAll(event.textEditor);
					});
				}
		}));
	},

	deactivate() {
		this.subscriptions.dispose();
	},
	// </editor-fold> life

	// <editor-fold> RESPONDERS ************************************************
	foldTopLevel() {
		const options = CustomFolds._getOptions();

		for (let c=0, cLen=options.editor.getLineCount(); c<cLen; ++c) {
			const line = options.editor.lineTextForBufferRow(c).trim();

			if (!options.areCommentsRequired || options.editor.isBufferRowCommented(c)) {
				options.prefixes.forEach((prefix, index) => {
					const postfix = options.postfixes[index];
					if (!prefix || !prefix.length || !postfix || !postfix.length) { return; }

					if (line.replace(options.commentChars,'').trim().startsWith(prefix)) {
						const endRow = CustomFolds._rowOfEndTag(options, index, c);
						if (c < endRow) {
							CustomFolds._fold(options.editor, c, endRow);
							c = endRow + 1;
						}
					}
				});
			}
		}
	},

	foldAll(currentEditor=undefined) {
		// When called from keyboard binding, some arguments get sent in. We're only interested if the argument is the editor.
		if (!(currentEditor instanceof TextEditor)) {
			currentEditor = undefined;
		}
		const {editor, commentChars, areCommentsRequired, prefixes, postfixes} = CustomFolds._getOptions(currentEditor);

		let startPrefixStack = [];
		for (let c=0, cLen=editor.getLineCount(); c<cLen; ++c) {
			const line = editor.lineTextForBufferRow(c).trim();
			if (!areCommentsRequired || editor.isBufferRowCommented(c)) {
				prefixes.forEach((prefix, index) => {
					const postfix = postfixes[index];
					if (!prefix || !prefix.length || !postfix || !postfix.length) { return; }

					const trimmedLine = line.replace(commentChars,'').trim();
					if (trimmedLine.startsWith(prefix)) {
						startPrefixStack.push(c);
					} else if (trimmedLine.startsWith(postfix)) {
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
		const {editor, commentChars, areCommentsRequired, prefixes} = CustomFolds._getOptions();

		for (let c=0, cLen=editor.getLineCount(); c<cLen; ++c) {
			const line = editor.lineTextForBufferRow(c).trim();

			if (!areCommentsRequired || editor.isBufferRowCommented(c)) {
				prefixes.forEach(prefix => {
					if (!prefix || !prefix.length) { return; }

					if (line.replace(commentChars,'').trim().startsWith(prefix)) {
						editor.unfoldBufferRow(c);
					}
				});
			}
		}
	},

	// TODO: do this for each cursor
	foldHere() {
		const options = CustomFolds._getOptions();

		const row = CustomFolds._rowOfStartTag(options, options.editor.getCursorBufferPosition().row);
		if (row >= 0) {
			CustomFolds.foldRow(row, options);
		}
	},

	foldRow(row, options=undefined) {
		let result = false;

		options = options || CustomFolds._getOptions();

		row = +row;  // Ensure row is a number
		const line = options.editor.lineTextForBufferRow(row).trim();
		if (!options.areCommentsRequired || options.editor.isBufferRowCommented(row)) {
			for (let c=0, cLen=options.prefixes.length; c<cLen; ++c) {
				const prefix = options.prefixes[c];
				const postfix = options.postfixes[c];
				if (!prefix || !prefix.length || !postfix || !postfix.length) { continue; }

				if (line.replace(options.commentChars,'').trim().startsWith(prefix)) {
					const endRow = CustomFolds._rowOfEndTag(options, c, row);
					if (row < endRow) {
						CustomFolds._fold(options.editor, row, endRow);
						result = true;
					}

					break;
				}
			}
		}

		return result;
	},

	unfoldHere() {
		const {editor} = CustomFolds._getOptions();
		editor.unfoldBufferRow(editor.getCursorBufferPosition().row);
		// editor.unfoldCurrentRow();  // this does not seem to preserve internal folding
	},

	toggleFold() {
		const options = CustomFolds._getOptions();
		const row = options.editor.getCursorBufferPosition().row;

		if (options.editor.isFoldedAtBufferRow(row)) {
			CustomFolds.unfoldHere();
		} else {
			CustomFolds.foldHere(options);
		}
	},
	// </editor-fold> responders

	// <editor-fold> HELPERS ***************************************************
	_fold(editor, startRow, endRow) {
		editor.setSelectedBufferRange(new Range(new Point(startRow, 512), new Point(endRow, 512)));
		editor.foldSelectedLines();
	},

	// Fetch the current editor, applicable prefix and postfix arrays, as well as the commentChars
	_getOptions(editor=undefined) {
		editor = editor || atom.workspace.getActiveTextEditor();
		const commentChars = editor ? (atom.config.get('editor.commentStart', {scope: editor.getRootScopeDescriptor()}) || '').trim() : '';
		const areCommentsRequired = commentChars !== '';
		const prefixes = areCommentsRequired ? CustomFolds.prefixes : CustomFolds.textFilePrefixes;
		const postfixes = areCommentsRequired ? CustomFolds.postfixes : CustomFolds.textFilePostfixes;

		return {editor, commentChars, areCommentsRequired, prefixes, postfixes};
	},

	// takes nesting into account
	_rowOfStartTag(options, startRow) {
		let result = -1;

		let endTagCount = 1;
		for (let c=startRow; c>=0 && endTagCount>0; --c) {
			const line = options.editor.lineTextForBufferRow(c).trim();
			if (!options.areCommentsRequired || options.editor.isBufferRowCommented(c)) {
				for (let d=0, dLen=options.prefixes.length; d<dLen; ++d) {
					const prefix = options.prefixes[d];
					const postfix = options.postfixes[d];
					if (!prefix || !prefix.length || !postfix || !postfix.length) { continue; }

					if (line.replace(options.commentChars,'').trim().startsWith(postfix)) {
						// Don't count the ending tag if the user started the action while on an ending tag.
						if (c !== startRow) {
							++endTagCount;
						}
						break;
					} else if (line.replace(options.commentChars,'').trim().startsWith(prefix)) {
						--endTagCount;
						if (!endTagCount) {
							result = c;
						}
						break;
					}
				}
			}
		}

		return result;
	},

	// takes nesting into account
	_rowOfEndTag(options, pairIndex, startRow) {
		let result = -1;

		const prefix = options.prefixes[pairIndex];
		const postfix = options.postfixes[pairIndex];

		let startTagCount = 1;
		let c = startRow + 1;
		const cLen = options.editor.getLineCount();
		for (; c<cLen; ++c) {
			const line = options.editor.lineTextForBufferRow(c).trim();
			if (!options.areCommentsRequired || options.editor.isBufferRowCommented(c)) {
				if (line.replace(options.commentChars,'').trim().startsWith(prefix)) {
					++startTagCount;
				} else if (line.replace(options.commentChars,'').trim().startsWith(postfix)) {
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

		let markers = CustomFolds.editorIdToMarkers[editor.id];
		markers.forEach(m => m.destroy());

		const {commentChars, areCommentsRequired, prefixes, postfixes} = CustomFolds._getOptions(editor);
		// atom.notifications.addWarning(`CommmentChars: "${commentChars}".`);

		for (let c=0, cLen=editor.getLineCount(); c<cLen; ++c) {
			const line = editor.lineTextForBufferRow(c).trim();

			prefixes.forEach((prefix, index) => {
				const postfix = postfixes[index];
				if (!prefix || !prefix.length || !postfix || !postfix.length) { return; }

				let cls;
				if (line.replace(commentChars,'').trim().startsWith(prefix)) {
					cls = 'custom-folds-start';
				} else if (line.replace(commentChars,'').trim().startsWith(postfix)) {
					cls = 'custom-folds-stop';
				}

				if (cls) {
					let range = [[c,0],[c,0]];
					let marker = editor.markBufferRange(range);
					markers.push(marker);
					editor.decorateMarker(marker, {type: 'line', class: cls});
					if (cls === 'custom-folds-start') {
						editor.decorateMarker(marker, {type: 'line-number', class: cls});
					}

					if (!CustomFolds.areRegionsHighlighted) {
						editor.decorateMarker(marker, {type: 'line', class: 'no-highlight'});
						if (cls === 'custom-folds-start') {
							editor.decorateMarker(marker, {type: 'line-number', class: 'no-highlight'});
						}
					}
				}
			});
		}
	},

	_updateHighlightsAcrossEditors() {
		CustomFolds.editors.forEach(CustomFolds._updateHighlights);
	},

	_addClickEvent(editor) {
		const editorView = atom.views.getView(editor);
		const gutter = editorView.querySelector('.gutter');
		$(gutter).on('mousedown', '.line-number.custom-folds-start:not(.folded) .icon-right', function(event) {
			const row = event.target.parentElement.dataset.bufferRow;
			CustomFolds.foldRow(row);
		});
	}
	// </editor-fold> helpers
};



// For testing…

// <editor-fold desc='1'>
// <editor-fold desc='2'>
// <editor-fold desc='3'>
// </editor-fold>
// </editor-fold>
// </editor-fold>
