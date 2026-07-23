
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import vertex from "./shaders/vertex.vert";
import fragment from "./shaders/fragment.frag";
import {
  EffectComposer,
  RenderPass,
  ShaderPass,
  UnrealBloomPass,
  FilmPass
} from "three/examples/jsm/Addons.js";
import GUI from "lil-gui";

const gui = new GUI();
const canvas = document.querySelector(".webgl");
const loader = new THREE.TextureLoader();

const cloud1 = loader.load("/cloud1.webp");
const cloud2 = loader.load("/cloud2.webp");

cloud1.colorSpace = THREE.SRGBColorSpace;
cloud1.wrapS = THREE.RepeatWrapping;
cloud1.wrapT = THREE.RepeatWrapping;
cloud1.minFilter = THREE.LinearFilter;
cloud1.magFilter = THREE.LinearFilter;
cloud1.needsUpdate = true;
cloud1.generateMipmaps = false;

cloud2.colorSpace = THREE.SRGBColorSpace;
cloud2.wrapS = THREE.RepeatWrapping;
cloud2.wrapT = THREE.RepeatWrapping;
cloud2.minFilter = THREE.LinearFilter;
cloud2.magFilter = THREE.LinearFilter;
cloud2.needsUpdate = true;
cloud2.generateMipmaps = false;

const background1 = loader.load("/background1.webp");
background1.wrapS = THREE.RepeatWrapping;
background1.wrapT = THREE.ClampToEdgeWrapping;

const scene = new THREE.Scene();

const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

const imageWidth = 3200; 
const imageHeight = 3200;

const plane1 = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    uniforms: {
      uTexture1: new THREE.Uniform(cloud1),
      uTexture2: new THREE.Uniform(cloud2),
      uTexture3: new THREE.Uniform(background1),
      uResolution: new THREE.Uniform(new THREE.Vector2(sizes.width, sizes.height)),
      uImageResolution: new THREE.Uniform(new THREE.Vector2(imageWidth, imageHeight)),
      uTime: new THREE.Uniform(0),
    },
    side: THREE.DoubleSide,
  }),
);
scene.add(plane1);



const trailTarget = new THREE.WebGLRenderTarget(sizes.width, sizes.height, {
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  format: THREE.RGBAFormat,
});

const camera = new THREE.PerspectiveCamera(
  75,
  sizes.width / sizes.height,
  0.1,
  100,
);
camera.position.z = 1;
scene.add(camera);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.8;
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Crucial for the trail effect: Stop WebGL from erasing the trail target every frame
renderer.autoClear = false;

// Post-processing
const renderTarget = new THREE.WebGLRenderTarget(sizes.width, sizes.height, {
  samples: renderer.getPixelRatio() === 1 ? 2 : 0,
});
const effectComposer = new EffectComposer(renderer, renderTarget);
effectComposer.setSize(sizes.width, sizes.height);
effectComposer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// --- TRAIL SCENE SETUP ---
const trailScene = new THREE.Scene();
const trailCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const mouse = new THREE.Vector2(0.0, 0.0);

// 1. Fade Plane (dims the previous frame slightly to create the trail length)
const fadeMaterial = new THREE.MeshBasicMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0.05, // Lower value = longer trail. Higher value = shorter trail.
  depthWrite: false,
  depthTest: false,
});
const fadePlane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fadeMaterial);
fadePlane.renderOrder = 0; // Render this first
trailScene.add(fadePlane);

// 2. Trail Plane (draws the white circle at mouse position)
// 2. Trail Plane (draws the white circle at mouse position)
const trailShader = {
  uniforms: {
    uMouse: new THREE.Uniform(new THREE.Vector2(mouse.x, mouse.y)),
    uRadius: new THREE.Uniform(0.08),
    uAspect: new THREE.Uniform(sizes.width / sizes.height),
  },
  vertexShader: `
    varying vec2 vUv;
    void main(){
      gl_Position = vec4(position.xy, 0.0, 1.0);
      vUv = uv;
    }
  `,
  fragmentShader: `
    uniform vec2 uMouse;
    uniform float uRadius;
    uniform float uAspect;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;
      vec2 m = uMouse;

      uv.x *= uAspect;
      m.x *= uAspect;

      float d = distance(uv, m);
      float c = 1.0 - smoothstep(0.0, uRadius, d);

      // CHANGE HERE: Pass 'c' as the alpha value so the background is transparent!
      gl_FragColor = vec4(vec3(c), c); 
    }
  `,
};

