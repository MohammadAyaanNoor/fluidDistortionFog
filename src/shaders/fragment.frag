uniform float uTime;
uniform sampler2D uTexture1;
uniform sampler2D uTexture2;
uniform sampler2D uTexture3;
uniform vec2 uResolution;
uniform vec2 uImageResolution;
varying vec2 vUv;

vec3 screenBlend(vec3 a, vec3 b)
{
    return 1.0 - (1.0 - a) * (1.0 - b);
}
void main() {
    float speed = uTime * 0.02;

    // Cloud 1
    vec2 uv1 = vUv;
    uv1.x = fract(uv1.x + speed);

    // Cloud 2 shifted to the right
    vec2 uv2 = vUv;
    // vec2 uv3 = vUv;
    uv2.x = fract(uv2.x + speed - 0.45);
    uv2.y = fract(uv2.y - 0.45);

    float planeAspect = uResolution.x / uResolution.y;
    float imageAspect = uImageResolution.x / uImageResolution.y;
    
    vec2 scale = vec2(1.0, 1.0);
    
    // Compare aspects to mimic CSS 'object-fit: cover'
    if (planeAspect > imageAspect) {
        // Screen is proportionally wider than the image: scale the Y axis
        scale.y = imageAspect / planeAspect;
    } else {
        // Screen is proportionally taller than the image: scale the X axis
        scale.x = planeAspect / imageAspect;
    }
    
    // Shift UV to center, apply aspect scale, apply your 0.9 zoom, shift back
    vec2 uv3 = vUv - 0.5;
    uv3 = uv3 * scale; // Fix aspect ratio
    // uv3 = uv3 * 0.9;   // Your custom 10% zoom-in
    uv3 = uv3 + 0.5;



    // uv3 = (uv3 - 0.5) * 0.9 + 0.5;

// Move image downward
uv3.y += 0.24;
    vec4 bg = texture2D(uTexture3, uv3);
    bg.rgb *= 1.1;
    bg.rgb = pow(bg.rgb, vec3(0.8));
    vec4 c1 = texture2D(uTexture1, uv1);
    vec4 c2 = texture2D(uTexture2, uv2);

    //  vec4 clouds = c1 + c2 * (1.0 - c1.a);
     vec3 rgb = screenBlend(c1.rgb, c2.rgb);
float alpha = max(c1.a, c2.a);

vec4 clouds = vec4(rgb, alpha);
    // Darken clouds a bit
    float topLight = smoothstep(0.0, 0.8, vUv.y);

clouds.rgb += topLight * 0.15;
    clouds.rgb *= 2.6;
    vec3 fogTint = vec3(0.95, 0.97, 0.92);

// clouds.rgb *= fogTint;

    // Optional: make fog softer
    clouds.a *= 0.6;
   

    vec4 finalColor = mix(bg, clouds, clouds.a);

// Reduce brightness to 60%
    // color.rgb *= 0.2;

    gl_FragColor = finalColor;
}