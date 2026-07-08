import postgres from 'postgres'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  const sql = postgres(url, { prepare: false })
  const [{ now }] = await sql`select now()`
  console.log('Connected. DB time:', now)
  await sql.end()
}

main().catch((err) => {
  console.error('Connection failed:', err)
  process.exit(1)
})
