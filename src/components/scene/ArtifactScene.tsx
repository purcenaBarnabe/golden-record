import { memo, Suspense, useEffect, useLayoutEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls, SoftShadows } from '@react-three/drei'
import { ACESFilmicToneMapping, MathUtils, MOUSE, PCFSoftShadowMap, TOUCH, Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { CoverModel, AudioRecordModel } from './RecordModel'
import { Annotations } from './Annotations'
import { RecordAnnotation } from './RecordAnnotation'
import { Pedestal } from './Pedestal'
import { useExhibitStore } from '../../stores/use-exhibit-store'
import { ARTIFACT_CENTER_Y, COVER_FACE_Z, RECORD_THICKNESS } from '../../lib/artifact-dimensions'
import { artworkPosition, inscriptions } from '../../lib/inscriptions'
import { MAX_ZOOM, MIN_ZOOM, SURFACE_FOCUS } from '../../lib/inspection'
import { COVER_RADIUS } from './RecordModel'
import { useMobileControls } from '../../hooks/use-mobile-controls'

const INITIAL_CAMERA = new Vector3(0.245, 0.18, 1.1)
const INITIAL_DISTANCE = INITIAL_CAMERA.length()
const ORBIT_MOUSE_BUTTONS = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }
const DRAG_MOUSE_BUTTONS = { LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }
const ORBIT_TOUCHES = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }
const DRAG_TOUCHES = { ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_PAN }

const StudioEnvironment = memo(function StudioEnvironment() {
  return (
    <Environment resolution={1024} frames={2} near={0.1} far={20}>
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
    </Environment>
  )
})

