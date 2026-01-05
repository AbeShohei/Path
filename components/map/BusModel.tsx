import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Mesh } from 'three';
import { RoundedBox } from '@react-three/drei';
import { ModelProps } from '../../types';

interface BusModelProps extends ModelProps {
  isMoving?: boolean;
}

export const BusModel = React.forwardRef<Group, BusModelProps>(({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  isMoving = false,
}, ref) => {
  // Colors
  const colors = {
    body: '#F2FF8D',       // Pale Lemon Yellow
    tire: '#1F2937',       // Dark Rubber Black
    rim: '#D1D5DB',        // Light Grey/Silver (Wheel Rim)
    hub: '#4B5563',        // Dark Grey (Wheel Hub Cap) - Unused now but kept for palette
    window: '#60A5FA',     // Light Blue (Window glass)
    sign: '#222222',       // Dark Grey (Destination Board)
    frame: '#111827',      // Dark Black/Grey for window frames
    plate: '#FFFFFF',      // White for license plate
  };

  // Main Dimensions
  const width = 1.8;
  const height = 1.95;
  const length = 4.5;
  const cornerRadius = 0.2;

  // Wheel dimensions
  const wheelRadius = 0.35;
  const wheelThickness = 0.3;

  // Wheel Refs (Now Groups)
  const wheel1 = useRef<Group>(null);
  const wheel2 = useRef<Group>(null);
  const wheel3 = useRef<Group>(null);
  const wheel4 = useRef<Group>(null);
  const bodyGroup = useRef<Group>(null);

  // Wheel Positioning
  const wheelY = -0.625;
  const wheelX = width / 2 - 0.05; // Slightly recessed

  const wheelZFront = 0.9;
  const wheelZRear = -1.5;

  // Body Lift Offset
  const bodyLift = 0.25;

  // Common Border Config
  const border = 0.03; // 3cm border

  // Window Layout Helpers
  const bodyHalfWidth = width / 2;
  const bodyHalfLength = length / 2;
  const surfaceOffset = 0.02;

  const windowY = 0.25;

  // --- Front Face Config ---
  const signY = 0.65;
  const signHeight = 0.25;
  // Revert Width: Back to 1.4 (smaller box style)
  const signWidth = 1.4;

  // Panoramic Window Config
  const frontWindowY = 0.05;
  const frontWindowHeight = 0.7;
  const frontWindowWidth = 1.5;
  const frontFrameHeight = frontWindowHeight + (border * 2);
  const frontFrameWidth = frontWindowWidth + (border * 2);

  // --- Back Face Config ---
  const backWindowWidth = 1.4;
  const backWindowHeight = 0.6;
  const backFrameWidth = backWindowWidth + (border * 2);
  const backFrameHeight = backWindowHeight + (border * 2);

  // --- Roof AC Unit Config ---
  const acWidth = 1.3;
  // Increase height to allow sinking the bottom rounded corners into the body
  const acHeight = 0.35;
  const acLength = 1.6;
  const acRadius = 0.08;

  // Position calculation:
  // We want to hide the bottom radius to make it look like it sits flat/seamlessly.
  // Sink it deeper as requested (0.2).
  // Top of body = height / 2
  // AC Center = (RoofY - Sinking) + (ACHeight / 2)
  const acSinking = 0.2;
  const acY = (height / 2) - acSinking + (acHeight / 2);

  // Materials
  const WindowMaterial = <meshStandardMaterial color={colors.window} roughness={0.1} metalness={0.5} />;
  const FrameMaterial = <meshStandardMaterial color={colors.frame} roughness={0.8} />;
  const PlateMaterial = <meshStandardMaterial color={colors.plate} roughness={0.3} />;


  // --- Right Side (Driver Side) 5-Window Panel Config ---
  const rGlassH = 0.76;
  const rGlassW = 0.68;

  // Calculated Frame Size for 5 windows
  const rFrameW = (rGlassW * 5) + (border * 6); // 5 windows + 6 gaps
  const rFrameH = rGlassH + (border * 2);       // glass + top/bottom gaps

  // Calculate local positions for the 5 glass panes (Right Side)
  const rWindowPositions = Array.from({ length: 5 }).map((_, i) => {
    const startX = -rFrameW / 2;
    return startX + border + (i * (rGlassW + border)) + (rGlassW / 2);
  });

  // --- Left Side (Passenger Side) Config ---

  // 1. Front Door
  const fDoorPos = -1.8;
  const fDoorW = 0.7;
  const fDoorH = 1.45;
  const fDoorGlassW = fDoorW - (border * 4);
  const fDoorGlassH = fDoorH - (border * 4);

  // 2. Window Between
  const win1Pos = -1.0;

  // 3. Rear/Middle Door
  const mDoorPos = 0.0; // Centered
  const mDoorW = 1.0;
  const mDoorWindowH = 0.8;
  const mDoorWindowY = 0.2;
  const mDoorGlassW = mDoorW - 0.25;
  const mDoorGlassH = mDoorWindowH - 0.2;

  const mDoorFrameW = mDoorGlassW + (border * 2);
  const mDoorFrameH = mDoorGlassH + (border * 2);

  // 4. Rear Combined Window (Merged 2 windows)
  // Positioned between Middle Door and Tail
  // Middle door ends approx 0.5. Tail is 2.25. Center ~1.4.
  const combinedWinPos = 1.4;
  const combinedGlassW = 1.5; // Long continuous window
  const combinedGlassH = 0.70;
  const combinedFrameW = combinedGlassW + (border * 2);
  const combinedFrameH = combinedGlassH + (border * 2);

  // Standard Window Sizes (for win1)
  const lGlassW = 0.65;
  const lGlassH = 0.70;
  const lFrameW = lGlassW + (border * 2);
  const lFrameH = lGlassH + (border * 2);

  // Animation Logic
  useFrame((state, delta) => {
    if (!isMoving) {
      // Return to rest if needed, or simple idle
      return;
    }

    const speed = 5 * delta;

    // Rotate wheels
    // wheel1 (Right Front) - Local X is inverted, so negative rotation moves top forward (towards +Z) ? 
    // Let's rely on standard: if wheel1 rotation is [0, PI, 0], to move in Global +Z, we need Local +X or -X?
    // Trial: If it spins backwards, user will notice.
    // Let's assume standard forward motion makes wheels spin around their "Axle".
    // Wheel1 (Right): Rotated Y=180. Local X points Left (-Global X). 
    // To roll "forward" (+Global Z), top of wheel moves +Z. 
    // Local coords: Top is +Y. +Z is Global -Z (Back). 
    // So moving Top to +Z (Global Back) is positive X rotation.
    // We want Top to move to Global FRONT (+Global Z).
    // So we need NEGATIVE X rotation?
    // Let's try negative for right, positive for left.
    // Wait, simpler: if they are separate groups, just rotate 'x'.
    if (wheel1.current) wheel1.current.rotation.x -= speed; // Right Front
    if (wheel2.current) wheel2.current.rotation.x += speed; // Left Front
    if (wheel3.current) wheel3.current.rotation.x -= speed; // Right Rear
    if (wheel4.current) wheel4.current.rotation.x += speed; // Left Rear

    // Body Suspension Simulation
    if (bodyGroup.current) {
      // Bounce
      bodyGroup.current.position.y = bodyLift + Math.sin(state.clock.elapsedTime * 15) * 0.02;
      // Slight Rocking (left/right sway)
      bodyGroup.current.rotation.z = Math.sin(state.clock.elapsedTime * 10) * 0.015;
    }
  });

  // --- Wheel Component ---
  const WheelObj = React.forwardRef<Group, any>((props, wRef) => (
    <group ref={wRef} {...props}>
      {/* Tire - Torus for rounded edges */}
      {/* Rotate Y 90 degrees so the "hole" faces X (Axle is X-axis) */}
      <mesh rotation={[0, Math.PI / 2, 0]} castShadow>
        {/* Radius (dist to tube center), Tube (thickness), RadialSeg, TubularSeg */}
        {/* Outer Radius ~ 0.35. Tube ~ 0.12 -> Radius ~ 0.23 */}
        <torusGeometry args={[0.23, 0.12, 16, 32]} />
        <meshStandardMaterial color={colors.tire} roughness={0.8} />
      </mesh>

      {/* Rim - Cylinder inside */}
      {/* Rotate Z 90 degrees so the cylinder height aligns with X (Axle is X-axis) */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0]} castShadow>
        {/* RadiusTop, RadiusBottom, Height, Segments */}
        {/* Height matches tire width approx 0.24 */}
        <cylinderGeometry args={[0.23, 0.23, 0.15, 32]} />
        <meshStandardMaterial color={colors.rim} roughness={0.3} metalness={0.6} />
      </mesh>
    </group>
  ));


  return (
    <group ref={ref} position={position} rotation={rotation} scale={scale} dispose={null}>

      {/* === BODY GROUP (Lifted) === */}
      <group position={[0, bodyLift, 0]} ref={bodyGroup}>

        {/* === MAIN BODY === */}
        <RoundedBox args={[width, height, length]} radius={cornerRadius} smoothness={4} castShadow receiveShadow>
          <meshStandardMaterial color={colors.body} />
        </RoundedBox>

        {/* === ROOF AC UNIT === */}
        <group position={[0, acY, -0.5]}>
          <RoundedBox
            args={[acWidth, acHeight, acLength]}
            radius={acRadius}
            smoothness={4}
            castShadow
          >
            {/* Same color as body to look seamless */}
            <meshStandardMaterial color={colors.body} roughness={0.4} />
          </RoundedBox>
        </group>

        {/* === DETAILS === */}
        <group>
          {/* --- FRONT FACE --- */}
          {/* Z Position: +bodyHalfLength (2.25) */}

          {/* Destination Board - Reverted to thick box style */}
          <RoundedBox
            args={[signWidth, signHeight, 0.05]}
            radius={0.05}
            smoothness={4}
            position={[0, signY, bodyHalfLength + 0.01]}
          >
            <meshStandardMaterial color={colors.sign} roughness={0.4} />
          </RoundedBox>

          {/* Front Windshield Frame */}
          <mesh position={[0, frontWindowY, bodyHalfLength + surfaceOffset]}>
            <planeGeometry args={[frontFrameWidth, frontFrameHeight]} />
            {FrameMaterial}
          </mesh>
          {/* Front Windshield Glass */}
          <mesh position={[0, frontWindowY, bodyHalfLength + surfaceOffset + 0.005]}>
            <planeGeometry args={[frontWindowWidth, frontWindowHeight]} />
            {WindowMaterial}
          </mesh>

          {/* Front License Plate */}
          <RoundedBox
            args={[0.4, 0.15, 0.02]}
            radius={0.02}
            position={[0, -0.6, bodyHalfLength + surfaceOffset]}
          >
            {PlateMaterial}
          </RoundedBox>

          {/* --- BACK FACE --- */}
          {/* Z Position: -bodyHalfLength (-2.25) */}
          <group position={[0, 0, -bodyHalfLength - surfaceOffset]} rotation={[0, Math.PI, 0]}>

            {/* Back Windshield Frame */}
            <mesh position={[0, windowY, 0]}>
              <planeGeometry args={[backFrameWidth, backFrameHeight]} />
              {FrameMaterial}
            </mesh>
            {/* Back Windshield Glass */}
            <mesh position={[0, windowY, 0.005]}>
              <planeGeometry args={[backWindowWidth, backWindowHeight]} />
              {WindowMaterial}
            </mesh>

            {/* Rear License Plate */}
            <RoundedBox
              args={[0.4, 0.15, 0.02]}
              radius={0.02}
              position={[0, -0.6, 0]}
            >
              {PlateMaterial}
            </RoundedBox>
          </group>


          {/* --- LEFT SIDE (Passenger Side / Doors - Global X+) --- */}
          {/* Rotation Math.PI/2: Local X+ points to Back, Local X- points to Front */}
          <group position={[bodyHalfWidth + surfaceOffset, 0, 0]} rotation={[0, Math.PI / 2, 0]}>

            {/* 1. FRONT DOOR (With Center Sash) */}
            <group position={[fDoorPos, -0.15, 0]}>
              <mesh position={[0, 0, 0]}>
                <planeGeometry args={[fDoorW, fDoorH]} />
                {FrameMaterial}
              </mesh>
              <mesh position={[0, 0, 0.01]}>
                <planeGeometry args={[fDoorGlassW, fDoorGlassH]} />
                {WindowMaterial}
              </mesh>
              <mesh position={[0, 0, 0.02]}>
                <planeGeometry args={[border, fDoorGlassH]} />
                {FrameMaterial}
              </mesh>
            </group>

            {/* 2. WINDOW BETWEEN DOORS (1 Window) */}
            <group position={[win1Pos, windowY, 0]}>
              <mesh position={[0, 0, 0]}>
                <planeGeometry args={[lFrameW, lFrameH]} />
                {FrameMaterial}
              </mesh>
              <mesh position={[0, 0, 0.01]}>
                <planeGeometry args={[lGlassW, lGlassH]} />
                {WindowMaterial}
              </mesh>
            </group>

            {/* 3. REAR/MIDDLE DOOR (Rounded Frame & Glass) */}
            <group position={[mDoorPos, -0.15, 0]}>
              <RoundedBox
                args={[mDoorFrameW, mDoorFrameH, 0.01]}
                radius={0.06}
                position={[0, mDoorWindowY + 0.15, 0]}
              >
                {FrameMaterial}
              </RoundedBox>
              <RoundedBox
                args={[mDoorGlassW, mDoorGlassH, 0.005]}
                radius={0.05}
                position={[0, mDoorWindowY + 0.15, 0.006]}
              >
                {WindowMaterial}
              </RoundedBox>
            </group>

            {/* 4. REAR COMBINED WINDOW (Merged) */}
            <group position={[combinedWinPos, windowY, 0]}>
              <mesh position={[0, 0, 0]}>
                <planeGeometry args={[combinedFrameW, combinedFrameH]} />
                {FrameMaterial}
              </mesh>
              <mesh position={[0, 0, 0.01]}>
                <planeGeometry args={[combinedGlassW, combinedGlassH]} />
                {WindowMaterial}
              </mesh>
            </group>

          </group>

          {/* --- RIGHT SIDE (Driver Side / 5-Window Panel - Global X-) --- */}
          <group position={[-bodyHalfWidth - surfaceOffset, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <mesh position={[0, windowY, 0]}>
              <planeGeometry args={[rFrameW, rFrameH]} />
              {FrameMaterial}
            </mesh>
            {rWindowPositions.map((xPos, i) => (
              <mesh key={i} position={[xPos, windowY, 0.01]}>
                <planeGeometry args={[rGlassW, rGlassH]} />
                {WindowMaterial}
              </mesh>
            ))}
          </group>

        </group>
      </group>

      {/* === WHEELS === */}
      {/* 
         WheelObj default: Hubcap at +X (Outer face). Axle along X.
         Left Side (X > 0): Outer face is +X. No rotation needed.
         Right Side (X < 0): Outer face is -X. Rotate Y 180 (or PI) to flip.
      */}

      {/* Front Right (Negative X) */}
      <WheelObj ref={wheel1} position={[-wheelX, wheelY, wheelZFront]} rotation={[0, Math.PI, 0]} />
      {/* Front Left (Positive X) */}
      <WheelObj ref={wheel2} position={[wheelX, wheelY, wheelZFront]} rotation={[0, 0, 0]} />
      {/* Rear Right (Negative X) */}
      <WheelObj ref={wheel3} position={[-wheelX, wheelY, wheelZRear]} rotation={[0, Math.PI, 0]} />
      {/* Rear Left (Positive X) */}
      <WheelObj ref={wheel4} position={[wheelX, wheelY, wheelZRear]} rotation={[0, 0, 0]} />

    </group>
  );
});