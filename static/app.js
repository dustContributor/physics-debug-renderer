import * as _ from './deps/underscore-1.13.6.js'

export const App = (() => {
  const contentTypeJson = 'application/json;charset=UTF-8'
  const contentTypeForm = 'application/x-www-form-urlencoded;charset=UTF-8'

  const views = {}
  Object.defineProperty(views, 'define', {
    writable: false,
    value: (definition, ...args) => {
      if (!(_.isFunction(definition))) {
        throw 'Definition must be a function!'
      }
      if (App.utils.existsIn(views, args)) {
        return
      }
      return Object.assign(views, definition())
    },
  })

  const types = {}
  Object.defineProperty(types, 'from', {
    writable: false,
    value: (items) => {
      const byId = {}
      const byName = {}
      for (const item of items) {
        byId[item.id] = item
        byName[item.name] = item
      }
      items.byId = byId
      items.byName = byName
      return items
    },
  })
  Object.defineProperty(types, 'define', {
    writable: false,
    value: (name, items) => {
      App.types[name] = App.types.from(items)
    },
  })
  Object.defineProperty(types, 'fetch', {
    writable: false,
    value: async (name, url) => {
      if (!name || !url) {
        throw 'name and url are needed!'
      }
      const r = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': contentTypeJson,
        },
      })
      const data = await r.json()
      return App.types.define(name, data)
    },
  })

  const deepFreeze = (v) => {
    switch (typeof v) {
      case 'object':
        for (const k in v) {
          v[k] = deepFreeze(v[k])
        }
        break
      case 'array':
        for (let i = 0; i < v.length; ++i) {
          v[i] = deepFreeze(v[i])
        }
        break
    }
    return Object.freeze(v)
  }

  const utils = {
    deepFreeze,
    ajax: {
      contentTypes: {
        json: contentTypeJson,
        form: contentTypeForm,
      },
    },
    formats: {
      date: 'dd/MM/yyyy',
      timeStamp: 'HH:mm:ss',
      full: 'yyyyMMddHHmmss',
    },
    selectors: {
      fromIds: (selectors) => {
        // We will be catching all properties ending with "Id"
        const suffix = 'Id'
        const dest = {}
        // Will skip if selectors are empty or null.
        for (const [name, id] of Object.entries(selectors || dest)) {
          if (_.isObject(id)) {
            // Value is an object, try to select its properties.
            dest[name] = App.utils.selectors.fromIds(id)
            continue
          }
          if (!_.isString(id) || !name.endsWith(suffix)) {
            // Value is a function or some other string.
            continue
          }
          const element = document.getElementById(id)
          if (!element) {
            // Value is as expected, but no such element exists.
            continue
          }
          // Store and name it properly without the suffix.
          const elementName = name.substring(0, name.length - suffix.length)
          dest[elementName] = element
        }
        return dest
      },
    },
    existsIn: (src, ...args) => {
      for (let i = 0; i < args.length; ++i) {
        // deno-lint-ignore no-prototype-builtins
        if (!src || !src.hasOwnProperty(args[i])) {
          return false
        }
        src = src[args[i]]
      }
      return true
    },
  }

  return Object.freeze({
    utils: deepFreeze(utils),
    types,
    views,
  })
})()
