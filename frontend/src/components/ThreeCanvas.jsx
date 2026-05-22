import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';

function StarField({ mouse }) {
  const ref = useRef();
  
  // Generate random coordinates inside a sphere boundary
  const sphere = useMemo(() => {
    const arr = new Float32Array(600); // 200 points (x, y, z)
    for (let i = 0; i < arr.length; i += 3) {
      // Coordinate randomizing in a sphere radius of 1.2
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = Math.cbrt(Math.random()) * 1.5;

      arr[i] = r * Math.sin(phi) * Math.cos(theta);     // x
      arr[i + 1] = r * Math.sin(phi) * Math.sin(theta); // y
      arr[i + 2] = r * Math.cos(phi);                   // z
    }
    return arr;
  }, []);

  useFrame((state, delta) => {
    // Spin the entire sphere slowly over time
    if (ref.current) {
      ref.current.rotation.x -= delta * 0.05;
      ref.current.rotation.y -= delta * 0.075;

      // Parallax: smooth interpolation toward the mouse coords
      const targetX = mouse.current[0] * 0.15;
      const targetY = mouse.current[1] * 0.15;
      
      ref.current.position.x += (targetX - ref.current.position.x) * 0.05;
      ref.current.position.y += (targetY - ref.current.position.y) * 0.05;
    }
  });

  return (
    <group rotation={[0, 0, Math.PI / 4]}>
      <Points ref={ref} positions={sphere} stride={3} frustumCulled={false}>
        <PointMaterial
          transparent
          color="#a855f7" // Purple accent
          size={0.012}
          sizeAttenuation={true}
          depthWrite={false}
          opacity={0.6}
        />
      </Points>
    </group>
  );
}

export default function ThreeCanvas() {
  const mouse = useRef([0, 0]);

  useEffect(() => {
    const handleMouseMove = (event) => {
      // Map pixel coordinates to coordinates between -1 and 1
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = -(event.clientY / window.innerHeight) * 2 + 1;
      mouse.current = [x, y];
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1, // Sits under all standard HTML layers
        pointerEvents: 'none', // Allows click events to pass straight through
        background: 'radial-gradient(circle at 50% 50%, #111528 0%, #080a10 100%)',
      }}
    >
      <Canvas camera={{ position: [0, 0, 1] }}>
        <ambientLight opacity={0.5} />
        <StarField mouse={mouse} />
      </Canvas>
    </div>
  );
}
