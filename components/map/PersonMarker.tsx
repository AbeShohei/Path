import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import { ModelProps } from '../../types';

interface PersonMarkerProps extends ModelProps {
  color?: string;
  isMoving?: boolean;
  isStatic?: boolean;
}

export const PersonMarker = React.forwardRef<Group, PersonMarkerProps>(({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  color = '#EF4444',
  isMoving = false,
  isStatic = false,
}, ref) => {
  const internalRef = useRef<Group>(null);
  const leftArmRef = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);

  useFrame((state) => {
    if (isStatic) return;

    const t = state.clock.getElapsedTime();

    if (internalRef.current) {
      if (isMoving) {
        // RUNNING ANIMATION
        // Faster bobbing for running
        const yOffset = Math.sin(t * 15) * 0.15;
        internalRef.current.position.y = Math.max(0, yOffset);

        // Side-to-side waddle
        internalRef.current.rotation.z = Math.sin(t * 15) * 0.1;
      } else {
        // IDLE ANIMATION
        // Gentle bob
        const yOffset = Math.sin(t * 3) * 0.05;
        internalRef.current.position.y = Math.max(0, yOffset);

        // Reset rotations
        internalRef.current.rotation.x = 0;
        internalRef.current.rotation.z = 0;
      }
    }

    // ARM ANIMATION
    if (leftArmRef.current && rightArmRef.current) {
      if (isMoving) {
        // Vigorous arm swinging for running
        leftArmRef.current.rotation.x = Math.sin(t * 15) * 0.8;
        rightArmRef.current.rotation.x = Math.sin(t * 15 + Math.PI) * 0.8;
      } else {
        // Gentle sway for idle
        leftArmRef.current.rotation.x = Math.sin(t * 3) * 0.1;
        rightArmRef.current.rotation.x = Math.sin(t * 3 + Math.PI) * 0.1;
      }
    }
  });

  return (
    // Outer group handles position from parent (App.tsx)
    <group ref={ref} position={position} rotation={rotation} scale={scale} dispose={null}>
      {/* Inner group handles local animation */}
      <group ref={internalRef}>
        {/* Head */}
        <mesh position={[0, 0.9, 0]} castShadow>
          <sphereGeometry args={[0.35, 32, 32]} />
          <meshStandardMaterial color="#FCA5A5" />
        </mesh>

        {/* Body */}
        <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.25, 0.35, 0.6, 16]} />
          <meshStandardMaterial color={color} />
        </mesh>

        {/* Legs */}
        <group position={[0, 0, 0]}>
          <mesh position={[-0.15, 0.1, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.08, 0.3, 8]} />
            <meshStandardMaterial color="#1F2937" />
          </mesh>
          <mesh position={[0.15, 0.1, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.08, 0.3, 8]} />
            <meshStandardMaterial color="#1F2937" />
          </mesh>
        </group>

        {/* Arms - Pivot at shoulders */}
        {/* Right Arm */}
        <group ref={rightArmRef} position={[0.32, 0.55, 0]}>
          {/* Sleeve / Arm */}
          <mesh position={[0, -0.12, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.06, 0.25, 8]} />
            <meshStandardMaterial color={color} />
          </mesh>
          {/* Hand */}
          <mesh position={[0, -0.28, 0]} castShadow>
            <sphereGeometry args={[0.09, 16, 16]} />
            <meshStandardMaterial color="#FCA5A5" />
          </mesh>
        </group>

        {/* Left Arm */}
        <group ref={leftArmRef} position={[-0.32, 0.55, 0]}>
          {/* Sleeve / Arm */}
          <mesh position={[0, -0.12, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.06, 0.25, 8]} />
            <meshStandardMaterial color={color} />
          </mesh>
          {/* Hand */}
          <mesh position={[0, -0.28, 0]} castShadow>
            <sphereGeometry args={[0.09, 16, 16]} />
            <meshStandardMaterial color="#FCA5A5" />
          </mesh>
        </group>
      </group>
    </group>
  );
});