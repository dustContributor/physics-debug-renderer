// deno-lint-ignore-file no-window no-window-prefix
import * as THREE from './deps/three.module.js'
import { OrbitControls } from './deps/OrbitControls.js'
import { enums as primitiveDiffEnums } from './PrimitiveDiff.js'

const enums = { ...primitiveDiffEnums }

export class DebugScene {
    /** @type {THREE.WebGLRenderer} */
    #renderer
    /** @type {THREE.Scene} */
    #scene
    /** @type {Array} */
    #defSceneItems
    /** @type {THREE.Mesh} */
    #defMesh
    /** @type {Function} */
    #renderFunc

    constructor($elm, materialCache) {
        const { innerHeight, innerWidth } = window
        this.#renderer = new THREE.WebGLRenderer()
        this.#renderer.setSize(innerWidth, innerHeight)
        this.#scene = new THREE.Scene()

        const camera = this.camera = new THREE.PerspectiveCamera(
            80,
            innerWidth / innerHeight,
            1,
            1000,
        )
        camera.position.set(0, 30, 0)
        camera.lookAt(0, 0, -1)
        const controls = new OrbitControls(camera, this.#renderer.domElement)
        controls.minDistance = 1
        controls.maxDistance = 5000

        this.#defMesh = new THREE.Mesh(
            new THREE.BoxGeometry(3, 5, 7),
            materialCache(enums.primitives.byName.BOX.id, 0x00FFFFFF),
        )
        const defLightTop = new THREE.DirectionalLight(0x00FFFFFF, 1.2)
        const defLightBottom = new THREE.DirectionalLight(0x00FFFFFF, 0.4)
        // Bottom light at one corner of the scene
        defLightBottom.position.set(-0.5, -0.5, -0.5)
        // Top light at the opposite corner
        defLightTop.position.set(0.5, 0.5, 0.5)
        // Default mesh/lights to add when scene is reset
        this.#defSceneItems = [this.#defMesh, defLightBottom, defLightTop]

        this.#renderFunc = (() => {
            this.#renderer.render(this.#scene, camera)
            window.requestAnimationFrame(this.#renderFunc)
        }).bind(this)

        $elm.append(this.#renderer.domElement)

        this.reset()
    }
    removeDefault() {
        this.#scene.remove(this.#defMesh)
    }
    remove(obj) {
        const removed = this.#scene.getObjectByName(obj)
        if (!removed) {
            throw new Error(`object ${obj} not found in the scene!`)
        }
        this.#scene.remove(obj)
        removed.material.dispose()
        removed.geometry.dispose()
    }
    add(obj) {
        this.#scene.add(obj)
    }
    renderLoop() {
        this.#renderFunc()
    }
    reset() {
        // Remove all children until there are none left
        while (this.#scene.children.length > 0) {
            this.#scene.remove(this.#scene.children[this.#scene.children.length - 1])
        }
        // Add the default light/meshes
        for (const def of this.#defSceneItems) {
            this.#scene.add(def)
        }
    }
    itemsInScene() {
        return this.#scene.children.length
    }
}
