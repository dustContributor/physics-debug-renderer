import { WebServer } from './WebServer.js'

import * as statics from './handlers/static.js'
import * as config from './config.js'

const server = new WebServer()

await statics.register(server, config.DEPS_PATH, config.DIABLE_STATIC_CACHE)
await statics.register(server, config.STATIC_PATH, config.DIABLE_STATIC_CACHE)
