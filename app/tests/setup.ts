import Database from 'better-sqlite3';

// better-sqlite3 v13 resolves its prebuilt binary from `prebuilds/${process.platform}-${process.arch}.node`
// on the first Database construction, then caches it. Tests that stub `process.platform` (e.g. to 'darwin')
// would otherwise make it load a binary for the wrong OS. Constructing one here pins the correct binary
// before any test file runs.
new Database(':memory:').close();
