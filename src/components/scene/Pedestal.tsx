import { ContactShadows, RoundedBox } from '@react-three/drei'
import { memo } from 'react'
import { PEDESTAL_TOP } from '../../lib/artifact-dimensions'

export const Pedestal = memo(function Pedestal({ dark }: { dark: boolean }) {
  const height = 0.175
  return (
    <group>
      <RoundedBox
        args={[0.35, height, 0.235]}
        position={[0, PEDESTAL_TOP - height / 2, 0]}
        radius={0.0008}
        smoothness={4}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={dark ? '#191919' : '#f5f5f5'} roughness={0.76} metalness={0} />
      </RoundedBox>
      {[-1, 1].map((direction) => (
        <group key={direction} position={[direction * 0.075, PEDESTAL_TOP + 0.008, 0.0005]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.009, 0.018, 0.009]} />
            <meshStandardMaterial
              color={dark ? '#242424' : '#e0e0e0'}
              metalness={0.65}
              roughness={0.34}
            />
          </mesh>
          <mesh position={[0, 0.01, 0.0046]} castShadow>
            <boxGeometry args={[0.009, 0.006, 0.0006]} />
            <meshStandardMaterial
              color={dark ? '#292929' : '#bdbdbd'}
              metalness={0.7}
              roughness={0.28}
            />
          </mesh>
          <mesh position={[0, 0.01, -0.0046]} castShadow>
            <boxGeometry args={[0.009, 0.006, 0.0006]} />
            <meshStandardMaterial
              color={dark ? '#292929' : '#bdbdbd'}
              metalness={0.7}
              roughness={0.28}
            />
          </mesh>
        </group>
      ))}
      <ContactShadows
        key={dark ? 'dark-contact' : 'light-contact'}
        position={[0, PEDESTAL_TOP - height - 0.0003, 0]}
        opacity={dark ? 0.65 : 0.23}
        scale={1.8}
        blur={2.5}
        far={1}
        resolution={2048}
        frames={1}
        color="#000000"
      />
    </group>
  )
})
