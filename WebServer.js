import * as responses from './responses.js'
import * as config from './config.js'

export class WebServer {
  #server /** @type {Deno.WebServer} */
  #routes = []
  #handlers = []
  constructor(port) {
    port = port ?? config.SERVER_PORT
    const stopThis = this.stop.bind(this)
    this.map('/stop', (_) => {
      stopThis()
      return responses.ok('')
    })
    this.#server = Deno.serve({ port: port }, (r) => this.#serveHttp(r))
    console.log(`Server listening on ${port}`)
  }

  mapAll(handlersByRoute) {
    for (const e of Object.entries(handlersByRoute)) {
      this.map(...e)
    }
  }

  map(route, handler) {
    this.#routes.push(new URLPattern({ pathname: route }))
    this.#handlers.push(handler)
    if (config.LOG.ROUTES) {
      console.log(`Mapped route at '${route}'`)
    }
  }
  /**
   * @param {Request} req
   * @returns {Promise<Response>}
   */
  async route(req) {
    for (let i = 0; i < this.#routes.length; i++) {
      const route = this.#routes[i]
      if (route.test(req.url)) {
        const handler = this.#handlers[i]
        let resp
        switch (handler.length) {
          case 1:
            resp = handler(req)
            break
          case 2:
            resp = handler(req, route.exec(req.url))
            break
          default:
            resp = handler()
            break
        }
        return await resp
      }
    }
    return responses.notFound(req.url)
  }

  /** @type {Deno.ServeHandler} */
  async #serveHttp(request, _info) {
    let resp
    try {
      resp = await this.route(request)
    } catch (error) {
      resp = responses.internalError(error)
    }
    if (config.LOG.REQUESTS) {
      console.log(JSON.stringify(
        {
          status: resp.status,
          url: request.url,
        },
        null,
        2,
      ))
    }
    return resp
  }

  async stop() {
    console.log(`Stopping server at ${this.#server.addr.port}...`)
    await this.#server.shutdown()
    console.log(`Server at ${this.#server.addr.port} stopped`)
  }
}
