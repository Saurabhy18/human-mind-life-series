const REQUIRED_NODE_MAJOR = 24;
const version = process.versions.node;
const major = Number.parseInt(String(version ?? '').replace(/^v/, '').split('.')[0], 10);

if (!Number.isFinite(major) || major < REQUIRED_NODE_MAJOR) {
  console.error(
    `This project requires Node.js ${REQUIRED_NODE_MAJOR} or newer. Current version: ${version}. Switch to Node ${REQUIRED_NODE_MAJOR} with "nvm use ${REQUIRED_NODE_MAJOR}" or "fnm use ${REQUIRED_NODE_MAJOR}".`,
  );
  process.exit(1);
}
