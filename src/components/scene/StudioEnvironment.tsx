import { createPortal, useFrame, useThree } from '@react-three/fiber'
import { Lightformer } from '@react-three/drei'
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CubeCamera, HalfFloatType, Scene, WebGLCubeRenderTarget } from 'three'

// This exhibit needs one static studio capture, without HDR/EXR/gain-map loaders.
// Keep the same seven emitters, half-float cubemap, resolution and clip planes.
export const StudioEnvironment = memo(function StudioEnvironment() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const captured = useRef(false)
  const [studio] = useState(() => {
    const target = new WebGLCubeRenderTarget(1024)
    target.texture.type = HalfFloatType
    return { scene: new Scene(), target, camera: new CubeCamera(0.1, 20, target) }
  })
  useLayoutEffect(() => {
    const previous = scene.environment
    scene.environment = studio.target.texture
    return () => {
      scene.environment = previous
    }
  }, [scene, studio])
  useEffect(() => () => studio.target.dispose(), [studio])
  useFrame(() => {
    if (captured.current) return
    const autoClear = gl.autoClear
    gl.autoClear = true
    studio.camera.update(gl, studio.scene)
    gl.autoClear = autoClear
    captured.current = true
  })
  return createPortal(
    <>
      <Lightformer
        form="rect"
        intensity={4.5}
        position={[-1, 0.8, 4]}
        target={[0, 0, 0]}
        scale={[0.55, 5, 1]}
      />
      <Lightformer
        form="rect"
        intensity={1.1}
        position={[2.7, 1, 3]}
        target={[0, 0, 0]}
        scale={[2, 4, 1]}
      />
      <Lightformer
        form="rect"
        intensity={0.35}
        position={[0, 0.5, 5]}
        target={[0, 0, 0]}
        scale={[8, 8, 1]}
      />
      <Lightformer
        form="rect"
        intensity={3}
        position={[1.8, 1.3, -4]}
        target={[0, 0, 0]}
        scale={[1.5, 5, 1]}
      />
      <Lightformer
        form="rect"
        intensity={1.1}
        position={[-2, 0.7, -3]}
        target={[0, 0, 0]}
        scale={[1.3, 4, 1]}
      />
      <Lightformer
        form="rect"
        intensity={0.38}
        position={[0, 0.4, -5]}
        target={[0, 0, 0]}
        scale={[8, 8, 1]}
      />
      <Lightformer
        form="rect"
        intensity={2}
        position={[0, 4, 0]}
        target={[0, 0, 0]}
        scale={[5, 3, 1]}
      />
      <primitive object={studio.camera} />
    </>,
    studio.scene,
  )
})
