import { useEffect, useMemo, useRef } from 'react'
import { useTexture } from '@react-three/drei'
import { Matrix4, SRGBColorSpace, Vector2, type Group, type Texture } from 'three'
import { useLoader, useThree, type ThreeEvent } from '@react-three/fiber'
import { useExhibitStore } from '../../stores/use-exhibit-store'
import { EngravedCoverLoader } from '../../lib/cover-loader'
import { COVER_RELIEF_URL, RECORD_TEXTURE_URLS } from '../../lib/exhibit-assets'
import { onDisc } from '../../lib/surface-picking'
import { createMetalMaterial } from '../../lib/metal-finish'
import { AUTO_HOVER_MAX_ZOOM } from '../../lib/inspection'
import { EngravingPicker } from '../../lib/engraving-picking'
import { inscriptions } from '../../lib/inscriptions'
import { useProjectedSubject } from './use-projected-subject'
import { useTouchTap } from './use-touch-tap'
import {
  BOND_THICKNESS,
  COPPER_LAYER_THICKNESS,
  COVER_FACE_Z,
  COVER_RADIUS,
  RECORD_RADIUS,
  RECORD_THICKNESS,
  SPINDLE_RADIUS,
} from '../../lib/artifact-dimensions'

export { COVER_RADIUS, RECORD_RADIUS } from '../../lib/artifact-dimensions'

function finishTexture(texture: Texture, color = false) {
  texture.anisotropy = 16
  if (color) texture.colorSpace = SRGBColorSpace
  return texture
}

function Edge({
  radius,
  depth,
  z,
  color = '#edbd63',
  bevel = 0.000045,
}: {
  radius: number
  depth: number
  z: number
  color?: string
  bevel?: number
}) {
  const profile = useMemo(
    () => [
      new Vector2(radius - bevel, -depth / 2),
      new Vector2(radius, -depth / 2 + bevel),
      new Vector2(radius, depth / 2 - bevel),
      new Vector2(radius - bevel, depth / 2),
    ],
    [radius, depth, bevel],
  )
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, z]} castShadow receiveShadow>
      <latheGeometry args={[profile, 1536]} />
      <meshPhysicalMaterial color={color} metalness={1} roughness={0.24} />
    </mesh>
  )
}

