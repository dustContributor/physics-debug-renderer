// deno-lint-ignore-file no-window no-window-prefix
import { App } from './app.js'
import * as THREE from './deps/three.module.js'
import * as _ from './deps/underscore-1.13.6.js'
import { HashOps } from './HashOps.js'
import { enums as primitiveDiffEnums, PrimitiveDiff } from './PrimitiveDiff.js'
import { DebugScene } from './DebugScene.js'

const enums = { ...primitiveDiffEnums }

/**
 * @typedef {import('./PrimitiveDiff.js').GeometryFunc} GeometryFunc
 * @typedef {import('./PrimitiveDiff.js').Primitive} Primitive
 */

/**
 * @callback MaterialForFunc
 * @param {number} typeId
 * @param {number} color
 */
/** @type {MaterialForFunc} */
const materialFor = (() => {
  const materialsByColor = new Map()
  const hash = new HashOps()
  const LINE = enums.primitives.byName.LINE
  return (typeId, color) => {
    if (!_.isNumber(color)) {
      throw 'Invalid color material: ' + JSON.stringify(color)
    }
    const key = hash.number(color, hash.number(typeId))
    let material = materialsByColor.get(key)
    if (!material) {
      materialsByColor.set(
        key,
        material = typeId === LINE.id
          ? new THREE.MeshBasicMaterial({
            color: color,
          })
          : new THREE.MeshLambertMaterial({
            color: color,
            shading: THREE.FlatShading,
            //     wireframe: true,
            wireframeLinewidth: 2.5,
            depthTest: true,
            depthWrite: true,
          }),
      )
    }
    return material
  }
})()

App.views.define(() => {
  const { LINE, BOX, TRIANGLE, SPHERE } = enums.primitives.byName
  /** @type {Object.<number, GeometryFunc>} */
  const geometriesByType = {
    [LINE.id]: (key, data, material) => {
      const geometry = new THREE.BufferGeometry()
      const vertices = new Float32Array([
        data[0],
        data[1],
        data[2],
        data[3],
        data[4],
        data[5],
      ])
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
      const obj = new THREE.LineSegments(
        geometry,
        materialFor(LINE.id, material),
      )
      obj.name = key
      return obj
    },
    [BOX.id]: (key, data, material) => {
      const geometry = new THREE.BoxGeometry(data[6], data[7], data[8])
      const obj = new THREE.Mesh(
        geometry,
        materialFor(BOX.id, material),
      )
      obj.name = key
      obj.rotation.set(data[3], data[4], data[5], 'ZYX')
      obj.position.set(data[0], data[1], data[2])
      return obj
    },
    [TRIANGLE.id]: (key, data, material) => {
      const geometry = new THREE.BufferGeometry()
      geometry.vertices.push(new THREE.Vector3(data[0], data[1], data[2]))
      geometry.vertices.push(new THREE.Vector3(data[3], data[4], data[5]))
      geometry.vertices.push(new THREE.Vector3(data[6], data[7], data[8]))
      const obj = new THREE.Mesh(
        geometry,
        materialFor(TRIANGLE.id, material),
      )
      obj.name = key
      return obj
    },
    [SPHERE.id]: (key, data, material) => {
      const geometry = new THREE.SphereGeometry(data[3], 5, 5)
      const obj = new THREE.Mesh(
        geometry,
        materialFor(SPHERE.id, material),
      )
      obj.position.set(data[0], data[1], data[2])
      obj.name = key
      return obj
    },
  }

  const render = (pars) => {
    const $els = App.utils.selectors.fromIds(pars)

    const intervalVal = () => Number.parseInt($els.polling.interval.value)
    const frameCountVal = () => {
      const v = Number.parseInt($els.status.frame.innerText)
      return Number.isNaN(v) ? 0 : v
    }

    $els.polling.interval.value = 1000
    $els.polling.port.value = 10001

    const debugScene = new DebugScene($els.window, materialFor)
    /** @returns {Object.<string, PrimitiveDiff>} */
    const makeDiffsById = () =>
      enums.primitives.slice(1).reduce((m, v) => {
        m[v.id] = new PrimitiveDiff(v, geometriesByType[v.id])
        return m
      }, {})

    const polling = (socket) => {
      const poll = _.throttle(() => {
        if (socket.readyState == WebSocket.OPEN) {
          window.requestAnimationFrame(poll)
          socket.send('POLL')
        }
      }, intervalVal())
      return poll
    }

    const elmHide = (e) => e.classList.add('app-hide')
    const elmShow = (e) => e.classList.remove('app-hide')

    const socketMessage = (/** @type {Object.<string, PrimitiveDiff>} */ diffsById) => async (e) => {
      let timingTstamp = performance.now()
      const arrayBuffer = await e.data.arrayBuffer()
      const buffer = new DataView(arrayBuffer)
      let processedCount = 0
      for (let offset = 0; offset < buffer.byteLength;) {
        const primitiveId = buffer.getInt32(offset)
        const diff = diffsById[primitiveId]
        if (!diff) {
          throw new Error(`primitive id ${primitiveId} is invalid!`)
        }
        const res = diff.decode(buffer, offset)
        offset = res.offset
        processedCount += res.processed
      }
      $els.status.decodingms.innerText = performance.now() - timingTstamp

      timingTstamp = performance.now()
      const diffs = Object.values(diffsById)
      for (const diff of diffs) {
        diff.processRemoved()
      }

      let removedCount = 0
      let addedCount = 0
      for (const diff of diffs) {
        for (const r of diff.content().removed) {
          debugScene.remove(r)
          removedCount++
        }
      }
      for (const diff of diffs) {
        for (const a of diff.content().added) {
          debugScene.add(a)
          addedCount++
        }
      }
      for (const diff of diffs) {
        diff.prepare()
      }
      $els.status.diffingms.innerText = performance.now() - timingTstamp
      $els.status.removed.innerText = removedCount
      $els.status.added.innerText = addedCount
      $els.status.processed.innerText = processedCount
      $els.status.current.innerText = debugScene.itemsInScene()
      let frameCount = frameCountVal() + 1
      if (frameCount > 999999) {
        frameCount = 0
      }
      $els.status.frame.innerText = frameCount
    }

    const socketOpen = (socket) => () => {
      const { start, stop, status } = $els.polling
      elmHide(start)
      status.innerText = 'CONNECTED'
      debugScene.removeDefault()
      const beginPolling = polling(socket)
      window.setTimeout(() => {
        beginPolling()
      }, intervalVal())
      stop.addEventListener('click', (e) => {
        socket.close(1000, 'stopped')
        e.target.removeEventListener('click', this)
        elmHide(stop)
        elmShow(start)
      })
      elmShow(stop)
    }

    const socketClose = (_) => () => {
      debugScene.reset()
      $els.polling.status.innerText = 'DISCONNECTED'
      Object.values($els.status).forEach((e) => e.innerText = 0)
      elmHide($els.polling.stop)
      elmShow($els.polling.start)
    }

    const socketError = (_) => () => {
      $els.polling.status.innerText = 'ERROR'
    }

    debugScene.renderLoop()

    $els.polling.start.addEventListener('click', () => {
      const socket = new WebSocket(`ws://localhost:${$els.polling.port.value}`)
      const diffsById = makeDiffsById()
      socket.onopen = socketOpen(socket)
      socket.onclose = socketClose(socket)
      socket.onerror = socketError(socket)
      socket.onmessage = socketMessage(diffsById)
      return socket
    })
  }
  return {
    index: {
      render,
    },
  }
}, 'index')
