# Bundled Node.js runtime notices

The desktop bundle is assembled with the official Node.js `v24.19.0` macOS archive for its current
architecture. The build copies the archive-provided `LICENSE` file into:

`Contents/Resources/ThirdPartyNotices/Node-24.19.0-LICENSE`

That file is the authoritative license and third-party notice material distributed with the verified
Node runtime. The build is fail-closed: it verifies the architecture-specific archive SHA-256 before
extracting or bundling it.

- arm64 archive SHA-256: `8294b7aa9b03997481c06babf1e8b270c859358f27da57a11509afe537ac381d`
- x64 archive SHA-256: `d1b5e999db158c62fe8f7267a4476b035d8bd93b1a605bac24a3f0dd166e3316`

Node.js is distributed under the MIT license. Gajendra does not download or update this runtime at
application launch; runtime updates require a new reviewed bundle build and verification receipt.
