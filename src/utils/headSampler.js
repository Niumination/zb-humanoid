import { Vector3 } from 'three';

export async function sampleHeadPoints(modelUrl, count = 150000) {
  const [{ GLTFLoader }, { MeshSurfaceSampler }] = await Promise.all([
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/math/MeshSurfaceSampler.js')
  ]);

  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(modelUrl, (gltf) => {
      let mesh = gltf.scene.children.find((c) => c.isMesh);
      if (!mesh) {
        gltf.scene.traverse((o) => { if (!mesh && o.isMesh) mesh = o; });
      }
      if (!mesh) return reject(new Error('No mesh found in model'));

      // Normalize: center + scale to unit height so the face fills the frame
      mesh.geometry.computeBoundingBox();
      const bb = mesh.geometry.boundingBox;
      const size = new Vector3();
      bb.getSize(size);
      const center = new Vector3();
      bb.getCenter(center);
      const s = 2.4 / Math.max(size.x, size.y, size.z);

      const sampler = new MeshSurfaceSampler(mesh).build();
      const positions = new Float32Array(count * 3);
      const dummy = new Vector3();
      for (let i = 0; i < count; i++) {
        sampler.sample(dummy);
        positions[i * 3] = (dummy.x - center.x) * s;
        positions[i * 3 + 1] = (dummy.y - center.y) * s;
        positions[i * 3 + 2] = (dummy.z - center.z) * s;
      }
      resolve(positions);
    }, undefined, reject);
  });
}