export function CoverModel() {
  const touch = useTouchTap()
  const root = useRef<Group>(null)
  const project = useProjectedSubject(root, COVER_RADIUS, COVER_FACE_Z)
  const relief = useLoader(EngravedCoverLoader, COVER_RELIEF_URL)
  const picker = useMemo(() => new EngravingPicker(relief), [relief])
  const clip = useMemo(() => new Matrix4(), [])
  const cutOffset = useMemo(() => new Matrix4().makeTranslation(0, 0, -0.000001), [])
  const size = useThree((s) => s.size)
  const face = useMemo(
    () =>
      createMetalMaterial({
        color: '#efc777',
        metalness: 1,
        roughness: 0.215,
        anisotropy: 0.3,
        anisotropyRotation: -0.62,
      }),
    [],
  )
  const bevel = useMemo(
    () => createMetalMaterial({ color: '#d3a452', metalness: 1, roughness: 0.28 }),
    [],
  )
  const floor = useMemo(
    () => createMetalMaterial({ color: '#8f6e36', metalness: 1, roughness: 0.62 }),
    [],
  )
  // R3F does not dispose objects attached through <primitive>.
  useEffect(
    () => () => {
      face.dispose()
      bevel.dispose()
      floor.dispose()
    },
    [face, bevel, floor],
  )
  const setHovered = useExhibitStore((s) => s.setHovered)
  const setSelected = useExhibitStore((s) => s.setSelected)
  const pick = (event: ThreeEvent<PointerEvent | MouseEvent>) => {
    if (!event.uv || !onDisc(event.uv.x, event.uv.y, COVER_RADIUS)) return null
    clip
      .multiplyMatrices(event.camera.projectionMatrix, event.camera.matrixWorldInverse)
      .multiply(event.object.matrixWorld)
      .multiply(cutOffset)
    return picker.pick(clip, event.pointer, size)
  }
  const inspect = (event: ThreeEvent<PointerEvent>) => {
    if ((event.nativeEvent.target as HTMLElement)?.closest?.('.annotation')) return
    if (
      event.pointerType === 'touch' ||
      event.buttons !== 0 ||
      useExhibitStore.getState().selected ||
      useExhibitStore.getState().zoom > AUTO_HOVER_MAX_ZOOM ||
      !event.uv
    )
      return
    let id = pick(event)
    const active = useExhibitStore.getState().hovered
    if (!id && active && active !== 'music' && onDisc(event.uv.x, event.uv.y, COVER_RADIUS)) {
      // Once a figure is active, its gaps and a small screen-space margin keep
      // the same card open. A direct hit on another engraving still switches it.
      const item = inscriptions.find((item) => item.id === active)!
      const region = project(item.bounds).subject
      const { clientX: x, clientY: y } = event.nativeEvent
      const margin = 10
      if (
        region &&
        x >= region.x - margin &&
        x <= region.x + region.width + margin &&
        y >= region.y - margin &&
        y <= region.y + region.height + margin
      )
        id = active
    }
    setHovered(
      id,
      id
        ? {
            x: event.nativeEvent.clientX,
            y: event.nativeEvent.clientY,
            artwork: [event.uv.x, 1 - event.uv.y],
          }
        : undefined,
    )
  }
  return (
    <group ref={root}>
      <Edge radius={COVER_RADIUS} depth={0.0006} z={COVER_FACE_Z - 0.0003} />
      <mesh
        position={[0, 0, COVER_FACE_Z + 0.000001]}
        onPointerMove={inspect}
        onPointerOut={() => setHovered(null)}
        onPointerUp={(e) => {
          if (!touch.consumeTouchTap(e.nativeEvent)) return
          const id = pick(e)
          if (id) {
            e.stopPropagation()
            setSelected(id)
          }
        }}
        onClick={(e) => {
          if (touch.isTouchClick()) return
          if (e.delta > 5 || !e.uv) return
          if (!onDisc(e.uv.x, e.uv.y, COVER_RADIUS)) return
          const id = pick(e)
          if (id) {
            e.stopPropagation()
            setSelected(id)
          }
        }}
      >
        {/* The plane supplies a ray/UV; a BVH then checks only nearby cut geometry. */}
        <planeGeometry args={[COVER_RADIUS * 2, COVER_RADIUS * 2]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      <group position={[0, 0, COVER_FACE_Z]}>
        <mesh geometry={relief.face} castShadow receiveShadow>
          <primitive object={face} attach="material" />
        </mesh>
        <mesh geometry={relief.bevel} castShadow receiveShadow>
          <primitive object={bevel} attach="material" />
        </mesh>
        <mesh geometry={relief.floor} receiveShadow>
          <primitive object={floor} attach="material" />
        </mesh>
      </group>
      {/* The cover is a separate thin protective part, ahead of the actual disc. */}
      <mesh
        position={[0, 0, COVER_FACE_Z - 0.0006]}
        rotation={[0, Math.PI, 0]}
        castShadow
        receiveShadow
      >
        <ringGeometry args={[SPINDLE_RADIUS, COVER_RADIUS - 0.00004, 1536]} />
        <meshPhysicalMaterial color="#e7bc70" metalness={1} roughness={0.32} />
      </mesh>
      <mesh position={[0, 0, COVER_FACE_Z - 0.0003]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[SPINDLE_RADIUS, SPINDLE_RADIUS, 0.0006, 128, 1, true]} />
        <meshStandardMaterial color="#cba666" metalness={1} roughness={0.24} />
      </mesh>
    </group>
  )
}

export function AudioRecordModel() {
  const touch = useTouchTap()
  const textures = useTexture(RECORD_TEXTURE_URLS)
  const [color, roughness, anisotropy, relief] = useMemo(
    () => textures.map((t, i) => finishTexture(t, i === 0)),
    [textures],
  )
  const material = useMemo(
    () =>
      createMetalMaterial(
        {
          color: '#f3c779',
          map: color,
          metalness: 1,
          roughness: 0.52,
          roughnessMap: roughness,
          anisotropy: 0.94,
          anisotropyMap: anisotropy,
          bumpMap: relief,
          bumpScale: 0.000008,
        },
        'record',
      ),
    [color, roughness, anisotropy, relief],
  )
  useEffect(() => () => material.dispose(), [material])
  return (
    <group>
      {/* Two 0.020-inch copper mothers and the 0.010-inch central bond. */}
      <Edge
        radius={RECORD_RADIUS}
        depth={COPPER_LAYER_THICKNESS}
        z={(BOND_THICKNESS + COPPER_LAYER_THICKNESS) / 2}
      />
      <Edge
        radius={RECORD_RADIUS}
        depth={COPPER_LAYER_THICKNESS}
        z={-(BOND_THICKNESS + COPPER_LAYER_THICKNESS) / 2}
      />
      <Edge
        radius={RECORD_RADIUS - 0.00002}
        depth={BOND_THICKNESS}
        z={0}
        color="#b19355"
        bevel={0.000015}
      />
      {/* Side 1 faces out of the back of this museum display. It is never mirrored. */}
      <mesh
        position={[0, 0, -RECORD_THICKNESS / 2 - 0.000001]}
        rotation={[0, Math.PI, 0]}
        onPointerMove={(event) => {
          if (
            event.pointerType === 'touch' ||
            event.buttons !== 0 ||
            !event.uv ||
            useExhibitStore.getState().zoom > AUTO_HOVER_MAX_ZOOM ||
            useExhibitStore.getState().panel ||
            (event.nativeEvent.target as HTMLElement)?.closest?.('.annotation')
          )
            return
          useExhibitStore
            .getState()
            .setHovered(
              onDisc(event.uv.x, event.uv.y, RECORD_RADIUS) &&
                Math.hypot(event.uv.x - 0.5, event.uv.y - 0.5) < 0.24
                ? 'music'
                : null,
            )
        }}
        onPointerOut={() => useExhibitStore.getState().setHovered(null)}
        onPointerUp={(event) => {
          if (
            touch.consumeTouchTap(event.nativeEvent) &&
            event.uv &&
            onDisc(event.uv.x, event.uv.y, RECORD_RADIUS) &&
            Math.hypot(event.uv.x - 0.5, event.uv.y - 0.5) < 0.24
          ) {
            event.stopPropagation()
            useExhibitStore.getState().setPanel('music')
          }
        }}
        onClick={(event) => {
          if (touch.isTouchClick()) return
          if (
            event.delta <= 5 &&
            event.uv &&
            onDisc(event.uv.x, event.uv.y, RECORD_RADIUS) &&
            Math.hypot(event.uv.x - 0.5, event.uv.y - 0.5) < 0.24
          ) {
            event.stopPropagation()
            useExhibitStore.getState().setPanel('music')
          }
        }}
      >
        <planeGeometry args={[RECORD_RADIUS * 2, RECORD_RADIUS * 2]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      <mesh
        position={[0, 0, -RECORD_THICKNESS / 2]}
        rotation={[0, Math.PI, 0]}
        castShadow
        receiveShadow
      >
        <ringGeometry args={[SPINDLE_RADIUS, RECORD_RADIUS - 0.000035, 1536, 8]} />
        <primitive object={material} attach="material" />
      </mesh>
      <mesh position={[0, 0, RECORD_THICKNESS / 2]} castShadow>
        <ringGeometry args={[SPINDLE_RADIUS, RECORD_RADIUS - 0.000035, 1536]} />
        <meshPhysicalMaterial
          color="#e7ba65"
          metalness={1}
          roughness={0.27}
          anisotropy={0.8}
          anisotropyMap={anisotropy}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[SPINDLE_RADIUS, SPINDLE_RADIUS, RECORD_THICKNESS, 128, 1, true]} />
        <meshStandardMaterial color="#c8a16b" metalness={1} roughness={0.25} />
      </mesh>
    </group>
  )
}
