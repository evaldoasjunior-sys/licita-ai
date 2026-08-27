export async function checkBackendAndSync(api) {
  try {
    await api.health();
    const sync = await api.flushPendingSync();

    return {
      status: "online",
      sync: sync || { synchronized: 0, failed: 0, pending: 0 },
    };
  } catch (error) {
    return {
      status: "offline",
      error,
      sync: { synchronized: 0, failed: 0, pending: api.pendingSyncCount() },
    };
  }
}
