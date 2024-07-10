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
        const prime = this.#prime
        let hash = this.#offset
        let i = start
        // Hash chunks of 8 bytes
        for (; i < limit; i += 8) {
            if (i + 8 > limit) {
                break
            }
            const v = buffer.getBigUint64(i)
            hash = BigInt.asIntN(64, (hash ^ v) * prime)
        }
        if (i === limit) {
            // 8 byte aligned, nothing else to do
            return hash
        }
        // Try chunks of 4 bytes
        for (i = i - 8; i < limit; i += 4) {
            if (i + 4 > limit) {
                break
            }
            const v = BigInt(buffer.getUint32(i))
            hash = BigInt.asIntN(64, (hash ^ v) * prime)
        }
        if (i === limit) {
            // 4 byte aligned, nothing else to do
            return hash
        }
        // Hash any remaining bytes individually
        for (i = i - 4; i < limit; i++) {
            const v = BigInt(buffer.getUint8(i))
            hash = BigInt.asIntN(64, (hash ^ v) * prime)
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
