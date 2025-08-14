const fs = require('fs');

window.addEventListener('DOMContentLoaded', () => {
const replaceText = (selector, text) => {
  const element = document.getElementById(selector)
  if (element) element.innerText = text
}

for (const type of ['chrome', 'node', 'electron']) {
  replaceText(`${type}-version`, process.versions[type])
}
});

function log(...args) {
  const elem = document.createElement('pre');
  elem.textContent = args.join(' ');
  document.body.appendChild(elem);
}

const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
device.addEventListener('uncapturederror', (event) => {
  log('Uncaptured error:', event.error.message);
});

const module = device.createShaderModule({
  label: 'doubling compute module',
  code: `
    @group(0) @binding(0) var<storage, read_write> data: array<f32>;

    @compute @workgroup_size(1) fn computeSomething(
      @builtin(global_invocation_id) id: vec3u
    ) {
      let i = id.x;
      data[i] = data[i] * 2.0;
    }
  `,
});

const pipeline = device.createComputePipeline({
  label: 'doubling compute pipeline',
  layout: 'auto',
  compute: {
    module,
  },
});

const data = fs.readFileSync('input.bin')
const input = new Float32Array(data.buffer, data.byteOffset, data.byteLength / Float32Array.BYTES_PER_ELEMENT);

// create a buffer on the GPU to hold our computation
// input and output
const workBuffer = device.createBuffer({
  label: 'work buffer',
  size: input.byteLength,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
});
// Copy our input data to that buffer
device.queue.writeBuffer(workBuffer, 0, input);

// create a buffer on the GPU to get a copy of the results
const resultBuffer = device.createBuffer({
  label: 'result buffer',
  size: input.byteLength,
  usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
});

// Setup a bindGroup to tell the shader which
// buffer to use for the computation
const bindGroup = device.createBindGroup({
  label: 'bindGroup for work buffer',
  layout: pipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: { buffer: workBuffer } },
  ],
});

// Encode commands to do the computation
const encoder = device.createCommandEncoder({
  label: 'doubling encoder',
});
const pass = encoder.beginComputePass({
  label: 'doubling compute pass',
});
pass.setPipeline(pipeline);
pass.setBindGroup(0, bindGroup);
pass.dispatchWorkgroups(input.length);
pass.end();

// Encode a command to copy the results to a mappable buffer.
encoder.copyBufferToBuffer(workBuffer, 0, resultBuffer, 0, resultBuffer.size);

// Finish encoding and submit the commands
const commandBuffer = encoder.finish();
device.queue.submit([commandBuffer]);

// Read the results
await resultBuffer.mapAsync(GPUMapMode.READ);
const result = new Float32Array(resultBuffer.getMappedRange().slice());
resultBuffer.unmap();

log('input', input);
log('result', result);