const trailMaterial = new THREE.ShaderMaterial({
  uniforms: trailShader.uniforms,
  vertexShader: trailShader.vertexShader,
  fragmentShader: trailShader.fragmentShader,
  transparent: true, // IMPORTANT: Allows the trail underneath to show through
  blending: THREE.AdditiveBlending, // Makes the trail overlap smoothly
  depthWrite: false
});
const trailPlane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), trailMaterial);
trailPlane.renderOrder = 1; // Render this second, over the fade plane
trailScene.add(trailPlane);

// --- EVENT LISTENERS ---
window.addEventListener("mousemove", (e) => {
  mouse.x = e.clientX / sizes.width;
  mouse.y = 1.0 - e.clientY / sizes.height;
  trailMaterial.uniforms.uMouse.value.copy(mouse);
});

window.addEventListener("resize", () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  renderer.setSize(sizes.width, sizes.height);
  
  trailTarget.setSize(sizes.width, sizes.height);
  effectComposer.setSize(sizes.width, sizes.height);
  
  // Update trail aspect ratio
  trailMaterial.uniforms.uAspect.value = sizes.width / sizes.height;
});

// --- COMPOSER PASSES ---
const renderPass = new RenderPass(scene, camera);
effectComposer.addPass(renderPass);

const displacementShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTrail: { value: trailTarget.texture },
    uTime: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main(){
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      vUv = uv;
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler2D uTrail;
    uniform float uTime;
    varying vec2 vUv;

    //	Simplex 3D Noise 
    //	by Ian McEwan, Stefan Gustavson (https://github.com/stegu/webgl-noise)
    //
    vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

    float snoise(vec3 v){ 
      const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
      const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

    // First corner
      vec3 i  = floor(v + dot(v, C.yyy) );
      vec3 x0 =   v - i + dot(i, C.xxx) ;

    // Other corners
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min( g.xyz, l.zxy );
      vec3 i2 = max( g.xyz, l.zxy );

      //  x0 = x0 - 0. + 0.0 * C 
      vec3 x1 = x0 - i1 + 1.0 * C.xxx;
      vec3 x2 = x0 - i2 + 2.0 * C.xxx;
      vec3 x3 = x0 - 1. + 3.0 * C.xxx;

    // Permutations
      i = mod(i, 289.0 ); 
      vec4 p = permute( permute( permute( 
                 i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
               + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
               + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

    // Gradients
    // ( N*N points uniformly over a square, mapped onto an octahedron.)
      float n_ = 1.0/7.0; // N=7
      vec3  ns = n_ * D.wyz - D.xzx;

      vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)

      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

      vec4 x = x_ *ns.x + ns.yyyy;
      vec4 y = y_ *ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);

      vec4 b0 = vec4( x.xy, y.xy );
      vec4 b1 = vec4( x.zw, y.zw );

      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));

      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

      vec3 p0 = vec3(a0.xy,h.x);
      vec3 p1 = vec3(a0.zw,h.y);
      vec3 p2 = vec3(a1.xy,h.z);
      vec3 p3 = vec3(a1.zw,h.w);

    //Normalise gradients
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;

    // Mix final noise value
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                    dot(p2,x2), dot(p3,x3) ) );
    }

    void main() {
      // Get the trail data
      vec4 trail = texture2D(uTrail, vUv);
      vec2 uv = vUv;
      
      // Calculate animated 3D noise for X and Y directions
      // You can adjust '5.0' for noise scale and '0.5' for speed
      float noiseX = snoise(vec3(vUv * 10.0, uTime * 0.5));
      
      // Offset the Y noise coordinate slightly so it doesn't match X
      float noiseY = snoise(vec3(vUv * 10.0 + 10.0, uTime * 0.5));
      
      // Apply the distortion masked by the red channel of the trail
      float distortionStrength = 0.09; 
      uv.x += noiseX * trail.r * distortionStrength;
      uv.y += noiseY * trail.r * distortionStrength;

      // Output the distorted scene
      vec4 color = texture2D(tDiffuse, uv);
      gl_FragColor = color;
    }
  `,
};

const displacementPass = new ShaderPass(displacementShader);
// Explicitly rebind the trail texture to ensure it isn't lost during ShaderPass cloning
displacementPass.material.uniforms.uTrail.value = trailTarget.texture;
displacementPass.material.uniforms.uTime.value = 0.0;
effectComposer.addPass(displacementPass);

const unrealBloomPass = new UnrealBloomPass();
unrealBloomPass.strength = 0.009;
unrealBloomPass.radius = 0.279;
unrealBloomPass.threshold = 0.287;
unrealBloomPass.enabled = true;
effectComposer.addPass(unrealBloomPass);

gui.add(unrealBloomPass, "enabled");
gui.add(unrealBloomPass, "strength", 0, 2, 0.001);
gui.add(unrealBloomPass, "radius", 0, 2, 0.001);
gui.add(unrealBloomPass, "threshold", 0, 1, 0.001);

const tintShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTint: { value: null },
  },
  vertexShader: `
    varying vec2 vUv;
    void main(){
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      vUv = uv;
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec3 uTint;
    varying vec2 vUv;
    void main(){
      vec4 color = texture2D(tDiffuse,vUv);
      color.rgb += uTint;
      gl_FragColor = color;
    }
  `,
};

const tintPass = new ShaderPass(tintShader);
tintPass.material.uniforms.uTint.value = new THREE.Vector3(0.0, 0.029, 0.0);
effectComposer.addPass(tintPass);

gui.add(tintPass.material.uniforms.uTint.value, "x", 0, 1, 0.001).name("red");
gui.add(tintPass.material.uniforms.uTint.value, "y", 0, 1, 0.001).name("green");
gui.add(tintPass.material.uniforms.uTint.value, "z", 0, 1, 0.001).name("blue");

const filmPass = new FilmPass(
    0.15,   // noise intensity
    0.0,    // scanline intensity (set to 0 to remove the TV look)
    0,      // scanline count
    true   // grayscale (set to false to keep your scene's color)
);
// effectComposer.addPass(filmPass);

// gui.add(filmPass.uniforms.nIntensity, 'value', 0, 1, 0.01).name('Grain Intensity');


// --- STATIC FILM GRAIN & BRIGHTNESS PASS ---
const grainShader = {
  uniforms: {
    tDiffuse: { value: null },
    uIntensity: { value: 0.08 },
    uBrightness: { value: 0.75 }, // 1.0 is normal. Lower values (e.g., 0.8) make it darker.
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      vUv = uv;
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uIntensity;
    uniform float uBrightness;
    varying vec2 vUv;

    // Pseudo-random noise function
    float random(vec2 uv) {
      return fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      // 1. Get the scene's current color
      vec4 color = texture2D(tDiffuse, vUv);
      
      // 2. Darken the scene by multiplying the RGB values
      color.rgb *= uBrightness;
      
      // 3. Generate and apply the static noise
      float noise = random(vUv) - 0.5; 
      color.rgb += noise * uIntensity;
      
      gl_FragColor = color;
    }
  `,
};

const grainPass = new ShaderPass(grainShader);
effectComposer.addPass(grainPass);

const clock = new THREE.Clock();

function tick() {
  const elapsedtime = clock.getElapsedTime();
  
  plane1.material.uniforms.uTime.value = elapsedtime;
  displacementPass.material.uniforms.uTime.value = elapsedtime;
  
  controls.update();

  // 1. Render the trail texture first (Draws fade layer, then mouse circle)
  renderer.setRenderTarget(trailTarget);
  renderer.render(trailScene, trailCamera);
  
  // 2. Render the main scene via effectComposer
  renderer.setRenderTarget(null);
  renderer.clear(); // Because autoClear is false, we must manually clear the screen here
  effectComposer.render(); // Takes no arguments

  window.requestAnimationFrame(tick);
}

tick();