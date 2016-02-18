# Custom Folds

An Atom plugin for defining custom markers for foldable regions.

## Usage

In the plugin's settings, you can define custom text that identifies the start and end of a foldable section of code.

By default, the text "// <editor-fold" identifies the start of a foldable region and "// </editor-fold>" marks the end of the region. These default settings were only chosen because the author works on a team where a few "special" engineers insist on using JetBrain's WebStorm IDE. These tags allow both sets of engineers (those using Atom and those using WebStorm) to have the same foldable regions of code.

The folding is recursive, so you can have regions within regions within regions.

### Commands

* `cusotm-folds:fold-here` &mdash; Folds the region you're within.
* `cusotm-folds:unfold-here` &mdash; Unfolds the region you're within.
* `cusotm-folds:fold-all` &mdash; Folds all regions recursively.
* `cusotm-folds:unfold-all` &mdash; Unfolds all regions.
* `cusotm-folds:fold-top-level` &mdash; Only fold the outer regions.

### Keybindings

Keybindings have not been set for this package. They can easily be added by referencing the commands listed above.

## Coming Soon

* Regex support
* Custom highlighting of foldable regions
* Clickable region headers

## License

See [LICENSE](https://github.com/bsegraves/custom-folds/blob/master/LICENSE.md) for details.
