// Each boundary is awaited so Stop can invalidate a pending start before it sends a slew command.
export async function startAutomaticAlignment({ verify, select, enable, send, stop, isCancelled }) {
  let mayBeArmed = false;
  const check = () => {
    if (isCancelled()) throw new Error('Start cancelled by Stop.');
  };
  try {
    const message = await verify();
    check();
    await select();
    check();
    mayBeArmed = true;
    await enable();
    check();
    if ((await send(message)) === false) throw new Error('TPPA start could not be sent.');
  } catch (error) {
    if (mayBeArmed) {
      try {
        await stop();
      } catch {
        throw new Error(
          `${error.message} Controller shutdown could not be confirmed; use Stop and inspect the device status.`
        );
      }
    }
    throw error;
  }
}
