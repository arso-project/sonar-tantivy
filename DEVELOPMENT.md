# Development

## Run tests

```
cargo test
RUST_ENV=development npm run test
```

## Making a release

* Commit changes and run tests (see above)
* Run tests again
* Increase version number in BOTH `Cargo.toml` and `package.json` to the desired version number. `Cargo.toml` and `package.json` version numbers have the same.
* Commit the changes, commit message should be like "v0.2.3".
* Create an annotated git tag:
  `git tag -a v0.2.3`
* Push the tag to github: `git push origin --tags`
  The Github Actions workflow will then create a Github release and publish to npm.
