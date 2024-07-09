import { App } from './app.js'
import { HashOps } from './HashOps.js'

const hash = new HashOps()

/**
 * @callback GeometryFunc
 * @param {bigint} key
 * @param {number[]} data
 * @param {number} material
 */

/**
 * @typedef {Object} Primitive
 * @property {number} id
 * @property {string} name
 * @property {number} elements
 * @property {number} headerSize
 * @property {number} elmSize
 * @property {number} msgSize
 */

const primitives = [{
    id: 0,
    name: 'UNKNOWN',
    elements: 0,
}, {
    id: 1,
    name: 'LINE',
    elements: 6,
}, {
    id: 2,
    name: 'BOX',
    elements: 9,
}, {
    id: 3,
    name: 'SPHERE',
    elements: 4,
}, {
    id: 4,
    name: 'CYLINDER',
    elements: 6,
}, {
    id: 5,
    name: 'TRIANGLE',
    elements: 9,
}].map((p) => {
    // elements are 32bit floats or ints
    p.elmSize = 4
    // message header is two ints, id and material
    p.headerSize = p.elmSize * 2
    // elements plus type id plus material
    p.elements = (p.elements + 2) * Math.min(1, p.elements)
    p.msgSize = p.elements * p.elmSize
    return Object.freeze(p)
})

/** @type {{primitives: Primitive[]}} */
export const enums = Object.freeze({
    primitives: Object.freeze(App.types.from(primitives)),
})

export class PrimitiveDiff {
    /** @type {Set.<bigint>} */
    #current = new Set()
    /** @type {Set.<bigint>} */
    #existing = new Set()
    /** @type {number[]} */
    #item = []
    /** @type {{added : number[], removed : number[]}}  */
    #diff = Object.freeze({
        added: [],
        removed: [],
    })
    /** @type {GeometryFunc} */
    #geometry = null
    /** @type {Primitive} */
    #primitive = null

    id() {
        return this.#primitive.id
    }

    name() {
        return this.#primitive.name
    }

    content() {
        return this.#diff
    }

    reset() {
        this.#existing.clear()
        this.#item.length = 0
        this.#diff.added.length = 0
        this.#diff.removed.length = 0
    }

    clear() {
        this.reset()
        this.#current.clear()
    }

    /**
     * @param {DataView} buffer
     * @param {number} start
     * @returns {number}
     */
    decode(buffer, start) {
        const { id, msgSize, elmSize } = this.#primitive
        const { added, removed } = this.#diff
        let offset = start
        for (; offset < buffer.byteLength; offset += msgSize) {
            const primitiveId = buffer.getInt32(offset)
            if (primitiveId !== id) {
                // Stopped decoding the contiguous primitive sequence.
                break
            }
            this.#item.length = 0
            // Skip over the first two elements, id and material.
            for (let e = elmSize * 2; e < msgSize; e += elmSize) {
                this.#item.push(buffer.getFloat32(offset + e))
            }
            const key = hash.buffer(buffer, offset, offset + msgSize)
            if (!this.#current.has(key) && !this.#existing.has(key)) {
                added.push(this.#geometry(key, this.#item, buffer.getInt32(offset + elmSize)))
            }
            this.#existing.add(key)
        }
        if (offset === start) {
            // Didn't process anything
            return offset
        }
        for (const key of this.#current) {
            if (!this.#existing.has(key)) {
                this.#current.delete(key)
                removed.push(key)
            }
        }
        for (const item of added) {
            this.#current.add(item.name)
        }
        // Return at which point we stopped processing.
        return offset
    }

    constructor(
        /** @type {Primitive} */ primitive,
        /** @type {GeometryFunc} */ geometry,
    ) {
        this.#primitive = primitive
        this.#geometry = geometry
    }
}
