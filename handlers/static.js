import * as utils from '../utils.js'
import * as responses from '../responses.js'
// deno-lint-ignore no-unused-vars
import { WebServer } from '../WebServer.js'

/**
 * @typedef StaticFile
 * @type {Object}
 * @property {string} logicalName
 * @property {string} physicalPath
 * @property {string} extension
 * @property {('gzip'|'utf8')} encoding
 * @property {Uint8Array} content
 * @property {string} mimeType
 * @property {boolean} isHtml
 * @property {boolean} isCompressed
 * @property {Function} read
 */

/**
 * @param {WebServer} server
 * @param {string} path
 * @param {boolean} isCacheEnabled
 */
export const register = (server, path, isCacheDisabled) => {
  const staticsPath = utils.trimSeparator(path)
  const baseDir = utils.separatorEnd(path)
  const htmlExt = '.html'
  const gzExt = '.gz'
  const mimesByExt = {
    [htmlExt]: 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
  }
  // First inspect all files in the path and inspect the ones with known extensions
  const recognizedFiles = Array.from(Deno.readDirSync(baseDir))
    .map((entry) => {
      if (!entry.isFile) {
        // No folders allowed
        return null
      }
      let name = entry.name
      const isCompressed = name.endsWith(gzExt)
      if (isCompressed) {
        name = name.slice(0, -gzExt.length)
      }
      for (const ext in mimesByExt) {
        if (!name.endsWith(ext)) {
          // Only recognize specific static resources
          continue
        }
        return {
          logicalName: name,
          physicalPath: baseDir + entry.name,
          extension: ext,
          encoding: isCompressed ? 'gzip' : 'utf8',
          mimeType: mimesByExt[ext],
          content: '',
          isHtml: ext === htmlExt,
          isCompressed,
        }
      }
      // Unrecognized extension
      return null
    })
    .filter(Boolean)
  /*
   * Now group all the files by their logical names,
   * if any is present both in uncompressed and compressed forms,
   * they will be grouped in the same entry
   */
  const filesByLogicalName = recognizedFiles.reduce((acc, file) => {
    const dst = acc[file.logicalName] ?? (acc[file.logicalName] = [])
    dst.push(file)
    return acc
  }, {})
  /*
   * For each logical group, we grab first the compressed version if any,
   * otherwise just grab the first one from the group
   */
  /** @type {Map<string, StaticFile>} */
  const filesByName = Object.values(filesByLogicalName)
    .reduce((acc, files) => {
      for (const file of files) {
        if (file.isCompressed) {
          acc.set(file.logicalName, file)
          return acc
        }
      }
      acc.set(files[0].logicalName, files[0])
      return acc
    }, new Map())

  const matchExtensions = Object.keys(mimesByExt).map((v) => '.*\\' + v).join('|')

  const logicalFileHandler = (/** @type {StaticFile} */ file) => {
    let content = file.content
    if (!content) {
      content = Deno.readFileSync(file.physicalPath)
      if (!isCacheDisabled) {
        // Cache is enabled, keep the content around in memory
        file.content = content
      }
    }
    return responses.mime({
      content,
      mimeType: file.mimeType,
      encoding: file.encoding,
    })
  }

  const index = filesByName.get('index.html')
  if (index) {
    // Map the same index file to various "default" logical routes
    const indexHandler = () => logicalFileHandler(index)
    server.map('/index.html', indexHandler)
    server.map('/index', indexHandler)
    server.map('/', indexHandler)
  }
  server.map(`/${staticsPath}/:name(${matchExtensions})`, (_, pars) => {
    const name = pars.pathname.groups.name
    const file = filesByName.get(name)
    return file ? logicalFileHandler(file) : responses.notFound(name)
  })
}
