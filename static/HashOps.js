export class HashOps {
    #prime = 0x100000001b3n
    #offset = 0xcbf29ce484222325n

    constructor() {
        // Emtpy
    }

    buffer(
        /** @type {DataView} */ buffer,
        /** @type {number} */ start,
        /** @type {number} */ limit,
    ) {
        let hash = this.#offset
        for (let s = start; s < limit; ++s) {
            hash = BigInt.asIntN(64, (hash ^ BigInt(buffer.getUint8(s))) * this.#prime)
        }
        return hash
    }
    number(
        /** @type {number} */ value,
        /** @type {bigint} */ hash,
    ) {
        hash = hash === undefined ? this.#offset : hash
        hash = BigInt.asIntN(64, (hash ^ BigInt(value)) * this.#prime)
        return hash
    }
    numbers(/** @type {...number} */ ...values) {
        let hash = this.#offset
        for (const v of values) {
            hash = number(v, hash)
        }
        return hash
    }
}
