/**
 * Diagnostics for the UCP leg, with no Claude in the way.
 *
 *   npm run probe                      -- handshake + tool list
 *   npm run probe -- "linen shirt"     -- run a real search through our tool
 */
import { initialize, listTools } from '../src/ucp/client.js'
import { searchCatalog } from '../src/tools/catalog.js'
import { catalogConfig } from '../src/config/catalog.config.js'
import { env } from '../src/config/env.js'

const query = process.argv.slice(2).join(' ')

console.log(`endpoint : ${env.ucpEndpoint}`)
console.log(`profile  : ${env.agentProfileUrl}\n`)

const info = await initialize()
console.log(`server   : ${info.serverInfo.name} v${info.serverInfo.version}`)
console.log(`protocol : ${info.protocolVersion}\n`)

const { tools } = await listTools()
console.log(`${tools.length} tools exposed:`)
console.log(tools.map((tool) => `  - ${tool.name}`).join('\n'))

if (!query) {
  console.log('\nPass a query to run a search, e.g. npm run probe -- "linen shirt"')
  process.exit(0)
}

console.log(`\nsearching for "${query}" ...`)
console.log(`sort=${catalogConfig.search.sort} availableOnly=${catalogConfig.search.availableOnly} limit=${catalogConfig.search.resultLimit}\n`)

const { forModel } = await searchCatalog({ query })

for (const product of forModel.products) {
  const stock = product.available ? '' : ' [unavailable]'
  console.log(`  ${product.price}  ${product.title}${stock}`)
}

console.log(
  `\nreturned ${forModel.returned} of ${forModel.matched_before_limit} matches` +
    `${forModel.has_more ? ' (more pages available)' : ''}`,
)
if (forModel.warnings.length > 0) {
  console.log('warnings:', forModel.warnings)
}
