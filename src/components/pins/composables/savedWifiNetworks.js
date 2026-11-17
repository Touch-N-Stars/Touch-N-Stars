export function savedNetworkSettings(network) {
  const priority = network.editedPriority;
  if (!Number.isInteger(priority) || priority < -999 || priority > 999) {
    throw new RangeError('invalidPriority');
  }
  return { priority, auto_connect: Boolean(network.editedAutoConnect) };
}

export async function waitForSavedNetworkJob(job, getJob, { delay, cancelled = () => false } = {}) {
  if (!job?.jobId) throw new Error('missingJob');
  const pause = delay || (() => new Promise((resolve) => setTimeout(resolve, 1000)));
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (cancelled()) throw new Error('cancelled');
    const result = await getJob(job.jobId);
    if (result.status === 'failed') throw new Error(result.errorMessage || 'operationFailed');
    if (result.status === 'success') return result;
    await pause();
  }
  throw new Error('operationTimedOut');
}
