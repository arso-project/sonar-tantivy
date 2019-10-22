# Development

## Run tests

```
cargo test
CARGO_ENV=development npm run test
```

## Making a release

* Commit changes and run tests (see above)
* Run tests again
* Increase version number in BOTH `Cargo.toml` and `package.json` to the desired version number. `Cargo.toml` and `package.json` version numbers have the same.
* Commit the changes, commit message should be like "v0.2.3".
* Create an annotated git tag:
  `git tag -a v0.2.3`
* Push the tag to github: `git push origin --tags`
  This triggers the Travis CI, which will test, build releases, and upload the releases to Github releases.
* Publish the release on NPM: `npm publish`.
