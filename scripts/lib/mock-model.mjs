/**
 * A small valid 3D model for the mock catalog: a colored cube as a binary glTF 2.0 file (.glb), written
 * directly (no tool needed). Used by `npm run mock:apply` to upload a model for the product `mock-3d-model`,
 * so the theme's handling of 3D media (it skips it) can be tested against real data.
 */
export const cubeGlb = () => {
  /* 8 corners of a cube of side 1, and 12 triangles */
  const positions = new Float32Array([-0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5]);
  const indices = new Uint16Array([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 1, 2, 6, 1, 6, 5, 0, 4, 7, 0, 7, 3]);
  const bin = Buffer.concat([Buffer.from(positions.buffer), Buffer.from(indices.buffer)]);
  const gltf = {
    asset: { version: '2.0', generator: 'singi mock catalog' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'Cube' }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.2, 0.55, 0.45, 1], metallicFactor: 0.1, roughnessFactor: 0.7 } }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positions.byteLength, target: 34962 },
      { buffer: 0, byteOffset: positions.byteLength, byteLength: indices.byteLength, target: 34963 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 8, type: 'VEC3', min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] },
      { bufferView: 1, componentType: 5123, count: 36, type: 'SCALAR' },
    ],
  };
  const pad = (buffer, byte) => Buffer.concat([buffer, Buffer.alloc((4 - (buffer.length % 4)) % 4, byte)]);
  const json = pad(Buffer.from(JSON.stringify(gltf)), 0x20);
  const body = pad(bin, 0);
  const header = Buffer.alloc(12);
  header.write('glTF', 0, 'ascii');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + json.length + 8 + body.length, 8);
  const chunk = (buffer, type) => {
    const head = Buffer.alloc(8);
    head.writeUInt32LE(buffer.length, 0);
    head.writeUInt32LE(type, 4);
    return Buffer.concat([head, buffer]);
  };
  return Buffer.concat([header, chunk(json, 0x4e4f534a), chunk(body, 0x004e4942)]);
};
