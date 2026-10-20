export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && !process.env.ADMIN_TOKEN) {
    console.warn('Set ADMIN_TOKEN for public deployments.');
  }
}
