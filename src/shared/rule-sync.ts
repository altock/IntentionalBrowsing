/**
 * Serialize configuration application and retain a fingerprint only after it succeeds.
 */
export function createQueuedConfigSync<T>(
  loadConfig: () => Promise<T>,
  getFingerprint: (config: T) => string,
  applyConfig: (config: T) => Promise<void>
): () => Promise<void> {
  let queue: Promise<void> = Promise.resolve();
  let lastAppliedFingerprint = '';

  return () => {
    const sync = queue
      .catch(() => undefined)
      .then(async () => {
        const config = await loadConfig();
        const fingerprint = getFingerprint(config);
        if (fingerprint === lastAppliedFingerprint) {
          return;
        }

        await applyConfig(config);
        lastAppliedFingerprint = fingerprint;
      });

    queue = sync;
    return sync;
  };
}
