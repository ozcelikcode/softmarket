export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.SM_DB_QUERY_LOG === '1') {
    const { installDbRequestLogging } = await import('./lib/db-query-log')
    installDbRequestLogging()
  }
}
