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
    // message header is two ints: id and material
    p.headerSize = p.elmSize * 2
    // elements plus type id plus material
    p.elements = p.elements > 0 ? p.elements + 2 : 0
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
    #processed = new Set()
    /** @type {number[]} */
    #primitiveData = []
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

    prepare() {
        this.#processed.clear()
        this.#primitiveData.length = 0
        this.#diff.added.length = 0
        this.#diff.removed.length = 0
    }

    processRemoved() {
        // Collect all the remvoed primitives
        for (const c of this.#current) {
            if (!this.#processed.has(c)) {
                this.#diff.removed.push(c)
            }
        }
        // Remove them from the current primitives
        for (const r of this.#diff.removed) {
            this.#current.delete(r)
        }
    }

    /**
     * @param {DataView} buffer
     * @param {number} start
     * @returns {{processed: number, offset: number}}
     */
    decode(buffer, start) {
        const { id, msgSize, elmSize, headerSize } = this.#primitive
        const added = this.#diff.added
        let processed = 0
        let offset = start
        for (; offset < buffer.byteLength; offset += msgSize) {
            const primitiveId = buffer.getInt32(offset)
            if (primitiveId !== id) {
                // Stopped decoding the contiguous primitive sequence.
                break
            }
            // Add a primitive to the processed counter
            processed++
            const key = hash.buffer(buffer, offset, offset + msgSize)
            if (this.#processed.has(key)) {
                // Primitive was sent duplicated, skip decoding
                continue
            }
            this.#processed.add(key)
            if (this.#current.has(key)) {
                // Primitive already exists in the diff, skip decoding
                continue
            }
            // Register primitive in the diff and decode
            this.#current.add(key)
            this.#primitiveData.length = 0
            const material = buffer.getInt32(offset + elmSize)
            // Skip over the header
            for (let e = headerSize; e < msgSize; e += elmSize) {
                this.#primitiveData.push(buffer.getFloat32(offset + e))
            }
            const geo = this.#geometry(key, this.#primitiveData, material)
            added.push(geo)
        }
        // Return offset that got advanced and processed primitives counter
        return { offset, processed }
    }

    constructor(
        /** @type {Primitive} */ primitive,
        /** @type {GeometryFunc} */ geometry,
    ) {
        this.#primitive = primitive
        this.#geometry = geometry
    }
}
