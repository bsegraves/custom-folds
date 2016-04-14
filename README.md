# Custom Folds

An Atom plugin for defining custom markers for foldable regions.

This plugin was inspired by Visual Studio's treatment of C#'s `#region` tags.

## Usage

In the plugin's settings, you can define custom text that identifies the start and end of a foldable section of code.

By default, a comment starting with `<editor-fold` identifies the start of a foldable region and another comment starting with `</editor-fold>` marks the end of that region. These default settings were only chosen because the author works on a team where a few "special" engineers insist on using JetBrain's WebStorm IDE. These tags allow both sets of engineers (those using Atom and those using WebStorm) to have the same foldable regions of code.

But you don't need to be working with people that insist on using WebStorm. You can configure the starting and ending tags to whatever you want. This allows you to create your own, custom, collapsible regions.

The folding is recursive, so you can have regions within regions within regions.

Highlighting of these foldable tags is also enabled by default. This can be easily disabled from the package's Settings screen.

![Image of highlighting](https://github.com/bsegraves/custom-folds/raw/master/highlight.png)

There is also an option to auto-fold files on load. This can be enabled from the package's settings.

### Commands

* `custom-folds:fold-here` (ctrl-shift-[) &mdash; Folds the region you're within.
* `custom-folds:unfold-here` (ctrl-shift-]) &mdash; Unfolds the region you're within.
* `custom-folds:fold-all` (ctrl-alt-shift-[) &mdash; Folds all regions recursively.
* `custom-folds:unfold-all` (ctrl-alt-shift-]) &mdash; Unfolds all regions.
* `custom-folds:fold-top-level` &mdash; Only fold the outer regions.
* `custom-folds:toggle-fold` (ctrl-shift-\\) &mdash; Toggle folding at the cursor position.

## Tips

Personally I use the following snippet for creating new foldable regions.

```json
"editor-fold":
	"prefix": "// e"
	"body": "// <editor-fold desc='$1'>\n// </editor-fold>"`
```


## Coming Soon

* Multiple region tags.

## License

See [LICENSE](https://github.com/bsegraves/custom-folds/blob/master/LICENSE.md) for details.