function SceneContent({ onReady }: { onReady: () => void }) {
  const controls = useRef<OrbitControlsImpl>(null)
  const theme = useExhibitStore((s) => s.theme)
  const lighting = useExhibitStore((s) => s.lighting)
  const panelOpen = useExhibitStore((s) => s.panel !== null || s.selected !== null)
  const revision = useExhibitStore((s) => s.viewRevision)
  const zoomRevision = useExhibitStore((s) => s.zoomRevision)
  const zoom = useExhibitStore((s) => s.zoom)
  const artifact = useExhibitStore((s) => s.artifact)
  const mobileNavigationMode = useExhibitStore((s) => s.mobileNavigationMode)
  const mobile = useMobileControls()
  const dragMode = mobile && mobileNavigationMode === 'drag'
  const { camera, invalidate } = useThree()
  const fit = useThree((s) => Math.max(1, 0.72 / (s.size.width / s.size.height)))
  const target = useRef(INITIAL_CAMERA.clone())
  const targetPivot = useRef(new Vector3())
  const moving = useRef(false)
  const manual = useRef(false)
  const desired = useRef(new Vector3()).current
  const position = useRef(new Vector3()).current
  const reducedMotion = useRef(false)
  const previousFit = useRef<number | null>(null)
  const direction = useRef(new Vector3()).current
  const dark = theme === 'dark'
  useLayoutEffect(() => {
    if (previousFit.current === null) {
      controls.current?.target.set(0, 0, 0)
      camera.position.copy(INITIAL_CAMERA).multiplyScalar(fit / useExhibitStore.getState().zoom)
      if (useExhibitStore.getState().view === 'back') {
        camera.position.x *= -1
        camera.position.z *= -1
      }
      camera.lookAt(0, 0, 0)
    } else {
      // Resizing a reading rail must retain the inspected point and zoom.
      const pivot = controls.current?.target ?? targetPivot.current
      const ratio = fit / previousFit.current
      camera.position.sub(pivot).multiplyScalar(ratio).add(pivot)
      target.current.sub(targetPivot.current).multiplyScalar(ratio).add(targetPivot.current)
    }
    previousFit.current = fit
    controls.current?.update()
    invalidate()
  }, [fit, camera, invalidate])

  useEffect(() => {
    controls.current?.target.set(0, 0, 0)
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotion = () => {
      reducedMotion.current = media.matches
    }
    updateMotion()
    media.addEventListener('change', updateMotion)
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(onReady)
    })
    return () => {
      cancelAnimationFrame(frame)
      media.removeEventListener('change', updateMotion)
    }
  }, [onReady])
  useEffect(() => {
    manual.current = false
    const state = useExhibitStore.getState()
    const item = inscriptions.find((item) => item.id === state.focus)
    if (state.focus && state.focus in SURFACE_FOCUS) {
      const point = SURFACE_FOCUS[state.focus as keyof typeof SURFACE_FOCUS]
      targetPivot.current.set(point[0], point[1], point[2])
    } else if (item) {
      const point = artworkPosition(item.point, COVER_RADIUS)
      targetPivot.current.set(point[0], point[1] + ARTIFACT_CENTER_Y, COVER_FACE_Z)
    } else targetPivot.current.set(0, 0, 0)
    target.current.copy(INITIAL_CAMERA).multiplyScalar(fit / state.zoom)
    if (state.view === 'back') {
      target.current.x *= -1
      target.current.z *= -1
    }
    target.current.add(targetPivot.current)
    moving.current = true
    invalidate()
  }, [revision, invalidate])
  useEffect(() => {
    manual.current = false
    const pivot = controls.current?.target ?? new Vector3()
    targetPivot.current.copy(pivot)
    const state = useExhibitStore.getState()
    if (pivot.lengthSq() < 0.000001 && state.zoom > 1)
      targetPivot.current.set(
        0,
        ARTIFACT_CENTER_Y,
        state.artifact === 'cover' ? COVER_FACE_Z : -RECORD_THICKNESS / 2,
      )
    if (state.zoom > 4) {
      camera.getWorldDirection(direction)
      const z = state.artifact === 'cover' ? COVER_FACE_Z : -RECORD_THICKNESS / 2
      const distance = (z - camera.position.z) / direction.z
      if (Math.abs(direction.z) > 0.1 && distance > 0 && distance < 2)
        targetPivot.current.copy(camera.position).addScaledVector(direction, distance)
    }
    target.current
      .copy(camera.position)
      .sub(pivot)
      .normalize()
      .multiplyScalar((INITIAL_DISTANCE * fit) / useExhibitStore.getState().zoom)
      .add(targetPivot.current)
    moving.current = true
    invalidate()
  }, [zoomRevision, camera, invalidate])
  useFrame((_, delta) => {
    const distance = camera.position.distanceTo(controls.current?.target ?? targetPivot.current)
    const near = Math.max(0.00003, Math.min(0.002, distance * 0.015))
    if (Math.abs(camera.near - near) > 0.000001) {
      camera.near = near
      camera.updateProjectionMatrix()
    }
    if (!moving.current) {
      if (manual.current && Math.abs(camera.position.z) > 0.005)
        useExhibitStore.getState().syncArtifact(camera.position.z < 0 ? 'record' : 'cover')
      return
    }
    const pivot = controls.current?.target ?? new Vector3()
    desired.copy(target.current).sub(targetPivot.current)
    position.copy(camera.position).sub(pivot)
    const damp = (a: number, b: number) =>
      reducedMotion.current ? b : MathUtils.damp(a, b, 6, delta)
    const radius = damp(position.length(), desired.length())
    const angle = Math.atan2(position.x, position.z)
    let desiredAngle = Math.atan2(desired.x, desired.z)
    if (desiredAngle - angle > Math.PI) desiredAngle -= Math.PI * 2
    if (desiredAngle - angle < -Math.PI) desiredAngle += Math.PI * 2
    const nextAngle = damp(angle, desiredAngle),
      y = damp(position.y, desired.y)
    const horizontal = Math.sqrt(Math.max(0.000000001, radius * radius - y * y))
    position.set(Math.sin(nextAngle) * horizontal, y, Math.cos(nextAngle) * horizontal)
    pivot.set(
      damp(pivot.x, targetPivot.current.x),
      damp(pivot.y, targetPivot.current.y),
      damp(pivot.z, targetPivot.current.z),
    )
    camera.position.copy(position).add(pivot)
    controls.current?.update()
    if (position.distanceTo(desired) < 0.00001 && pivot.distanceTo(targetPivot.current) < 0.00001)
      moving.current = false
    invalidate()
  })
  return (
    <>
      <color attach="background" args={[dark ? '#000000' : '#ffffff']} />
      <SoftShadows size={12} samples={24} focus={0.4} />
      <ambientLight intensity={dark ? 0.19 : 0.65} />
      <directionalLight
        position={[-0.7, 1.3, 0.8]}
        intensity={lighting === 'gallery' ? 2.8 : 0.4}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-0.55}
        shadow-camera-right={0.55}
        shadow-camera-top={0.55}
        shadow-camera-bottom={-0.55}
        shadow-camera-near={0.1}
        shadow-camera-far={4}
        shadow-bias={-0.00004}
        shadow-normalBias={0.0004}
      />
      <directionalLight
        position={[artifact === 'record' ? -0.7 : 0.7, 0.4, artifact === 'record' ? -0.035 : 0.035]}
        intensity={lighting === 'raking' ? 4 : 0.4}
      />
      <directionalLight
        position={[-0.4, 0.5, -0.8]}
        intensity={lighting === 'raking' ? 0.25 : 1.6}
      />
      <StudioEnvironment />
      <group position={[0, ARTIFACT_CENTER_Y, 0]}>
        <CoverModel />
        <AudioRecordModel />
        <Annotations />
        <RecordAnnotation />
      </group>
      <Pedestal dark={dark} />
      <OrbitControls
        ref={controls}
        makeDefault
        enabled={!panelOpen}
        enableRotate={!dragMode}
        enablePan
        mouseButtons={dragMode ? DRAG_MOUSE_BUTTONS : ORBIT_MOUSE_BUTTONS}
        touches={dragMode ? DRAG_TOUCHES : ORBIT_TOUCHES}
        screenSpacePanning
        zoomToCursor
        panSpeed={0.6}
        minDistance={(INITIAL_DISTANCE * fit) / MAX_ZOOM}
        maxDistance={(INITIAL_DISTANCE * fit) / MIN_ZOOM}
        minPolarAngle={Math.PI * 0.17}
        maxPolarAngle={Math.PI * 0.51}
        minAzimuthAngle={zoom > 8 ? (artifact === 'record' ? Math.PI : 0) - 1.35 : -Infinity}
        maxAzimuthAngle={zoom > 8 ? (artifact === 'record' ? Math.PI : 0) + 1.35 : Infinity}
        enableDamping
        dampingFactor={0.09}
        rotateSpeed={0.45}
        zoomSpeed={1.2}
        onStart={() => {
          moving.current = false
          manual.current = true
          useExhibitStore.getState().interactWithView()
        }}
        onEnd={() =>
          useExhibitStore
            .getState()
            .syncZoom(
              (INITIAL_DISTANCE * fit) /
                camera.position.distanceTo(controls.current?.target ?? new Vector3()),
            )
        }
      />
    </>
  )
}

function ContextGuard({ onUnavailable }: { onUnavailable: () => void }) {
  const canvas = useThree((s) => s.gl.domElement)
  useEffect(() => {
    const lost = (event: Event) => {
      event.preventDefault()
      onUnavailable()
    }
    canvas.addEventListener('webglcontextlost', lost)
    return () => canvas.removeEventListener('webglcontextlost', lost)
  }, [canvas, onUnavailable])
  return null
}

export function ArtifactScene({
  onReady,
  onUnavailable,
}: {
  onReady: () => void
  onUnavailable: () => void
}) {
  return (
    <Canvas
      className="artifact-canvas"
      frameloop="demand"
      dpr={[1, 2]}
      shadows
      camera={{ position: INITIAL_CAMERA.toArray(), fov: 33, near: 0.002, far: 30 }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
        toneMapping: ACESFilmicToneMapping,
        toneMappingExposure: 0.95,
      }}
      onCreated={({ gl }) => {
        gl.shadowMap.type = PCFSoftShadowMap
        gl.setClearAlpha(0)
      }}
    >
      <ContextGuard onUnavailable={onUnavailable} />
      <Suspense fallback={null}>
        <SceneContent onReady={onReady} />
      </Suspense>
    </Canvas>
  )
}
