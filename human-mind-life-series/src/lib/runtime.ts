export const REQUIRED_NODE_MAJOR = 24;

export function isSupportedNodeVersion(version = process.versions.node): boolean {
  const major = Number.parseInt(String(version ?? '').replace(/^v/, '').split('.')[0], 10);
  return Number.isFinite(major) && major >= REQUIRED_NODE_MAJOR;
}

export function getNodeVersionMessage(version = process.versions.node): string {
  return `This project requires Node.js ${REQUIRED_NODE_MAJOR} or newer. Current version: ${version}. Switch to Node ${REQUIRED_NODE_MAJOR} with "nvm use ${REQUIRED_NODE_MAJOR}" or "fnm use ${REQUIRED_NODE_MAJOR}".`;
}
